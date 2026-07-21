from pydantic import BaseModel, ConfigDict, Field, field_validator


class RaceEntryUpsert(BaseModel):
    boat_number: int = Field(ge=1, le=6)
    racer_name: str = Field(min_length=1, max_length=100)
    local_win_rate: float | None = None
    national_win_rate: float | None = None
    motor_win_rate: float | None = None
    flag_status: str | None = Field(default=None, max_length=20)
    entry_course: int | None = Field(default=None, ge=1, le=6)
    exhibition_time: float | None = None
    weather_condition: str | None = Field(default=None, max_length=50)
    wind_direction: str | None = Field(default=None, max_length=20)
    wind_speed: float | None = None


class RaceEntryRead(RaceEntryUpsert):
    model_config = ConfigDict(from_attributes=True)

    id: int
    race_id: int


class RaceEntriesBulkUpsert(BaseModel):
    entries: list[RaceEntryUpsert] = Field(min_length=6, max_length=6)

    @field_validator("entries")
    @classmethod
    def boat_numbers_must_be_1_to_6(
        cls, entries: list[RaceEntryUpsert]
    ) -> list[RaceEntryUpsert]:
        boat_numbers = sorted(e.boat_number for e in entries)
        if boat_numbers != [1, 2, 3, 4, 5, 6]:
            raise ValueError("boat_numberは1〜6を重複なく1つずつ指定してください")
        return entries
