"""create prediction_chats table

AI予想への対話・深掘り機能用のテーブル。predictions従属だが、race_idを
直接持たず、predictions経由でracesまでたどってuser_idを確認する必要が
あるため、RLSの所有者条件はprediction_rules_owner_all（migration 0002）と
同じJOINパターンを使う。

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OWNER_CONDITION = (
    "EXISTS ("
    "SELECT 1 FROM predictions "
    "JOIN races ON races.id = predictions.race_id "
    "WHERE predictions.id = prediction_chats.prediction_id "
    "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
    ")"
)


def upgrade() -> None:
    op.create_table(
        "prediction_chats",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "prediction_id",
            sa.Integer,
            sa.ForeignKey("predictions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "role IN ('user', 'assistant')", name="ck_prediction_chats_role"
        ),
    )
    op.create_index(
        "ix_prediction_chats_prediction_id", "prediction_chats", ["prediction_id"]
    )

    op.execute("ALTER TABLE prediction_chats ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY prediction_chats_owner_all ON prediction_chats "
        f"FOR ALL "
        f"USING ({_OWNER_CONDITION}) "
        f"WITH CHECK ({_OWNER_CONDITION})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY prediction_chats_owner_all ON prediction_chats")
    op.drop_table("prediction_chats")
