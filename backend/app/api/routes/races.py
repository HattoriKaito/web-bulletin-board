from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.core.combination import normalize_combination
from app.models import Bet, Odds, Prediction, Race, RaceEntry, Result, Rule
from app.schemas.bet import BetRead, BetsConfirmInput, BetsConfirmResult
from app.schemas.odds import OddsBulkCreate, OddsRead, Stage
from app.schemas.prediction import PredictionRead
from app.schemas.race import RaceCreate, RaceRead, RaceUpdate
from app.schemas.race_entry import RaceEntriesBulkUpsert, RaceEntryRead
from app.schemas.result import BetHitInfo, ResultRead, ResultUpsert
from app.services.ai_prediction import STAGE_ORDER, AIGenerationError, generate_prediction

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

    try:
        output, input_snapshot = generate_prediction(
            race, entries, odds, active_rules, stage
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

    初めて確定するとき（is_ai_suggested=trueの行がまだ無いとき）に限り、
    その時点のstage=final AI予想（PREDICTIONS.suggested_bets）があれば
    1点200円でBETSに自動コピーする。final予想が無ければAI提案側は作成せず
    （他stageの予想で代用しない）、ai_suggested_available=falseを返す。
    AI提案は一度作成したら以降の買い目再編集では再コピーしない
    （odds/predictionsと同じく「後から生成し直しても過去の記録は
    上書きしない」方針に合わせている）。
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

    ai_suggested_bets = (
        db.query(Bet)
        .filter(Bet.race_id == race_id, Bet.is_ai_suggested.is_(True))
        .order_by(Bet.id)
        .all()
    )
    if not ai_suggested_bets:
        latest_final_prediction = (
            db.query(Prediction)
            .filter(Prediction.race_id == race_id, Prediction.stage == "final")
            .order_by(Prediction.created_at.desc())
            .first()
        )
        if latest_final_prediction is not None:
            ai_suggested_bets = [
                Bet(
                    race_id=race_id,
                    bet_combination=combo,
                    amount=200,
                    is_ai_suggested=True,
                )
                for combo in latest_final_prediction.suggested_bets
            ]
            db.add_all(ai_suggested_bets)
            db.flush()

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
    normalized_finish = normalize_combination(result.finishing_order)
    bet_results = [
        BetHitInfo(
            bet_id=b.id,
            combination=b.bet_combination,
            amount=b.amount,
            is_ai_suggested=b.is_ai_suggested,
            is_hit=normalize_combination(b.bet_combination) == normalized_finish,
        )
        for b in bets
    ]
    return ResultRead(
        id=result.id,
        race_id=result.race_id,
        finishing_order=result.finishing_order,
        payout_amount=result.payout_amount,
        created_at=result.created_at,
        bet_results=bet_results,
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
