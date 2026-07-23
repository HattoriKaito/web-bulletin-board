from pydantic import BaseModel, Field


class ExtractedPreRegistrationEntry(BaseModel):
    boat_number: int = Field(description="艇番（1〜6）")
    racer_name: str | None = None
    local_win_rate: float | None = None
    national_win_rate: float | None = None
    motor_win_rate: float | None = None
    flag_status: str | None = None
    uncertain_fields: list[str] = Field(
        default_factory=list,
        description="値を入れたが読み取りに自信が持てなかったフィールド名のリスト",
    )


class ExtractedPreRegistrationResult(BaseModel):
    boats: list[ExtractedPreRegistrationEntry] = Field(description="6艇分の抽出結果")


class ExtractedPreRaceEntry(BaseModel):
    boat_number: int = Field(description="艇番（1〜6）")
    entry_course: int | None = None
    exhibition_time: float | None = None
    weather_condition: str | None = None
    wind_direction: str | None = None
    wind_speed: float | None = None
    uncertain_fields: list[str] = Field(
        default_factory=list,
        description="値を入れたが読み取りに自信が持てなかったフィールド名のリスト",
    )


class ExtractedPreRaceResult(BaseModel):
    boats: list[ExtractedPreRaceEntry] = Field(description="6艇分の抽出結果")
