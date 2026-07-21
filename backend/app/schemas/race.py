from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class RaceCreate(BaseModel):
    venue: str = Field(min_length=1, max_length=100)
    race_number: int = Field(ge=1, le=12)
    race_date: date
    race_type: str = Field(min_length=1, max_length=50)


class RaceUpdate(BaseModel):
    venue: str | None = Field(default=None, min_length=1, max_length=100)
    race_number: int | None = Field(default=None, ge=1, le=12)
    race_date: date | None = None
    race_type: str | None = Field(default=None, min_length=1, max_length=50)


class RaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venue: str
    race_number: int
    race_date: date
    race_type: str
    created_at: datetime
