import base64
from typing import TypeVar

from app.core.config import settings
from app.schemas.race_entry_extraction import (
    ExtractedPreRaceResult,
    ExtractedPreRegistrationResult,
)
from app.services.claude_client import get_client

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGES = 6
MAX_IMAGE_BYTES = 10 * 1024 * 1024

_UNCERTAIN_INSTRUCTION = (
    "画像から読み取れなかった項目、または文字が不鮮明・数値の判読に自信が持てない"
    "項目は、値をnullにするのではなく可能な限り推測した値を入れた上で、"
    "uncertain_fieldsにそのフィールド名を追加してください"
    '（例: ["local_win_rate"]）。本当に手がかりが無い項目のみnullにしてください。\n'
    "6艇すべて（boat_number 1〜6）を必ず出力してください。複数枚の画像に情報が"
    "分かれている場合はすべて統合してください。"
)

_PRE_REGISTRATION_PROMPT = (
    "添付された画像（ボートレースの出走表等）から、6艇分の次の項目を抽出してください。\n"
    "- boat_number（1〜6の艇番。必須）\n"
    "- racer_name（選手名）\n"
    "- local_win_rate（当地勝率）\n"
    "- national_win_rate（全国勝率）\n"
    "- motor_win_rate（モーター勝率）\n"
    "- flag_status（F/L等のフラグ。無ければnull）\n\n" + _UNCERTAIN_INSTRUCTION
)

_PRE_RACE_PROMPT = (
    "添付された画像（ボートレースの直前情報等）から、6艇分の次の項目を抽出してください。\n"
    "- boat_number（1〜6の艇番。必須）\n"
    "- entry_course（進入コース、1〜6）\n"
    "- exhibition_time（展示タイム、秒）\n"
    "- weather_condition（天候）\n"
    "- wind_direction（風向）\n"
    "- wind_speed（風速、m/s）\n\n" + _UNCERTAIN_INSTRUCTION
)


class ExtractionError(Exception):
    pass


_ExtractionResultT = TypeVar(
    "_ExtractionResultT", ExtractedPreRegistrationResult, ExtractedPreRaceResult
)


def _build_content(images: list[tuple[bytes, str]], prompt: str) -> list[dict]:
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
    blocks.append({"type": "text", "text": prompt})
    return blocks


def extract_pre_registration(
    images: list[tuple[bytes, str]],
) -> ExtractedPreRegistrationResult:
    return _extract(images, _PRE_REGISTRATION_PROMPT, ExtractedPreRegistrationResult)


def extract_pre_race(images: list[tuple[bytes, str]]) -> ExtractedPreRaceResult:
    return _extract(images, _PRE_RACE_PROMPT, ExtractedPreRaceResult)


def _extract(
    images: list[tuple[bytes, str]],
    prompt: str,
    output_format: type[_ExtractionResultT],
) -> _ExtractionResultT:
    """Claude Vision APIを呼び出し、画像から構造化データを抽出する。

    ユーザーが「画像から自動入力」を押したときのみ呼ばれる。パース失敗
    （スキーマ不一致・6艇そろっていない・拒否・トークン上限・通信エラー）の
    場合は同一内容で1回だけリトライし、それでも失敗すればExtractionErrorを送出する。
    抽出結果はフォームへのプリフィルにのみ使い、DBへは保存しない
    （ユーザーが確認・修正した上で既存の保存APIから保存する）。
    """
    content = _build_content(images, prompt)

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = get_client().messages.parse(
                model=settings.claude_model,
                max_tokens=4096,
                thinking={"type": "adaptive"},
                messages=[{"role": "user", "content": content}],
                output_format=output_format,
            )
        except Exception as exc:  # ネットワークエラー・APIエラー等
            last_error = exc
            continue

        if response.stop_reason == "refusal":
            last_error = ExtractionError("AIが応答を拒否しました")
            continue
        if response.stop_reason == "max_tokens":
            last_error = ExtractionError(
                "AIの応答がトークン上限に達し、途中で終了しました"
            )
            continue
        if response.parsed_output is None:
            last_error = ExtractionError("AIの応答を解析できませんでした")
            continue

        boat_numbers = sorted(b.boat_number for b in response.parsed_output.boats)
        if boat_numbers != [1, 2, 3, 4, 5, 6]:
            last_error = ExtractionError(
                f"6艇分の抽出結果が得られませんでした（艇番: {boat_numbers}）"
            )
            continue

        return response.parsed_output

    raise ExtractionError(f"画像からの自動入力に失敗しました: {last_error}") from last_error
