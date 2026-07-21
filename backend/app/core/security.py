from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ログイン時、該当メールアドレスが存在しない場合でもbcrypt検証を必ず1回走らせて
# 応答時間を一定にするためのダミーハッシュ（メール存在有無のタイミング推測を防ぐ）。
_DUMMY_PASSWORD_HASH = _pwd_context.hash("dummy-password-for-timing-safety")


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    return _pwd_context.verify(password, password_hash or _DUMMY_PASSWORD_HASH)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> int:
    """JWTを検証し、'sub'クレームからuser_idを取り出す。

    署名・有効期限が不正な場合はTokenErrorを送出する。
    """
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError as exc:
        raise TokenError("invalid token") from exc

    subject = payload.get("sub")
    if subject is None:
        raise TokenError("token missing subject")

    try:
        return int(subject)
    except (TypeError, ValueError) as exc:
        raise TokenError("token subject is not a user id") from exc
