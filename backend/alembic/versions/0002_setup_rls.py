"""setup row level security

db/setup_rls.sql の内容を、テーブル作成直後に適用するマイグレーションとして
組み込んだもの。ファイル冒頭でコメントアウトされているapp_userロール作成の
CREATE ROLE文は、パスワードを伴う一度きりの手動作業のため、
Supabaseダッシュボードのsql Editorで別途実行すること（このマイグレーションには含めない）。

current_setting('app.current_user_id', true) は NULLIF(..., '')::int でラップする。
コネクションプーリング環境では、一度set_configが呼ばれた物理接続は未認証時に
NULLではなく空文字を返すため、素の::intキャストだと本来アクセス拒否すべき場面で
「invalid input syntax for type integer」の例外になってしまうことをテストで確認したため。

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = [
    "users",
    "races",
    "race_entries",
    "predictions",
    "prediction_rules",
    "rules",
    "bets",
    "results",
]

_OWNER_ALL_POLICIES = {
    "races": (
        "user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
    ),
    "rules": (
        "user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
    ),
    "race_entries": (
        "EXISTS ("
        "SELECT 1 FROM races "
        "WHERE races.id = race_entries.race_id "
        "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
        ")"
    ),
    "predictions": (
        "EXISTS ("
        "SELECT 1 FROM races "
        "WHERE races.id = predictions.race_id "
        "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
        ")"
    ),
    "prediction_rules": (
        "EXISTS ("
        "SELECT 1 FROM predictions "
        "JOIN races ON races.id = predictions.race_id "
        "WHERE predictions.id = prediction_rules.prediction_id "
        "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
        ")"
    ),
    "bets": (
        "EXISTS ("
        "SELECT 1 FROM races "
        "WHERE races.id = bets.race_id "
        "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
        ")"
    ),
    "results": (
        "EXISTS ("
        "SELECT 1 FROM races "
        "WHERE races.id = results.race_id "
        "AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int"
        ")"
    ),
}


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    op.execute(
        "CREATE POLICY users_self_select ON users "
        "FOR SELECT "
        "USING (id = NULLIF(current_setting('app.current_user_id', true), '')::int)"
    )
    op.execute(
        "CREATE POLICY users_self_update ON users "
        "FOR UPDATE "
        "USING (id = NULLIF(current_setting('app.current_user_id', true), '')::int)"
    )
    op.execute(
        "CREATE POLICY users_signup_insert ON users "
        "FOR INSERT "
        "WITH CHECK (true)"
    )

    for table, condition in _OWNER_ALL_POLICIES.items():
        op.execute(
            f"CREATE POLICY {table}_owner_all ON {table} "
            f"FOR ALL "
            f"USING ({condition}) "
            f"WITH CHECK ({condition})"
        )


def downgrade() -> None:
    for table in _OWNER_ALL_POLICIES:
        op.execute(f"DROP POLICY {table}_owner_all ON {table}")

    op.execute("DROP POLICY users_signup_insert ON users")
    op.execute("DROP POLICY users_self_update ON users")
    op.execute("DROP POLICY users_self_select ON users")

    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
