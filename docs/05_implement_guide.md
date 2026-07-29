# 05. 実装手順書（Implementation Guide）

> **本書の位置づけ**：本書は、第三者（レビュアー等）が本リポジトリを入手した状態から、
> ローカル環境での動作確認、および本番環境（Supabase／Render／Vercel）への
> デプロイまでを再現できることを目的とした手順書である。
> 本番デプロイの詳細な補足・トラブルシューティングは既存の `docs/08_deployment.md`
> （デプロイ専用の詳細手順書）も合わせて参照すること。

## 1. 技術スタック一覧

| 領域 | 技術 | 備考 |
|------|------|------|
| フロントエンド | React 19 + TypeScript + Vite | PWA対応・レスポンシブ |
| フロントエンド スタイリング | Tailwind CSS v4 | `@theme`によるnavyダークテーマのデザイントークン |
| フロントエンド ルーティング | react-router-dom v7 | |
| バックエンド | Python + FastAPI | |
| ORM / マイグレーション | SQLAlchemy 2.0 + Alembic | 生SQLの文字列結合は行わない方針 |
| DBドライバ | psycopg 3（binary） | |
| 認証 | 独自JWT（python-jose）＋ bcrypt（passlib） | Supabase Authは使わず自前実装 |
| データベース | PostgreSQL（本番：Supabase） | Row Level Security（RLS）で行単位のアクセス制御 |
| AI連携 | Anthropic Claude API（`anthropic` SDK） | 予想生成・画像からの自動入力（Vision）・AI対話 |
| デプロイ（フロント） | Vercel | |
| デプロイ（バックエンド） | Render（Blueプリント／`render.yaml`） | |
| デプロイ（DB） | Supabase（PostgreSQL、無料枠） | |
| ローカルDB | Docker上のPostgreSQL | 本番と同じスキーマ・RLSをローカルでも再現 |

主要なPythonパッケージのバージョンは `backend/requirements.txt`、
フロントエンドの依存関係は `frontend/package.json` を正とする。

## 2. リポジトリ構成（概要）

```
Boat/
├── backend/            # FastAPIアプリケーション
│   ├── app/
│   │   ├── api/routes/ # エンドポイント（races, auth, rules, predictions 等）
│   │   ├── core/       # 設定(config.py)・共通バリデーション等
│   │   ├── models/     # SQLAlchemyモデル
│   │   ├── schemas/    # Pydanticスキーマ
│   │   └── services/   # Claude API連携・集計ロジック等
│   ├── alembic/versions/ # マイグレーション（RLSポリシーも含む）
│   ├── requirements.txt
│   └── .env.example
├── frontend/            # React + Vite アプリケーション
│   ├── src/
│   │   ├── pages/       # 画面単位のコンポーネント
│   │   ├── components/  # 共通コンポーネント（BoatBadge等）
│   │   └── api/         # バックエンドAPI呼び出し
│   └── .env.example
├── db/
│   └── setup_rls.sql    # RLS設計の原本（実際の適用はalembicマイグレーション経由）
├── docs/                 # 本ドキュメント群
└── render.yaml           # Renderデプロイ用Blueprint
```

## 3. ローカル開発環境構築手順

### 3-1. 前提条件

- Python 3.13系（`backend/.venv` は3.13で作成済みの想定）
- Node.js 20系以降・npm
- Docker（ローカルPostgreSQL用）
- Git

### 3-2. リポジトリの取得

```bash
git clone <このリポジトリのURL>
cd Boat
```

### 3-3. ローカルPostgreSQLの準備（Docker）

本番のSupabaseと同じPostgreSQLをローカルでも使う。以下はDockerで最小構成を
立ち上げる例（コンテナ名・パスワードは任意のもので置き換えてよい）。

```bash
docker run --name boatai-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:16
```

### 3-4. `app_user`ロールの作成（RLS運用ロール）

本アプリはランタイム接続に `NOBYPASSRLS` の専用ロール `app_user` を使う設計（`db/setup_rls.sql`
参照）。本番のSupabase向け手順（`docs/08_deployment.md` 1章）と同じ内容を、ローカルの
Postgresに対しても一度だけ実行する。

```bash
docker exec -it boatai-postgres psql -U postgres -c "
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password' NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;
"
```

最後の`ALTER DEFAULT PRIVILEGES`を最初に実行しておくことで、以降マイグレーションで
新しいテーブルを追加するたびに`GRANT`をやり直す手間がなくなる（本番のSupabaseと同じ
運用にローカルも揃える）。

### 3-5. バックエンドのセットアップ

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate / macOS・Linux: source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
```

`.env` を開き、以下を編集する（ローカルDocker Postgresの場合の例）。

```
DB_USER=app_user
DB_PASSWORD=app_user_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres

MIGRATION_DB_USER=postgres
MIGRATION_DB_PASSWORD=postgres
MIGRATION_DB_HOST=localhost
MIGRATION_DB_PORT=5432
MIGRATION_DB_NAME=postgres

DB_SSLMODE=

JWT_SECRET=<適当な長いランダム文字列>
FRONTEND_ORIGIN=http://localhost:5173

ANTHROPIC_API_KEY=<Claude APIキー>
CLAUDE_MODEL=claude-opus-4-8
```

### 3-6. マイグレーションの適用

```bash
alembic upgrade head
```

これにより全テーブルの作成、RLSの有効化、各テーブルのオーナーシップに基づく
ポリシー作成（`alembic/versions/0002_setup_rls.py` 以降）、ログイン用の
`SECURITY DEFINER`関数作成までが一括で行われる。

### 3-7. バックエンドの起動

```bash
uvicorn app.main:app --reload --port 8000
```

`http://localhost:8000/health` にアクセスし `{"status": "ok"}` が返ることを確認する。

### 3-8. フロントエンドのセットアップ

```bash
cd frontend
npm install
cp .env.example .env
```

`.env` の `VITE_API_BASE_URL` はデフォルトの `http://localhost:8000` のままでよい
（バックエンドをローカルの8000番ポートで動かしている場合）。

```bash
npm run dev
```

`http://localhost:5173` にアクセスする。

### 3-9. 動作確認

1. サインアップ画面から新規ユーザーを作成する
2. レースを新規登録し、出走表（6艇）を入力・保存する
3. 直前情報・追加情報・オッズを入力する
4. 「AI予想を生成」を押し、Claude APIから買い目・根拠が返ってくることを確認する
   （`ANTHROPIC_API_KEY`が正しく設定されているかの確認を兼ねる）
5. 買い目確定・結果入力まで進め、収支サマリーが表示されることを確認する

## 4. 本番デプロイ手順（概要）

本番構成はフロントエンド＝Vercel、バックエンド＝Render、DB＝Supabase（すべて無料枠）。
詳細な手順・トラブルシューティング・接続方式の選定理由（Session pooler固定の理由等）は
`docs/08_deployment.md` に譲り、ここでは全体の流れのみ示す。

1. **Supabaseプロジェクトを作成**し、SQL Editorで`app_user`ロールを作成する
   （ローカル手順3-4と同内容。パスワードは本番用に別途生成する）。
2. **本番DBへマイグレーションを適用**する。シェルセッション限定の環境変数で
   `MIGRATION_DB_*`をSupabaseのSession pooler接続情報に一時的に上書きし、
   `alembic upgrade head`を実行する（`.env`には本番情報を書き残さない）。
3. **Renderにバックエンドをデプロイ**する。リポジトリ直下の`render.yaml`
   （Blueprint）を使い、`sync: false`の環境変数（`DB_PASSWORD`・`DB_HOST`・
   `MIGRATION_DB_PASSWORD`・`MIGRATION_DB_HOST`・`FRONTEND_ORIGIN`・
   `ANTHROPIC_API_KEY`）をRenderダッシュボードで入力する。
4. **Vercelにフロントエンドをデプロイ**する。Root Directoryを`frontend`に設定し、
   環境変数`VITE_API_BASE_URL`にRenderのバックエンドURLを設定する。
5. **CORS設定**：RenderのバックエンドサービスにVercelの本番URLを
   `FRONTEND_ORIGIN`として設定する（末尾スラッシュなし）。
6. **本番動作確認チェックリスト**を実施する（`docs/08_deployment.md` 6章に
   全項目を記載。サインアップ〜AI予想生成〜結果記録〜収支表示、および
   別ユーザーでのRLS分離確認まで一通り含む）。

## 5. 既知の制約・運用上の注意点

- **Renderの無料プランはアイドル時にスリープする**ため、久しぶりのアクセス時は
  初回応答が数十秒遅れることがある（許容する既知の制約）。
- **Supabaseの接続方式はSession poolerを使うこと**。Transaction pooler（6543番）は
  本アプリのRLSが依存する`SET LOCAL`のセッション単位の状態を保証しないため使用不可。
- **開発サーバー（`vite dev`）とプレビュービルド（`vite preview`）を同じポートで
  混在させない**こと。過去に、同ポートで動かした`vite preview`のService Workerが
  開発サーバー側に混線し、ログインできなくなる不具合が実際に発生している
  （詳細と対処は`frontend/README.md`を参照。現在は開発モード起動時に
  古いService Workerを自動解除する保険が`main.tsx`に入っている）。
- **Claude APIキーはバックエンドの環境変数でのみ管理**し、フロントエンドには
  一切露出させない。
