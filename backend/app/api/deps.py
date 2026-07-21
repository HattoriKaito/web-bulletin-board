from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TokenError, decode_access_token
from app.db.session import SessionLocal

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> int:
    """JWTを検証し、user_idを返す。認証必須のエンドポイント用。"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="認証が必要です"
        )
    try:
        return decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="トークンが無効です"
        ) from exc


def get_db(user_id: int = Depends(get_current_user_id)) -> Generator[Session, None, None]:
    """認証済みリクエスト用のDBセッション。

    session.info['user_id'] をセットし、トランザクション開始時に
    app/db/session.py の after_begin イベントで
    set_config('app.current_user_id', ...) が実行されるようにする。
    これによりRLSポリシーが本人のデータのみを対象にする。
    """
    db = SessionLocal()
    db.info["user_id"] = user_id
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db_unauthenticated() -> Generator[Session, None, None]:
    """未認証で使うDBセッション（サインアップ・ログイン専用）。

    app.current_user_id は設定されないため、RLSはデフォルト拒否で働く。
    usersテーブルのINSERTのみ users_signup_insert ポリシーで許可される。
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
