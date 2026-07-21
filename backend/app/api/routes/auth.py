from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db_unauthenticated
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse
from app.services.auth import authenticate_user, create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignupRequest, db: Session = Depends(get_db_unauthenticated)
) -> TokenResponse:
    try:
        user = create_user(db, payload.email, payload.password, payload.display_name)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="このメールアドレスは既に登録されています",
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, db: Session = Depends(get_db_unauthenticated)
) -> TokenResponse:
    user_id = authenticate_user(db, payload.email, payload.password)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません",
        )
    return TokenResponse(access_token=create_access_token(user_id))
