from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RuleCreate(BaseModel):
    rule_text: str = Field(min_length=1, max_length=2000)
    category: str | None = Field(default=None, max_length=50)
    is_active: bool = True


class RuleUpdate(BaseModel):
    rule_text: str | None = Field(default=None, min_length=1, max_length=2000)
    category: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None


class RuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_text: str
    category: str | None
    is_active: bool
    created_at: datetime
