from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Odds(Base):
    __tablename__ = "odds"
    __table_args__ = (
        CheckConstraint(
            "stage IN ('entry_confirmed', 'pre_race', 'final')",
            name="ck_odds_stage",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    race_id: Mapped[int] = mapped_column(
        ForeignKey("races.id", ondelete="CASCADE"), nullable=False
    )
    stage: Mapped[str] = mapped_column(String, nullable=False)
    combination: Mapped[str] = mapped_column(String, nullable=False)
    odds_value: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
