from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.combination import normalize_combination, validate_combination


class ResultUpsert(BaseModel):
    finishing_order: str
    payout_amount: int = Field(ge=0)

    @field_validator("finishing_order")
    @classmethod
    def _validate_finishing_order(cls, value: str) -> str:
        # 全角で入力される可能性がある（IME入力等）ため、先に正規化してから
        # 形式チェックする。DBには常に正規化済み（半角）の形で保存する。
        normalized = normalize_combination(value)
        return validate_combination(normalized)


class BetHitInfo(BaseModel):
    bet_id: int
    combination: str
    amount: int
    is_ai_suggested: bool
    is_hit: bool


class ResultRead(BaseModel):
    id: int
    race_id: int
    finishing_order: str
    payout_amount: int
    created_at: datetime
    bet_results: list[BetHitInfo]
