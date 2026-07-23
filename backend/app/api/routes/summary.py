from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Bet, Race, Result
from app.schemas.result import BetGroupSummary
from app.schemas.summary import OverallSummary, RaceSummaryItem
from app.services.settlement import compute_bet_hits, summarize_group

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("", response_model=OverallSummary)
def get_summary(db: Session = Depends(get_db)) -> OverallSummary:
    """全レース横断で、実際の買い目とAI提案通りに買った場合の収支を比較する。

    RESULTSが記録されているレースのみ集計対象とする（結果未確定のレースは
    収支が定まらないため）。RLS（races_owner_all等）により自分のレースの
    みが対象になる。
    """
    races = (
        db.query(Race)
        .join(Result, Result.race_id == Race.id)
        .order_by(Race.race_date.desc(), Race.id.desc())
        .all()
    )

    items: list[RaceSummaryItem] = []
    actual_bet_total = 0
    actual_winnings_total = 0
    ai_bet_total = 0
    ai_winnings_total = 0

    for race in races:
        result = db.query(Result).filter(Result.race_id == race.id).first()
        bets = db.query(Bet).filter(Bet.race_id == race.id).all()
        hit_infos = compute_bet_hits(bets, result)
        actual_summary = summarize_group(hit_infos, is_ai_suggested=False)
        ai_summary = summarize_group(hit_infos, is_ai_suggested=True)

        items.append(
            RaceSummaryItem(
                race_id=race.id,
                venue=race.venue,
                race_number=race.race_number,
                race_date=race.race_date,
                actual_summary=actual_summary,
                ai_suggested_summary=ai_summary,
            )
        )
        actual_bet_total += actual_summary.total_bet_amount
        actual_winnings_total += actual_summary.total_winnings
        ai_bet_total += ai_summary.total_bet_amount
        ai_winnings_total += ai_summary.total_winnings

    return OverallSummary(
        races=items,
        actual_total=BetGroupSummary(
            total_bet_amount=actual_bet_total,
            total_winnings=actual_winnings_total,
            net_profit=actual_winnings_total - actual_bet_total,
        ),
        ai_suggested_total=BetGroupSummary(
            total_bet_amount=ai_bet_total,
            total_winnings=ai_winnings_total,
            net_profit=ai_winnings_total - ai_bet_total,
        ),
    )
