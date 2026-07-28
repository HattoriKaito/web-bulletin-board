import base64

from app.core.config import settings
from app.schemas.race_extra_info import ExtractedExtraInfoResult
from app.services.claude_client import get_client

_MAX_TOKENS = 4096

_EXTRA_INFO_PROMPT = (
    "添付された画像は、ボートレースの予想に役立つ追加情報（ピットレポート、"
    "コンピューター予想、その他の予想関連情報等）のスクリーンショットです。\n\n"
    "写っている内容を、以下の分類ごとに要約・抽出してください。\n"
    "- pit_report: ピットレポート（整備状況、選手のコメント、機力情報等）\n"
    "- computer_prediction: コンピューター予想（フォーメーション予想、指数、印等）\n"
    "- other: 上記に当てはまらないその他の予想関連情報\n\n"
    "1枚の画像に複数の情報源が写っている場合や、複数枚の画像がそれぞれ別の"
    "情報源の場合は、それぞれ別の項目に分けてください。\n\n"
    "特にpit_reportについては、1枚の画像・1つの情報源の中に複数艇分のコメントが"
    "含まれている場合、1艇1項目になるよう艇ごとに個別のitemへ分割してください"
    "（まとめて1項目にしないこと）。各項目のcontentの冒頭には対象の艇番号が"
    "分かるように「n号艇: 」の形式で明記してください。艇番号が特定できない"
    "全体的な内容（開催全体の傾向など）のみ、艇番号を付けずに1項目としてください。\n\n"
    "各項目のcontentは、原文の要点を保ちながら簡潔にまとめてください"
    "（後でAI予想生成時にそのまま読み込まれるため、要点が分かるように書くこと）。"
)


class ExtraInfoExtractionError(Exception):
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
    blocks.append({"type": "text", "text": _EXTRA_INFO_PROMPT})
    return blocks


def extract_extra_info(images: list[tuple[bytes, str]]) -> ExtractedExtraInfoResult:
    """ピットレポート・コンピューター予想等の画像からcategory・contentを抽出する。

    ユーザーが「画像から自動入力」を押したときのみ呼ばれる。抽出結果は
    フォームへのプリフィルにのみ使い、DBへは保存しない（ユーザーが確認・
    修正した上で既存の保存API（POST /races/{race_id}/extra-info）で保存する）。
    パース失敗時は1回だけリトライする。
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
                output_format=ExtractedExtraInfoResult,
            )
        except Exception as exc:  # ネットワークエラー・APIエラー等
            last_error = exc
            continue

        if response.stop_reason == "refusal":
            last_error = ExtraInfoExtractionError("AIが応答を拒否しました")
            continue
        if response.stop_reason == "max_tokens":
            last_error = ExtraInfoExtractionError(
                "AIの応答がトークン上限に達し、途中で終了しました"
            )
            continue
        if response.parsed_output is None:
            last_error = ExtraInfoExtractionError("AIの応答を解析できませんでした")
            continue
        if len(response.parsed_output.items) == 0:
            last_error = ExtraInfoExtractionError("追加情報を読み取れませんでした")
            continue

        return response.parsed_output

    raise ExtraInfoExtractionError(
        f"画像からの自動入力に失敗しました: {last_error}"
    ) from last_error
