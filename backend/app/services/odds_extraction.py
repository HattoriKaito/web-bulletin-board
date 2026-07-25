import base64

from app.core.config import settings
from app.schemas.odds_extraction import ExtractedOddsResult
from app.services.claude_client import get_client

# 最大120通り分のcombination/odds_value/uncertainを返しうるため、
# 6艇分の出走表抽出（4096）より大きめのトークン上限を確保する。
_MAX_TOKENS = 8192

_ODDS_PROMPT = (
    "添付された画像（ボートレースの3連単オッズ表）から、写っている組み合わせと"
    "オッズ値をすべて抽出してください。3連単は最大120通り（6艇から3艇を選ぶ順列）"
    "あります。表がマス目状（1着艇ごとの表など）でも、リスト状でも構いません。"
    "見えている範囲で、可能な限りすべての組み合わせを抽出してください。\n\n"
    "各行の形式：\n"
    "- combination: 「1-2-3」のように1〜6の3艇をハイフンで区切った文字列\n"
    "- odds_value: オッズの数値（例: 5.4）\n\n"
    "文字が不鮮明・数値の判読に自信が持てない行は、値をnullにするのではなく"
    "可能な限り推測した値を入れた上で、その行のuncertainをtrueにしてください。"
    "複数枚の画像に分かれている場合はすべて統合してください。"
)


class OddsExtractionError(Exception):
    pass


def _build_content(images: list[tuple[bytes, str]]) -> list[dict]:
    blocks = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64.b64encode(data).decode("ascii"),
            },
        }
        for data, media_type in images
    ]
    blocks.append({"type": "text", "text": _ODDS_PROMPT})
    return blocks


def extract_odds(images: list[tuple[bytes, str]]) -> ExtractedOddsResult:
    """オッズ表の画像からcombination・odds_valueの一覧を抽出する。

    ユーザーが「画像から自動入力」を押したときのみ呼ばれる。抽出結果は
    フォームへのプリフィルにのみ使い、DBへは保存しない（ユーザーが確認・
    修正した上で既存の「オッズを記録」（POST /races/{race_id}/odds）で
    保存する）。パース失敗時は1回だけリトライする。
    """
    content = _build_content(images)

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = get_client().messages.parse(
                model=settings.claude_model,
                max_tokens=_MAX_TOKENS,
                thinking={"type": "adaptive"},
                messages=[{"role": "user", "content": content}],
                output_format=ExtractedOddsResult,
            )
        except Exception as exc:  # ネットワークエラー・APIエラー等
            last_error = exc
            continue

        if response.stop_reason == "refusal":
            last_error = OddsExtractionError("AIが応答を拒否しました")
            continue
        if response.stop_reason == "max_tokens":
            last_error = OddsExtractionError(
                "AIの応答がトークン上限に達し、途中で終了しました"
            )
            continue
        if response.parsed_output is None:
            last_error = OddsExtractionError("AIの応答を解析できませんでした")
            continue
        if len(response.parsed_output.rows) == 0:
            last_error = OddsExtractionError("オッズを1件も読み取れませんでした")
            continue

        return response.parsed_output

    raise OddsExtractionError(
        f"画像からの自動入力に失敗しました: {last_error}"
    ) from last_error
