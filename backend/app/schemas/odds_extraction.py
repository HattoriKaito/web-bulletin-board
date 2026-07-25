from pydantic import BaseModel, Field


class ExtractedOddsRow(BaseModel):
    combination: str = Field(description='3連単の組み合わせ。例: "1-2-3"')
    odds_value: float | None = None
    uncertain: bool = Field(
        default=False,
        description="組み合わせまたはオッズ値の読み取りに自信が持てない場合true",
    )


class ExtractedOddsResult(BaseModel):
    rows: list[ExtractedOddsRow] = Field(description="抽出できたオッズの一覧（最大120件）")
