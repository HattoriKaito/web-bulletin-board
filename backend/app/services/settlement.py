from sqlalchemy.orm import Session

from app.core.combination import normalize_combination
from app.models import Bet, Prediction, Result
from app.schemas.result import BetGroupSummary, BetHitInfo


def ensure_ai_suggested_bets(
    db: Session, race_id: int, prediction: Prediction | None = None
) -> list[Bet]:
    """AI提案のBETS行（is_ai_suggested=true）がまだ無ければ作成する。

    「実際の買い目を確定したとき」「stage=final予想を生成したとき」の
    両方から呼ばれる共通ロジック。生成順序がどちらが先でも、最終的に
    AI提案が記録される状態を保証するため。既にAI提案行がある場合は
    何もせず、それをそのまま返す（絶対に上書きしない）。
    """
    existing = (
        db.query(Bet)
        .filter(Bet.race_id == race_id, Bet.is_ai_suggested.is_(True))
        .order_by(Bet.id)
        .all()
    )
    if existing:
        return existing

    if prediction is None:
        prediction = (
            db.query(Prediction)
            .filter(Prediction.race_id == race_id, Prediction.stage == "final")
            .order_by(Prediction.created_at.desc())
            .first()
        )
    if prediction is None:
        return []

    new_bets = [
        Bet(race_id=race_id, bet_combination=combo, amount=200, is_ai_suggested=True)
        for combo in prediction.suggested_bets
    ]
    db.add_all(new_bets)
    db.flush()
    return new_bets


def _compute_winnings(bet_amount: int, payout_amount: int) -> int:
    """払戻金（RESULTS.payout_amount）は100円あたりの金額として記録される想定のため、
    賭け金の100円単位数を掛けて実際の払戻額を求める。
    """
    return payout_amount * (bet_amount // 100)


def compute_bet_hits(bets: list[Bet], result: Result) -> list[BetHitInfo]:
    normalized_finish = normalize_combination(result.finishing_order)
    hit_infos = []
    for b in bets:
        is_hit = normalize_combination(b.bet_combination) == normalized_finish
        winnings = _compute_winnings(b.amount, result.payout_amount) if is_hit else 0
        hit_infos.append(
            BetHitInfo(
                bet_id=b.id,
                combination=b.bet_combination,
                amount=b.amount,
                is_ai_suggested=b.is_ai_suggested,
                is_hit=is_hit,
                winnings=winnings,
                net=winnings - b.amount,
            )
        )
    return hit_infos


def summarize_group(hit_infos: list[BetHitInfo], *, is_ai_suggested: bool) -> BetGroupSummary:
    group = [h for h in hit_infos if h.is_ai_suggested == is_ai_suggested]
    total_bet_amount = sum(h.amount for h in group)
    total_winnings = sum(h.winnings for h in group)
    return BetGroupSummary(
        total_bet_amount=total_bet_amount,
        total_winnings=total_winnings,
        net_profit=total_winnings - total_bet_amount,
    )
