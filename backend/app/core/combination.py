"""3連単の組み合わせ文字列（例: "1-2-3"）に関する共通ロジック。

odds・predictions（AI提案）・bets・resultsの4箇所すべてで同じ形式
（1〜6の3艇、ハイフン区切り、重複不可）を扱うため、ここに集約する。
"""

import re

COMBINATION_PATTERN = re.compile(r"^[1-6]-[1-6]-[1-6]$")

# 全角数字・全角ハイフン・全角マイナスを半角に変換してから比較するための変換表。
# 着順とbet_combinationの完全一致判定で、見た目は同じでも文字コードが違うために
# 一致しない、という事故を防ぐ。
_ZENKAKU_TO_HANKAKU = str.maketrans("０１２３４５６７８９－ー−", "0123456789---")


def validate_combination(value: str) -> str:
    if not COMBINATION_PATTERN.match(value):
        raise ValueError('組み合わせは"1-2-3"のように1〜6の3艇で指定してください')
    boats = value.split("-")
    if len(set(boats)) != 3:
        raise ValueError("組み合わせの3艇は重複できません")
    return value


def normalize_combination(value: str) -> str:
    """全角→半角変換と前後空白除去を行う。的中判定の完全一致比較の前段で使う。"""
    return value.translate(_ZENKAKU_TO_HANKAKU).strip()
