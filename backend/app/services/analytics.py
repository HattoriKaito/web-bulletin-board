from sqlalchemy.orm import Session

from app.core.combination import normalize_combination
from app.models import Bet, Prediction, PredictionRule, Race, Result
from app.schemas.rule import RuleStats
from app.schemas.summary import RaceTypeStats


def _race_ai_hit(db: Session, race_id: int) -> bool | None:
    """レースのAI提案買い目(is_ai_suggested=true)が的中したかを判定する。

    結果が未確定、またはAI提案BETSがまだ記録されていない場合は判定不能として
    Noneを返す（呼び出し側で集計の分母・分子どちらにも含めない）。
    """
    result = db.query(Result).filter(Result.race_id == race_id).first()
    if result is None:
        return None
    ai_bets = db.query(Bet).filter(Bet.race_id == race_id, Bet.is_ai_suggested.is_(True)).all()
    if not ai_bets:
        return None
    normalized_finish = normalize_combination(result.finishing_order)
    return any(normalize_combination(b.bet_combination) == normalized_finish for b in ai_bets)


def compute_rule_stats(db: Session, rule_id: int) -> RuleStats:
    """ルール別成績集計。

    的中判定は実際の買い目ではなく、AI提案買い目（is_ai_suggested=true、
    stage=finalの予想からensure_ai_suggested_betsで自動コピーされたもの）を
    基準にする。ルールが測定対象とするのはAIのロジックそのものであり、
    ユーザー自身の購入判断ではないため。

    PREDICTION_RULESはentry_confirmed/pre_race/finalいずれの段階の予想
    生成時にも記録されうるため、同じレースに複数回ルールが適用されている
    ことがある。レースの的中結果は1つしかないので、レース単位で重複を
    排除してから集計する（そうしないと同一の結果が適用段階数分だけ
    多重にカウントされてしまう）。

    is_active=falseに変更されたルールでもPREDICTION_RULESの履歴自体は
    削除されないため、ここでis_activeによる絞り込みは行わない
    （無効化後も過去の集計結果が残るようにするため）。
    """
    race_ids = (
        db.query(Prediction.race_id)
        .join(PredictionRule, PredictionRule.prediction_id == Prediction.id)
        .filter(PredictionRule.rule_id == rule_id)
        .distinct()
        .all()
    )

    applied_count = 0
    hit_count = 0
    for (race_id,) in race_ids:
        hit = _race_ai_hit(db, race_id)
        if hit is None:
            continue
        applied_count += 1
        if hit:
            hit_count += 1

    return RuleStats(rule_id=rule_id, applied_count=applied_count, hit_count=hit_count)


def compute_race_type_stats(db: Session) -> list[RaceTypeStats]:
    """RACES.race_type（一般戦/SG等）ごとのAI提案買い目の的中率集計。

    結果が確定しているレースのみを対象にする（結果未確定のレースは
    的中の有無が判定できないため）。
    """
    races = db.query(Race).join(Result, Result.race_id == Race.id).all()

    totals: dict[str, int] = {}
    hits: dict[str, int] = {}
    for race in races:
        hit = _race_ai_hit(db, race.id)
        if hit is None:
            continue
        totals[race.race_type] = totals.get(race.race_type, 0) + 1
        if hit:
            hits[race.race_type] = hits.get(race.race_type, 0) + 1

    return [
        RaceTypeStats(
            race_type=race_type,
            total_races=total,
            hit_count=hits.get(race_type, 0),
            hit_rate=hits.get(race_type, 0) / total,
        )
        for race_type, total in sorted(totals.items())
    ]
