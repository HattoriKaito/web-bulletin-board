from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.odds import Stage


class PredictionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    race_id: int
    stage: Stage
    suggested_bets: list[str]
    summary_reasoning: str
    detailed_reasoning: str
    created_at: datetime
