from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# ランタイム接続。app_user（NOBYPASSRLS）を使うこと。
# service_role等のBYPASSRLS権限を持つロールでこのenv経由のURLを使うと
# RLSポリシーが全て素通りしてしまうため、DB_USERには必ずapp_userを設定する。
engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(Session, "after_begin")
def _apply_rls_context(session: Session, transaction, connection) -> None:
    """トランザクション開始直後に app.current_user_id をセットする。

    setup_rls.sql のポリシーは current_setting('app.current_user_id', true) を
    参照するため、SET LOCAL相当のset_config(..., true)をトランザクションスコープで
    毎回設定する必要がある。session.info['user_id'] が未設定（未認証コンテキスト）の
    場合は何もせず、RLSはデフォルト拒否のまま働く。
    """
    user_id = session.info.get("user_id")
    if user_id is None:
        return
    connection.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": str(user_id)},
    )
