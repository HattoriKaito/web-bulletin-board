from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PredictionChatMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class PredictionChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    prediction_id: int
    role: str
    content: str
    created_at: datetime


class PredictionChatReply(BaseModel):
    user_message: PredictionChatMessageRead
    assistant_message: PredictionChatMessageRead
