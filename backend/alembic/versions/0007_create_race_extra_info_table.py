"""create race_extra_info table

出走表・直前情報・オッズ以外の追加情報（ピットレポート・コンピューター
予想等）を保存するテーブル。情報源ごとにフォーマットがバラバラなため、
固定カラムではなく自由文（content）で保持する。他のraces従属テーブル
（odds等）と同じ設計思想で、RLSはracesへのEXISTSサブクエリで
user_idを確認する形にする。

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OWNER_CONDITION = (
    "EXISTS ("
    "SELECT 1 FROM races "
    "WHERE races.id = race_extra_info.race_id "
    "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
    ")"
)


def upgrade() -> None:
    op.create_table(
        "race_extra_info",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "race_id",
            sa.Integer,
            sa.ForeignKey("races.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "category IN ('pit_report', 'computer_prediction', 'other')",
            name="ck_race_extra_info_category",
        ),
    )
    op.create_index("ix_race_extra_info_race_id", "race_extra_info", ["race_id"])

    op.execute("ALTER TABLE race_extra_info ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY race_extra_info_owner_all ON race_extra_info "
        f"FOR ALL "
        f"USING ({_OWNER_CONDITION}) "
        f"WITH CHECK ({_OWNER_CONDITION})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY race_extra_info_owner_all ON race_extra_info")
    op.drop_table("race_extra_info")
