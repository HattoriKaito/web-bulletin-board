from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RaceEntry(Base):
    __tablename__ = "race_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(
        ForeignKey("races.id", ondelete="CASCADE"), nullable=False
    )
    boat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    racer_name: Mapped[str] = mapped_column(String, nullable=False)
    local_win_rate: Mapped[float | None] = mapped_column(Float)
    national_win_rate: Mapped[float | None] = mapped_column(Float)
    motor_win_rate: Mapped[float | None] = mapped_column(Float)
    flag_status: Mapped[str | None] = mapped_column(String)
    entry_course: Mapped[int | None] = mapped_column(Integer)
    exhibition_time: Mapped[float | None] = mapped_column(Float)
    weather_condition: Mapped[str | None] = mapped_column(String)
    wind_direction: Mapped[str | None] = mapped_column(String)
    wind_speed: Mapped[float | None] = mapped_column(Float)
