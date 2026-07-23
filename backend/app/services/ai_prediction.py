import json
from typing import Any

from pydantic import BaseModel, Field

from app.core.combination import COMBINATION_PATTERN
from app.core.config import settings
from app.models import Odds, Race, RaceEntry, Rule
from app.services.claude_client import get_client

STAGE_ORDER = ["entry_confirmed", "pre_race", "final"]

_STAGE_LABELS = {
    "entry_confirmed": "出走表確定時点",
    "pre_race": "直前情報公開時点",
    "final": "締切直前（最終オッズ確定時点）",
}


class AIGenerationError(Exception):
    pass


class PredictionOutput(BaseModel):
    suggested_bets: list[str] = Field(
        description='3連単の買い目5点。例: ["1-2-3", "1-3-2", "2-1-3", "1-2-4", "2-1-4"]'
    )
    summary_reasoning: str = Field(
        description="レース一覧・履歴画面に表示する短い根拠（2〜3文程度）"
    )
    detailed_reasoning: str = Field(
        description="艇番ごとの狙い目・消し目とその理由を詳しく説明した文章"
    )


def _entry_to_dict(entry: RaceEntry) -> dict[str, Any]:
    return {
        "boat_number": entry.boat_number,
        "racer_name": entry.racer_name,
        "local_win_rate": entry.local_win_rate,
        "national_win_rate": entry.national_win_rate,
        "motor_win_rate": entry.motor_win_rate,
        "flag_status": entry.flag_status,
        "entry_course": entry.entry_course,
        "exhibition_time": entry.exhibition_time,
        "weather_condition": entry.weather_condition,
        "wind_direction": entry.wind_direction,
        "wind_speed": entry.wind_speed,
    }


def build_input_snapshot(
    race: Race,
    entries: list[RaceEntry],
    odds: list[Odds],
    active_rules: list[Rule],
    stage: str,
) -> dict[str, Any]:
    return {
        "race": {
            "venue": race.venue,
            "race_number": race.race_number,
            "race_date": race.race_date.isoformat(),
            "race_type": race.race_type,
        },
        "stage": stage,
        "entries": [
            _entry_to_dict(e) for e in sorted(entries, key=lambda e: e.boat_number)
        ],
        "odds": [
            {
                "stage": o.stage,
                "combination": o.combination,
                "odds_value": o.odds_value,
                "recorded_at": o.recorded_at.isoformat(),
            }
            for o in odds
        ],
        "active_rules": [
            {"rule_text": r.rule_text, "category": r.category} for r in active_rules
        ],
    }


def _build_system_prompt(stage: str, active_rules: list[Rule]) -> str:
    if active_rules:
        rules_text = "\n".join(
            f"- {r.rule_text}" + (f"（カテゴリ: {r.category}）" if r.category else "")
            for r in active_rules
        )
    else:
        rules_text = "（現時点で有効なルールは登録されていません）"

    return (
        "あなたはボートレース（競艇）の3連単予想を支援するAIです。\n"
        "与えられた出走表・直前情報・オッズ・ユーザー独自のルールをもとに、\n"
        "3連単の買い目を5点（1点200円、合計1,000円想定）提案してください。\n\n"
        f"# 現在の予想段階\n{_STAGE_LABELS[stage]}\n\n"
        "# ユーザーの分析ルール（過去のレースで検証してきた経験則。優先して考慮すること）\n"
        f"{rules_text}\n\n"
        "# 出力の指針\n"
        '- suggested_bets: "1-2-3" の形式（1着-2着-3着の艇番）で5点。重複不可、'
        "確度が高いと考える順に並べる\n"
        "- summary_reasoning: レース一覧に表示する短い根拠。2〜3文程度で簡潔に\n"
        "- detailed_reasoning: 「もっと詳しく」表示用。艇番ごとの狙い目・消し目と"
        "その理由を具体的に"
    )


def _validate_bets(bets: list[str]) -> None:
    if len(bets) != 5:
        raise ValueError(f"買い目は5点である必要があります（{len(bets)}点でした）")
    seen: set[str] = set()
    for combo in bets:
        if not COMBINATION_PATTERN.match(combo):
            raise ValueError(f"買い目の形式が不正です: {combo}")
        boats = combo.split("-")
        if len(set(boats)) != 3:
            raise ValueError(f"買い目の3艇が重複しています: {combo}")
        if combo in seen:
            raise ValueError(f"買い目が重複しています: {combo}")
        seen.add(combo)


def generate_prediction(
    race: Race,
    entries: list[RaceEntry],
    odds: list[Odds],
    active_rules: list[Rule],
    stage: str,
) -> tuple[PredictionOutput, dict[str, Any]]:
    """Claude APIを呼び出し、構造化された予想を生成する。

    ユーザーが明示的に「AI予想を生成」を押したときのみ呼ばれる
    （データ入力のたびに自動生成はしない）。
    パース失敗（スキーマ不一致・買い目バリデーション失敗・拒否・トークン上限による
    途中終了・通信エラー）の場合は同一内容で1回だけリトライし、
    それでも失敗すればAIGenerationErrorを送出する。
    """
    input_snapshot = build_input_snapshot(race, entries, odds, active_rules, stage)
    system_prompt = _build_system_prompt(stage, active_rules)
    user_message = json.dumps(input_snapshot, ensure_ascii=False, indent=2)

    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = get_client().messages.parse(
                model=settings.claude_model,
                max_tokens=4096,
                thinking={"type": "adaptive"},
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                output_format=PredictionOutput,
            )
        except Exception as exc:  # ネットワークエラー・APIエラー等
            last_error = exc
            continue

        if response.stop_reason == "refusal":
            last_error = AIGenerationError("AIが応答を拒否しました")
            continue
        if response.stop_reason == "max_tokens":
            last_error = AIGenerationError(
                "AIの応答がトークン上限に達し、途中で終了しました"
            )
            continue
        if response.parsed_output is None:
            last_error = AIGenerationError("AIの応答を解析できませんでした")
            continue

        try:
            _validate_bets(response.parsed_output.suggested_bets)
        except ValueError as exc:
            last_error = exc
            continue

        return response.parsed_output, input_snapshot

    raise AIGenerationError(f"AI予想の生成に失敗しました: {last_error}") from last_error
