"""create odds table

ER図（docs/03_detailed_design.md）に追加したODDSテーブル。
他のraces従属テーブル（race_entries/predictions/bets/results）と同じ設計思想で、
RLSはracesへのEXISTSサブクエリでuser_idを確認する形にする。

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OWNER_CONDITION = (
    "EXISTS ("
    "SELECT 1 FROM races "
    "WHERE races.id = odds.race_id "
    "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
    ")"
)


def upgrade() -> None:
    op.create_table(
        "odds",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "race_id",
            sa.Integer,
            sa.ForeignKey("races.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stage", sa.String, nullable=False),
        sa.Column("combination", sa.String, nullable=False),
        sa.Column("odds_value", sa.Float, nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "stage IN ('entry_confirmed', 'pre_race', 'final')",
            name="ck_odds_stage",
        ),
    )
    op.create_index("ix_odds_race_id", "odds", ["race_id"])

    op.execute("ALTER TABLE odds ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY odds_owner_all ON odds "
        f"FOR ALL "
        f"USING ({_OWNER_CONDITION}) "
        f"WITH CHECK ({_OWNER_CONDITION})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY odds_owner_all ON odds")
    op.drop_table("odds")
