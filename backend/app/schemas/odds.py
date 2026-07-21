import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Stage = Literal["entry_confirmed", "pre_race", "final"]

_COMBINATION_PATTERN = re.compile(r"^[1-6]-[1-6]-[1-6]$")


def _validate_combination(value: str) -> str:
    if not _COMBINATION_PATTERN.match(value):
        raise ValueError('combinationは"1-2-3"のように1〜6の3艇で指定してください')
    boats = value.split("-")
    if len(set(boats)) != 3:
        raise ValueError("combinationの3艇は重複できません")
    return value


class OddsEntryInput(BaseModel):
    combination: str
    odds_value: float = Field(gt=0)

    @field_validator("combination")
    @classmethod
    def validate_combination(cls, value: str) -> str:
        return _validate_combination(value)


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
