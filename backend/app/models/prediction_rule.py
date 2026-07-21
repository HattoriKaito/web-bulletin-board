from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PredictionRule(Base):
    __tablename__ = "prediction_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    prediction_id: Mapped[int] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False
    )
    rule_id: Mapped[int] = mapped_column(
        ForeignKey("rules.id", ondelete="CASCADE"), nullable=False
    )
