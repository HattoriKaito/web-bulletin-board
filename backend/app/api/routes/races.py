from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.models import Bet, Odds, Prediction, Race, RaceEntry, RaceExtraInfo, Result, Rule
from app.schemas.bet import BetRead, BetsConfirmInput, BetsConfirmResult
from app.schemas.odds import OddsBulkCreate, OddsRead, Stage
from app.schemas.odds_extraction import ExtractedOddsResult
from app.schemas.prediction import PredictionRead
from app.schemas.race import RaceCreate, RaceRead, RaceUpdate
from app.schemas.race_entry import RaceEntriesBulkUpsert, RaceEntryRead
from app.schemas.race_entry_extraction import (
    ExtractedPreRaceResult,
    ExtractedPreRegistrationResult,
)
from app.schemas.race_extra_info import (
    ExtractedExtraInfoResult,
    RaceExtraInfoBulkCreate,
    RaceExtraInfoRead,
)
from app.schemas.result import ResultRead, ResultUpsert
from app.services.ai_prediction import STAGE_ORDER, AIGenerationError, generate_prediction
from app.services.entry_extraction import (
    ALLOWED_IMAGE_TYPES,
    MAX_IMAGE_BYTES,
    MAX_IMAGES,
    ExtractionError,
    extract_pre_race,
    extract_pre_registration,
)
from app.services.extra_info_extraction import ExtraInfoExtractionError, extract_extra_info
from app.services.odds_extraction import OddsExtractionError, extract_odds
from app.services.settlement import compute_bet_hits, ensure_ai_suggested_bets, summarize_group

router = APIRouter(prefix="/races", tags=["races"])


def _get_owned_race(db: Session, race_id: int) -> Race:
    """自分が所有するレースを取得する。

    RLS（races_owner_all）が既に他ユーザーの行を不可視にしているため、
    ここでの存在チェックは同時にオーナーチェックにもなっている。
    """
    race = db.get(Race, race_id)
    if race is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="レースが見つかりません"
        )
    return race


@router.post("", response_model=RaceRead, status_code=status.HTTP_201_CREATED)
def create_race(
    payload: RaceCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Race:
    race = Race(user_id=user_id, **payload.model_dump())
    db.add(race)
    db.flush()
    return race


@router.get("", response_model=list[RaceRead])
def list_races(db: Session = Depends(get_db)) -> list[Race]:
    return (
        db.query(Race)
        .order_by(Race.race_date.desc(), Race.id.desc())
        .all()
    )


@router.get("/{race_id}", response_model=RaceRead)
def get_race(race_id: int, db: Session = Depends(get_db)) -> Race:
    return _get_owned_race(db, race_id)


@router.patch("/{race_id}", response_model=RaceRead)
def update_race(
    race_id: int, payload: RaceUpdate, db: Session = Depends(get_db)
) -> Race:
    race = _get_owned_race(db, race_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(race, field, value)
    db.flush()
    return race


@router.delete("/{race_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_race(race_id: int, db: Session = Depends(get_db)) -> None:
    race = _get_owned_race(db, race_id)
    db.delete(race)
    db.flush()


@router.get("/{race_id}/entries", response_model=list[RaceEntryRead])
def list_race_entries(race_id: int, db: Session = Depends(get_db)) -> list[RaceEntry]:
    _get_owned_race(db, race_id)
    return (
        db.query(RaceEntry)
        .filter(RaceEntry.race_id == race_id)
        .order_by(RaceEntry.boat_number)
        .all()
    )


@router.put("/{race_id}/entries", response_model=list[RaceEntryRead])
def upsert_race_entries(
    race_id: int, payload: RaceEntriesBulkUpsert, db: Session = Depends(get_db)
) -> list[RaceEntry]:
    """6艇分の出走表データを一括で置き換える。

    個別のUPDATE/INSERTを都度呼ぶのではなく、既存の6件を削除してから
    新しい6件を挿入する形で「まとめて登録・更新」を実現する。
    同一トランザクション内（get_dbが保持する1つのSessionの中）で行うため、
    途中状態（削除だけ済んで未挿入等）が他リクエストから見えることはない。

    出走表確定時点の初回登録だけでなく、直前情報（entry_course・
    exhibition_time・weather_condition・wind_direction・wind_speed）が
    判明した際の更新にもこのエンドポイントをそのまま再利用する。
    全件delete→insertのため呼び出し側は必ず既存6件をGETしてから、
    直前情報の項目だけ書き換えて6件まるごとPUTすること（他フィールドを
    空で送ると消えてしまう）。この方式だとrace_entries.idは更新の都度
    変わるが、現状race_entries.idを外部キーで参照するテーブルは無いため
    問題にならない。
    """
    _get_owned_race(db, race_id)
    db.query(RaceEntry).filter(RaceEntry.race_id == race_id).delete()
    entries = [
        RaceEntry(race_id=race_id, **entry.model_dump())
        for entry in payload.entries
    ]
    db.add_all(entries)
    db.flush()
    entries.sort(key=lambda e: e.boat_number)
    return entries


def _read_images(files: list[UploadFile]) -> list[tuple[bytes, str]]:
    """アップロードされた画像を検証しつつ読み込む。

    同期defのエンドポイントから呼ぶため、await file.read()ではなく
    file.file.read()（UploadFile内部のSpooledTemporaryFile）を使う。
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="画像を1枚以上アップロードしてください"
        )
    if len(files) > MAX_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"画像は{MAX_IMAGES}枚までです",
        )
    images: list[tuple[bytes, str]] = []
    for f in files:
        if f.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"対応していない画像形式です: {f.content_type}",
            )
        data = f.file.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="画像サイズが大きすぎます（1枚10MBまで）",
            )
        images.append((data, f.content_type))
    return images


@router.post(
    "/{race_id}/entries/extract-pre-registration",
    response_model=ExtractedPreRegistrationResult,
)
def extract_entries_pre_registration(
    race_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> ExtractedPreRegistrationResult:
    """出走表の画像（複数可）から事前情報（選手名・各種勝率・フラグ）を抽出する。

    抽出結果はDBに保存せず、フロント側でフォームにプリフィルするだけに使う。
    実際の保存は従来通りPUT /races/{race_id}/entriesで、ユーザーが内容を
    確認・修正した上で行う。
    """
    _get_owned_race(db, race_id)
    images = _read_images(files)
    try:
        return extract_pre_registration(images)
    except ExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.post(
    "/{race_id}/entries/extract-pre-race",
    response_model=ExtractedPreRaceResult,
)
def extract_entries_pre_race(
    race_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> ExtractedPreRaceResult:
    """直前情報の画像（複数可）から進入コース・展示タイム・天候等を抽出する。

    extract_entries_pre_registrationと同様、DBには保存しない。
    """
    _get_owned_race(db, race_id)
    images = _read_images(files)
    try:
        return extract_pre_race(images)
    except ExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.get("/{race_id}/odds", response_model=list[OddsRead])
def list_odds(
    race_id: int,
    stage: Stage | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Odds]:
    _get_owned_race(db, race_id)
    query = db.query(Odds).filter(Odds.race_id == race_id)
    if stage is not None:
        query = query.filter(Odds.stage == stage)
    return query.order_by(Odds.recorded_at.desc(), Odds.id.desc()).all()


@router.post("/{race_id}/odds/extract", response_model=ExtractedOddsResult)
def extract_odds_from_images(
    race_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> ExtractedOddsResult:
    """オッズ表の画像（複数可）から組み合わせ・オッズ値を抽出する。

    出走表の画像抽出と同様、DBには保存しない。ユーザーが内容を確認し、
    既存のPOST /races/{race_id}/oddsで保存する。「入力時点」(stage)は
    この抽出とは無関係で、フロント側でユーザーが選んだ値をそのまま使う。
    """
    _get_owned_race(db, race_id)
    images = _read_images(files)
    try:
        return extract_odds(images)
    except OddsExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.post("/{race_id}/odds", response_model=list[OddsRead], status_code=status.HTTP_201_CREATED)
def create_odds(
    race_id: int, payload: OddsBulkCreate, db: Session = Depends(get_db)
) -> list[Odds]:
    """指定stageのオッズをまとめて記録する。

    RACE_ENTRIESと異なり「置き換え」ではなく追記（INSERT）のみ。
    同じcombinationを同じstageで複数回登録した場合も上書きせず、
    recorded_atで時系列に並ぶ複数レコードとして残す（オッズ変動の記録）。
    """
    _get_owned_race(db, race_id)
    odds_rows = [
        Odds(race_id=race_id, stage=payload.stage, **entry.model_dump())
        for entry in payload.entries
    ]
    db.add_all(odds_rows)
    db.flush()
    return odds_rows


@router.get("/{race_id}/extra-info", response_model=list[RaceExtraInfoRead])
def list_extra_info(race_id: int, db: Session = Depends(get_db)) -> list[RaceExtraInfo]:
    _get_owned_race(db, race_id)
    return (
        db.query(RaceExtraInfo)
        .filter(RaceExtraInfo.race_id == race_id)
        .order_by(RaceExtraInfo.created_at.desc(), RaceExtraInfo.id.desc())
        .all()
    )


@router.post(
    "/{race_id}/extra-info",
    response_model=list[RaceExtraInfoRead],
    status_code=status.HTTP_201_CREATED,
)
def create_extra_info(
    race_id: int, payload: RaceExtraInfoBulkCreate, db: Session = Depends(get_db)
) -> list[RaceExtraInfo]:
    """ピットレポート・コンピューター予想等の追加情報をまとめて記録する。

    ODDSと同様、追記のみ（delete+replaceしない）。同じレースに何回でも
    追加でき、AI予想生成時にはその時点で保存されている全件を読み込む。
    """
    _get_owned_race(db, race_id)
    rows = [
        RaceExtraInfo(race_id=race_id, **entry.model_dump()) for entry in payload.entries
    ]
    db.add_all(rows)
    db.flush()
    return rows


@router.post("/{race_id}/extra-info/extract", response_model=ExtractedExtraInfoResult)
def extract_extra_info_from_images(
    race_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> ExtractedExtraInfoResult:
    """ピットレポート・コンピューター予想等の画像（複数可）からcategory・contentを抽出する。

    出走表・オッズの画像抽出と同様、DBには保存しない。ユーザーが内容を
    確認・修正し、既存のPOST /races/{race_id}/extra-infoで保存する。
    """
    _get_owned_race(db, race_id)
    images = _read_images(files)
    try:
        return extract_extra_info(images)
    except ExtraInfoExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.get("/{race_id}/predictions", response_model=list[PredictionRead])
def list_predictions(race_id: int, db: Session = Depends(get_db)) -> list[Prediction]:
    _get_owned_race(db, race_id)
    return (
        db.query(Prediction)
        .filter(Prediction.race_id == race_id)
        .order_by(Prediction.created_at.desc())
        .all()
    )


@router.post(
    "/{race_id}/predictions",
    response_model=PredictionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_prediction(
    race_id: int,
    stage: Stage = Query(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Prediction:
    """指定stageのAI予想を生成する。

    ユーザーが「AI予想を生成」ボタンを押したときにのみ呼ばれるエンドポイントで、
    データ入力のたびに自動生成することはない。過去の予想は上書きせず、
    呼ばれるたびに新しいPREDICTIONS行を追加する（3段階の履歴として残る）。
    """
    race = _get_owned_race(db, race_id)

    entries = (
        db.query(RaceEntry)
        .filter(RaceEntry.race_id == race_id)
        .order_by(RaceEntry.boat_number)
        .all()
    )
    if len(entries) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="先に出走表（6艇分）を登録してください",
        )

    relevant_stages = STAGE_ORDER[: STAGE_ORDER.index(stage) + 1]
    odds = (
        db.query(Odds)
        .filter(Odds.race_id == race_id, Odds.stage.in_(relevant_stages))
        .order_by(Odds.recorded_at)
        .all()
    )
    active_rules = (
        db.query(Rule)
        .filter(Rule.user_id == user_id, Rule.is_active.is_(True))
        .all()
    )
    extra_info = (
        db.query(RaceExtraInfo)
        .filter(RaceExtraInfo.race_id == race_id)
        .order_by(RaceExtraInfo.created_at)
        .all()
    )

    try:
        output, input_snapshot = generate_prediction(
            race, entries, odds, active_rules, extra_info, stage
        )
    except AIGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    prediction = Prediction(
        race_id=race_id,
        stage=stage,
        suggested_bets=output.suggested_bets,
        input_snapshot=input_snapshot,
        summary_reasoning=output.summary_reasoning,
        detailed_reasoning=output.detailed_reasoning,
    )
    db.add(prediction)
    db.flush()

    if stage == "final":
        # 「実際の買い目を先に確定→後からfinal予想を生成」という順序でも
        # AI提案のBETSが記録されるよう、ここでも自動コピーを試みる
        # （既にAI提案行があれば ensure_ai_suggested_bets が何もしない）。
        ensure_ai_suggested_bets(db, race_id, prediction=prediction)

    return prediction


@router.get("/{race_id}/bets", response_model=list[BetRead])
def list_bets(race_id: int, db: Session = Depends(get_db)) -> list[Bet]:
    _get_owned_race(db, race_id)
    return (
        db.query(Bet)
        .filter(Bet.race_id == race_id)
        .order_by(Bet.is_ai_suggested.desc(), Bet.id)
        .all()
    )


@router.put("/{race_id}/bets", response_model=BetsConfirmResult)
def confirm_bets(
    race_id: int, payload: BetsConfirmInput, db: Session = Depends(get_db)
) -> BetsConfirmResult:
    """実際に購入した買い目（is_ai_suggested=false）を確定する。全件置き換え。

    AI提案側（is_ai_suggested=true）はensure_ai_suggested_betsに委譲する。
    その時点でstage=final AI予想（PREDICTIONS.suggested_bets）があれば
    1点200円でBETSに自動コピーし、無ければ何もしない（他stageの予想で
    代用しない）。既にAI提案行がある場合、あるいはfinal予想を先に生成した
    ことで既にコピー済みの場合は再コピーしない（odds/predictionsと同じく
    「後から生成し直しても過去の記録は上書きしない」方針に合わせている）。
    """
    _get_owned_race(db, race_id)

    db.query(Bet).filter(
        Bet.race_id == race_id, Bet.is_ai_suggested.is_(False)
    ).delete()
    actual_bets = [
        Bet(
            race_id=race_id,
            bet_combination=entry.combination,
            amount=entry.amount,
            is_ai_suggested=False,
        )
        for entry in payload.entries
    ]
    db.add_all(actual_bets)
    db.flush()
    actual_bets.sort(key=lambda b: b.id)

    ai_suggested_bets = ensure_ai_suggested_bets(db, race_id)

    return BetsConfirmResult(
        actual_bets=actual_bets,
        ai_suggested_bets=ai_suggested_bets,
        ai_suggested_available=len(ai_suggested_bets) > 0,
    )


def _build_result_read(db: Session, result: Result) -> ResultRead:
    bets = (
        db.query(Bet)
        .filter(Bet.race_id == result.race_id)
        .order_by(Bet.is_ai_suggested.desc(), Bet.id)
        .all()
    )
    bet_results = compute_bet_hits(bets, result)
    return ResultRead(
        id=result.id,
        race_id=result.race_id,
        finishing_order=result.finishing_order,
        payout_amount=result.payout_amount,
        created_at=result.created_at,
        bet_results=bet_results,
        actual_summary=summarize_group(bet_results, is_ai_suggested=False),
        ai_suggested_summary=summarize_group(bet_results, is_ai_suggested=True),
    )


@router.get("/{race_id}/results", response_model=ResultRead | None)
def get_result(race_id: int, db: Session = Depends(get_db)) -> ResultRead | None:
    _get_owned_race(db, race_id)
    result = db.query(Result).filter(Result.race_id == race_id).first()
    if result is None:
        return None
    return _build_result_read(db, result)


@router.put("/{race_id}/results", response_model=ResultRead)
def upsert_result(
    race_id: int, payload: ResultUpsert, db: Session = Depends(get_db)
) -> ResultRead:
    """レース結果を記録（既存があれば更新）し、的中判定を計算して返す。

    的中判定はbet_combinationとfinishing_orderを正規化（全角→半角・前後空白除去）
    した上での完全一致で行う（3連単は着順の完全一致が的中条件のため）。
    判定結果はDBに保存せず、都度計算して返す（結果を後から訂正しても
    古い判定が残らないようにするため）。
    """
    _get_owned_race(db, race_id)
    result = db.query(Result).filter(Result.race_id == race_id).first()
    if result is None:
        result = Result(
            race_id=race_id,
            finishing_order=payload.finishing_order,
            payout_amount=payload.payout_amount,
        )
        db.add(result)
    else:
        result.finishing_order = payload.finishing_order
        result.payout_amount = payload.payout_amount
    db.flush()
    return _build_result_read(db, result)
