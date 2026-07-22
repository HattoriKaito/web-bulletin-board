from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.combination import validate_combination

Stage = Literal["entry_confirmed", "pre_race", "final"]


class OddsEntryInput(BaseModel):
    combination: str
    odds_value: float = Field(gt=0)

    @field_validator("combination")
    @classmethod
    def _validate_combination(cls, value: str) -> str:
        return validate_combination(value)


class OddsBulkCreate(BaseModel):
    stage: Stage
    entries: list[OddsEntryInput] = Field(min_length=1)


class OddsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    race_id: int
    stage: Stage
    combination: str
    odds_value: float
    recorded_at: datetime
