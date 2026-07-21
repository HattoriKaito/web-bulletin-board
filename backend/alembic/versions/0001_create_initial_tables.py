"""create initial tables

Revision ID: 0001
Revises:
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String, nullable=False, unique=True),
        sa.Column("password_hash", sa.String, nullable=False),
        sa.Column("display_name", sa.String, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "races",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("venue", sa.String, nullable=False),
        sa.Column("race_number", sa.Integer, nullable=False),
        sa.Column("race_date", sa.Date, nullable=False),
        sa.Column("race_type", sa.String, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_races_user_id", "races", ["user_id"])

    op.create_table(
        "rules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rule_text", sa.Text, nullable=False),
        sa.Column("category", sa.String, nullable=True),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_rules_user_id", "rules", ["user_id"])

    op.create_table(
        "race_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "race_id",
            sa.Integer,
            sa.ForeignKey("races.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("boat_number", sa.Integer, nullable=False),
        sa.Column("racer_name", sa.String, nullable=False),
        sa.Column("local_win_rate", sa.Float, nullable=True),
        sa.Column("national_win_rate", sa.Float, nullable=True),
        sa.Column("motor_win_rate", sa.Float, nullable=True),
        sa.Column("flag_status", sa.String, nullable=True),
        sa.Column("entry_course", sa.Integer, nullable=True),
        sa.Column("exhibition_time", sa.Float, nullable=True),
        sa.Column("weather_condition", sa.String, nullable=True),
        sa.Column("wind_direction", sa.String, nullable=True),
        sa.Column("wind_speed", sa.Float, nullable=True),
    )
    op.create_index("ix_race_entries_race_id", "race_entries", ["race_id"])

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "race_id",
            sa.Integer,
            sa.ForeignKey("races.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stage", sa.String, nullable=False),
        sa.Column("suggested_bets", sa.String, nullable=False),
        sa.Column("ai_reasoning", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "stage IN ('entry_confirmed', 'pre_race', 'final')",
            name="ck_predictions_stage",
        ),
    )
    op.create_index("ix_predictions_race_id", "predictions", ["race_id"])

    op.create_table(
        "prediction_rules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "prediction_id",
            sa.Integer,
            sa.ForeignKey("predictions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "rule_id",
            sa.Integer,
            sa.ForeignKey("rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_prediction_rules_prediction_id", "prediction_rules", ["prediction_id"]
    )
    op.create_index("ix_prediction_rules_rule_id", "prediction_rules", ["rule_id"])

    op.create_table(
        "bets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "race_id",
            sa.Integer,
            sa.ForeignKey("races.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("bet_combination", sa.String, nullable=False),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("is_ai_suggested", sa.Boolean, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_bets_race_id", "bets", ["race_id"])

    op.create_table(
        "results",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "race_id",
            sa.Integer,
            sa.ForeignKey("races.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("finishing_order", sa.String, nullable=False),
        sa.Column("payout_amount", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_results_race_id", "results", ["race_id"])


def downgrade() -> None:
    op.drop_table("results")
    op.drop_table("bets")
    op.drop_table("prediction_rules")
    op.drop_table("predictions")
    op.drop_table("race_entries")
    op.drop_table("rules")
    op.drop_table("races")
    op.drop_table("users")
