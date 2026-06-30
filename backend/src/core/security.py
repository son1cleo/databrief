from jose import JWTError, jwt

from src.core.config import settings


class InvalidTokenError(Exception):
    pass


def decode_nextauth_token(token: str) -> dict:
    """Decode and verify a NextAuth JWT, signed with the shared NEXTAUTH_SECRET."""
    try:
        payload = jwt.decode(
            token,
            settings.nextauth_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

    if "email" not in payload:
        raise InvalidTokenError("Token missing email claim")

    return payload
