from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import User


def create_user(db: Session, email: str, password: str, display_name: str) -> User:
    """新規ユーザーを作成する。

    users_self_select ポリシーはRETURNING句でも適用されるため、INSERTより先に
    app.current_user_id を新規ユーザー自身のidに設定しておく必要がある
    （さもないとINSERT自体は成功してもRETURNINGの可視性チェックで失敗する）。
    id採番(nextval)・set_config・INSERTは同一Session＝同一コネクション・
    同一トランザクション内で順番に実行する（sessionを跨いだり、途中でcommit
    してconnectionをプールに返却したりしないこと）。
    """
    new_id = db.execute(text("SELECT nextval('users_id_seq')")).scalar_one()
    db.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(new_id)},
    )

    user = User(
        id=new_id,
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
    )
    db.add(user)
    db.flush()
    return user


def authenticate_user(db: Session, email: str, password: str) -> int | None:
    """メールアドレス・パスワードを検証し、成功すればuser_idを返す。

    usersテーブルへの直接SELECTはRLSでブロックされるため、SECURITY DEFINER関数
    find_user_credentials 経由でid・password_hashのみを取得する。
    該当メールが存在しない場合もダミーハッシュでverify_passwordを実行し、
    応答時間からメール存在有無が推測されないようにする。
    """
    row = db.execute(
        text("SELECT id, password_hash FROM find_user_credentials(:email)"),
        {"email": email},
    ).first()

    password_hash = row.password_hash if row else None
    if not verify_password(password, password_hash):
        return None

    return row.id
