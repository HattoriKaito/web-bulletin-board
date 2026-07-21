from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.models import Odds, Race, RaceEntry
from app.schemas.odds import OddsBulkCreate, OddsRead, Stage
from app.schemas.race import RaceCreate, RaceRead, RaceUpdate
from app.schemas.race_entry import RaceEntriesBulkUpsert, RaceEntryRead

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
