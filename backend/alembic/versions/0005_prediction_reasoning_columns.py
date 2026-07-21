"""expand predictions with input_snapshot / summary / detailed reasoning

Step6（AI予想機能）の準備として、PREDICTIONSテーブルを拡張する：
- suggested_bets を String から JSON（買い目配列）に変更
- input_snapshot（JSON）を追加：予想生成時点のrace_entries・odds（該当stageまで）・
  適用したrules(is_active=trueのもの)をまるごと保存し、後から再現・検証できるようにする
- summary_reasoning（一覧表示用の短い根拠）／detailed_reasoning（艇ごとの詳細根拠）を追加し、
  単一のai_reasoningカラムを置き換える

predictionsテーブルはこの時点まで書き込み経路（エンドポイント）が存在しないため、
既存データが無い前提でNOT NULL列をデフォルト値なしで追加する。

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("predictions", "ai_reasoning")

    # suggested_bets: String -> JSON（買い目配列）。データが無い前提でdrop→re-add。
    op.drop_column("predictions", "suggested_bets")
    op.add_column(
        "predictions", sa.Column("suggested_bets", sa.JSON, nullable=False)
    )

    op.add_column(
        "predictions", sa.Column("input_snapshot", sa.JSON, nullable=False)
    )
    op.add_column(
        "predictions", sa.Column("summary_reasoning", sa.Text, nullable=False)
    )
    op.add_column(
        "predictions", sa.Column("detailed_reasoning", sa.Text, nullable=False)
    )


def downgrade() -> None:
    op.drop_column("predictions", "detailed_reasoning")
    op.drop_column("predictions", "summary_reasoning")
    op.drop_column("predictions", "input_snapshot")

    op.drop_column("predictions", "suggested_bets")
    op.add_column(
        "predictions", sa.Column("suggested_bets", sa.String, nullable=False)
    )

    op.add_column("predictions", sa.Column("ai_reasoning", sa.Text, nullable=True))
