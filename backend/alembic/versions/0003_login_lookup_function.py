"""login lookup function (SECURITY DEFINER)

ログイン処理はメールアドレスからユーザーを検索する必要があるが、
users_self_select ポリシーは「自分のid」が既知であることを前提にしており、
認証前（=自分のidが未知）の検索はRLSでブロックされる。

この関数はマイグレーション実行ロール（usersテーブルのオーナー）で作成する
SECURITY DEFINER関数とし、id・password_hashのみを返す。テーブルオーナーは
デフォルトでRLSの対象外（FORCE ROW LEVEL SECURITYを設定していないため）
なので、この関数の呼び出し中に限りRLSを迂回してemail検索ができる。
app_userにはEXECUTE権限のみ付与し、usersテーブルへの直接SELECTでの
全件参照や、id以外のカラムへの迂回的アクセスは許可しない。

注意：このマイグレーションはGRANT対象としてapp_userロールの存在を前提とする。
db/setup_rls.sql冒頭の「CREATE ROLE app_user ...」を先に手動実行してから
alembic upgradeを実行すること（Step1の0001/0002はロール名を直接参照しない
ため問題にならなかったが、0003以降はこの実行順序に依存する）。

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-21

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION find_user_credentials(p_email text)
        RETURNS TABLE(id integer, password_hash text)
        SECURITY DEFINER
        SET search_path = public, pg_temp
        LANGUAGE sql
        STABLE
        AS $$
            SELECT users.id, users.password_hash
            FROM users
            WHERE users.email = p_email;
        $$;
        """
    )
    op.execute("REVOKE ALL ON FUNCTION find_user_credentials(text) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION find_user_credentials(text) TO app_user")


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS find_user_credentials(text)")
