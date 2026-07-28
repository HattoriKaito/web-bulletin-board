from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["pit_report", "computer_prediction", "other"]


class RaceExtraInfoCreate(BaseModel):
    category: Category
    content: str = Field(min_length=1, max_length=8000)


class RaceExtraInfoBulkCreate(BaseModel):
    entries: list[RaceExtraInfoCreate] = Field(min_length=1)


class RaceExtraInfoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    race_id: int
    category: Category
    content: str
    created_at: datetime


class ExtractedExtraInfoItem(BaseModel):
    category: Category = Field(
        description="pit_report（ピットレポート）/ computer_prediction（コンピューター予想）/ other のいずれか"
    )
    content: str = Field(description="画像から抽出・要約した内容")


class ExtractedExtraInfoResult(BaseModel):
    items: list[ExtractedExtraInfoItem] = Field(
        description="抽出できた追加情報の一覧（1枚の画像や複数枚の画像に複数の情報源が"
        "含まれる場合は、それぞれ別の項目に分ける）"
    )
