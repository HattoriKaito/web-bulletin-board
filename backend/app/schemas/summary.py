from datetime import date

from pydantic import BaseModel

from app.schemas.result import BetGroupSummary


class RaceSummaryItem(BaseModel):
    race_id: int
    venue: str
    race_number: int
    race_date: date
    actual_summary: BetGroupSummary
    ai_suggested_summary: BetGroupSummary


class OverallSummary(BaseModel):
    races: list[RaceSummaryItem]
    actual_total: BetGroupSummary
    ai_suggested_total: BetGroupSummary
