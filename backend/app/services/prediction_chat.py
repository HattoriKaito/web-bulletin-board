import json

from app.core.config import settings
from app.models import Prediction, PredictionChat
from app.services.claude_client import get_client


class ChatGenerationError(Exception):
    pass


def _build_system_prompt(prediction: Prediction) -> str:
    return (
        "あなたはボートレース（競艇）の3連単予想を支援するAIです。\n"
        "以下は、あなたが過去に生成したある予想の文脈です。ユーザーはその予想について\n"
        "深掘りする質問をしてきます。この文脈を踏まえた上で、具体的かつ簡潔に答えてください。\n"
        "必要であれば予想内容に対して懐疑的な見解を述べても構いませんが、その場合は\n"
        "根拠を明確にしてください。\n\n"
        "# この予想を生成した際の入力データ（出走表・オッズ・適用ルール等）\n"
        f"{json.dumps(prediction.input_snapshot, ensure_ascii=False, indent=2)}\n\n"
        "# 提案した買い目\n"
        f"{', '.join(prediction.suggested_bets)}\n\n"
        "# 短い根拠\n"
        f"{prediction.summary_reasoning}\n\n"
        "# 詳しい根拠\n"
        f"{prediction.detailed_reasoning}"
    )


def generate_chat_reply(
    prediction: Prediction, history: list[PredictionChat], user_message: str
) -> str:
    """予想の文脈とこれまでの会話履歴を踏まえて、ユーザーの質問への回答を生成する。

    stage別のAI予想生成とは異なり厳密な構造化出力を要求しないため、
    messages.parseではなくmessages.createを使う。対話機能でユーザーが
    すぐに再送信できるため、リトライは行わない。
    """
    system_prompt = _build_system_prompt(prediction)
    messages = [{"role": chat.role, "content": chat.content} for chat in history]
    messages.append({"role": "user", "content": user_message})

    try:
        response = get_client().messages.create(
            model=settings.claude_model,
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=system_prompt,
            messages=messages,
        )
    except Exception as exc:  # ネットワークエラー・APIエラー等
        raise ChatGenerationError(f"AIとの対話に失敗しました: {exc}") from exc

    if response.stop_reason == "refusal":
        raise ChatGenerationError("AIが応答を拒否しました")

    text = "".join(block.text for block in response.content if block.type == "text")
    if not text:
        raise ChatGenerationError("AIの応答を取得できませんでした")
    return text
