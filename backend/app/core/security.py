from jose import JWTError, jwt

from app.core.config import settings


class TokenError(Exception):
    pass


def decode_access_token(token: str) -> int:
    """JWTを検証し、'sub'クレームからuser_idを取り出す。

    署名・有効期限が不正な場合はTokenErrorを送出する。
    トークン発行（ログイン/サインアップ）自体は認証機能実装（次ステップ）で扱う。
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
