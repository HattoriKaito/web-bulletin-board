from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.combination import validate_combination


class BetEntryInput(BaseModel):
    combination: str
    amount: int = Field(gt=0)

    @field_validator("combination")
    @classmethod
    def _validate_combination(cls, value: str) -> str:
        return validate_combination(value)


class BetsConfirmInput(BaseModel):
    entries: list[BetEntryInput] = Field(min_length=5, max_length=5)

    @field_validator("entries")
    @classmethod
    def _unique_combinations(cls, entries: list[BetEntryInput]) -> list[BetEntryInput]:
        combos = [e.combination for e in entries]
        if len(set(combos)) != len(combos):
            raise ValueError("買い目の組み合わせが重複しています")
        return entries


class BetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    race_id: int
    bet_combination: str
    amount: int
    is_ai_suggested: bool
    created_at: datetime


class BetsConfirmResult(BaseModel):
    actual_bets: list[BetRead]
    ai_suggested_bets: list[BetRead]
    ai_suggested_available: bool
