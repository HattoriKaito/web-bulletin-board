import anthropic

from app.core.config import settings

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    """ANTHROPIC_API_KEY未設定でもアプリ起動自体は落ちないよう、
    クライアントは初回呼び出し時に遅延生成する（モジュール読み込み時に
    生成すると、キー未設定の開発環境でapp import自体が失敗してしまう）。

    api_keyはsettings（pydantic-settings経由で.env/実環境変数の両方を読む）
    から明示的に渡す。素の anthropic.Anthropic() はOSのos.environのみを見るため、
    .envファイル経由で設定したキーが（os.environへは反映されないので）
    無視されてしまう問題があった。
    """
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)
    return _client
