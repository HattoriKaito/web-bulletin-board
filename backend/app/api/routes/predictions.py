from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Prediction, PredictionChat
from app.schemas.prediction_chat import (
    PredictionChatMessageCreate,
    PredictionChatMessageRead,
    PredictionChatReply,
)
from app.services.prediction_chat import ChatGenerationError, generate_chat_reply

router = APIRouter(prefix="/predictions", tags=["predictions"])


def _get_owned_prediction(db: Session, prediction_id: int) -> Prediction:
    """自分が所有するレースに紐づく予想を取得する。

    RLS（predictions_owner_all、races経由でuser_idを確認）が既に
    他ユーザーの行を不可視にしているため、ここでの存在チェックは
    同時にオーナーチェックにもなっている。
    """
    prediction = db.get(Prediction, prediction_id)
    if prediction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="予想が見つかりません"
        )
    return prediction


def _list_chat_messages(db: Session, prediction_id: int) -> list[PredictionChat]:
    return (
        db.query(PredictionChat)
        .filter(PredictionChat.prediction_id == prediction_id)
        .order_by(PredictionChat.created_at, PredictionChat.id)
        .all()
    )


@router.get("/{prediction_id}/chat", response_model=list[PredictionChatMessageRead])
def list_prediction_chat(
    prediction_id: int, db: Session = Depends(get_db)
) -> list[PredictionChat]:
    _get_owned_prediction(db, prediction_id)
    return _list_chat_messages(db, prediction_id)


@router.post(
    "/{prediction_id}/chat",
    response_model=PredictionChatReply,
    status_code=status.HTTP_201_CREATED,
)
def create_prediction_chat_message(
    prediction_id: int,
    payload: PredictionChatMessageCreate,
    db: Session = Depends(get_db),
) -> PredictionChatReply:
    """予想への質問を受け取り、AIの回答を生成してユーザー発言・AI発言の両方を保存する。

    生成に失敗した場合はどちらも保存しない（ユーザーがそのまま再送信できるように、
    中途半端な履歴を残さない）。
    """
    prediction = _get_owned_prediction(db, prediction_id)
    history = _list_chat_messages(db, prediction_id)

    try:
        reply_text = generate_chat_reply(prediction, history, payload.message)
    except ChatGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    user_message = PredictionChat(
        prediction_id=prediction_id, role="user", content=payload.message
    )
    assistant_message = PredictionChat(
        prediction_id=prediction_id, role="assistant", content=reply_text
    )
    db.add_all([user_message, assistant_message])
    db.flush()

    return PredictionChatReply(user_message=user_message, assistant_message=assistant_message)
