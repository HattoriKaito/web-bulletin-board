# 05. デプロイ手順書（Supabase / Render / Vercel）

本番構成：フロントエンド＝Vercel、バックエンド＝Render、DB＝Supabase（すべて無料枠）。
このドキュメントの手順はすべて**ユーザー自身が実行する**想定で書かれている
（Claude Codeはこれらの外部サービスの認証情報を持たないため、実行できない）。

---

## 0. Supabaseの接続方式について（最初に必ず読むこと）

Supabaseは1つのプロジェクトに対して3種類の接続方法を提供している（Project Settings →
Database → Connect）。**このアプリでは以下の理由から「Session pooler」を使うこと。**

| 接続方式 | ポート | このアプリで使えるか |
|---|---|---|
| Direct connection | 5432 | 使えるが、IPv6のみのことが多く、Render等IPv4環境から届かない場合がある |
| **Session pooler** | 5432 | **推奨**。IPv4互換で、`SET LOCAL`・プリペアドステートメント等セッション単位の機能もフル対応 |
| Transaction pooler | 6543 | **使用不可**。本アプリのRLSは各リクエストの冒頭で `SET LOCAL app.current_user_id` を実行する設計（[[db/setup_rls.sql]]参照）だが、Transaction poolerはトランザクションをまたぐセッション状態やプリペアドステートメントの扱いが不安定で、意図しない挙動やエラーの原因になる |

Session poolerのユーザー名は `<ロール名>.<プロジェクトref>`（例：`app_user.abcdefghijk`）という
特殊な形式になる。ホスト名・ポート・ユーザー名は必ずSupabaseダッシュボードに表示された
値をそのままコピーすること（リージョンやホスト名のパターンはプロジェクトごとに異なる）。

`MIGRATION_DB_*`（後述）も同じ理由でSession poolerを使う。

---

## 1. Supabase本番プロジェクトでのロール作成

### 1-1. 作成するロールについて

- **`app_user`**：新規に作成する。バックエンドの通常のランタイム接続はすべてこのロールを使う。
  `NOBYPASSRLS` で作成するため、Supabaseの `service_role` キーは絶対に使わないこと
  （`service_role` はRLSを素通りする）。
- **マイグレーション用ロール**：新規作成は不要。Supabaseプロジェクトに最初から存在する
  `postgres` ロール（テーブルオーナー権限を持つ）をそのまま使う。ローカル開発の
  `MIGRATION_DB_USER=postgres` と同じ位置づけで、`backend/.env.example` の設計を踏襲している。

### 1-2. 実行するSQL

Supabaseダッシュボード → SQL Editor で、**マイグレーション実行前に**以下を1回だけ実行する。
`__APP_USER_PASSWORD__` の部分はあなたが生成した強力なパスワードに置き換えること。

```sql
-- 1. アプリ専用ロールを作成（NOBYPASSRLS = RLSを迂回できない）
CREATE ROLE app_user WITH LOGIN PASSWORD '__APP_USER_PASSWORD__' NOBYPASSRLS;

-- 2. スキーマ利用権限
GRANT USAGE ON SCHEMA public TO app_user;

-- 3. 既存テーブル・シーケンスへの権限
--    （この時点ではテーブルはまだ存在しないため実質no-opだが、念のため実行しておく）
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 4. 今後 alembic upgrade head（postgresロールで実行）が新しく作るテーブル・
--    シーケンスにも、追加のGRANTなしで自動的に同じ権限が付与されるようにする。
--    （これが無いと、将来マイグレーションを追加するたびに3を手動で再実行する必要がある）
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

**重要（実行順序）**：`alembic upgrade head` の中の `0003_login_lookup_function.py` は
`GRANT EXECUTE ON FUNCTION find_user_credentials(text) TO app_user` を実行する。
`app_user` ロールが存在しない状態でこのマイグレーションを実行すると失敗するため、
**上記SQLを先に実行してから** 次のステップに進むこと。

実行後、Supabaseダッシュボードの Database → Roles で `app_user` が作成され、
`BYPASSRLS` が付与されていないことを確認する。

---

## 2. `alembic upgrade head` を本番DBに対して実行する

ローカルの `backend/.env` を書き換えるのではなく、**そのシェルセッション限定の環境変数**で
本番接続情報を一時的に上書きして実行する（`.env` に本番の秘密情報を書き残さないため）。

PowerShellの例：

```powershell
cd backend
.\.venv\Scripts\Activate.ps1

# --- ここから、このPowerShellウィンドウを閉じるまでの一時的な上書き ---
$env:MIGRATION_DB_USER     = "postgres.<プロジェクトref>"   # Session poolerのユーザー名形式
$env:MIGRATION_DB_PASSWORD = "<Supabaseプロジェクトのpostgresパスワード>"
$env:MIGRATION_DB_HOST     = "<Session poolerのホスト名>"    # 例：aws-0-xxxxx.pooler.supabase.com
$env:MIGRATION_DB_PORT     = "5432"
$env:MIGRATION_DB_NAME     = "postgres"
$env:DB_SSLMODE            = "require"

alembic upgrade head
```

成功すると `alembic_version` テーブルが本番DBに作成され、最新リビジョン（現時点で `0005`）が
記録される。実行後、Supabase SQL Editorで以下を確認するとよい：

```sql
select * from alembic_version;
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

`rowsecurity` が全テーブルで `true` になっていればRLSが有効化されている。

このPowerShellウィンドウを閉じれば、上記の環境変数は破棄され `backend/.env`（ローカル用）には
一切影響しない。

---

## 3. Renderへのバックエンドデプロイ

リポジトリ直下に [[render.yaml]] を追加済み（Render Blueprint形式）。内容：

- `rootDir: backend` — モノレポ内の `backend/` をビルド起点にする
- `buildCommand: pip install -r requirements.txt`
- `startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- `healthCheckPath: /health`
- 環境変数のうち秘密情報・環境固有の値（`DB_PASSWORD` `DB_HOST` `MIGRATION_DB_PASSWORD`
  `MIGRATION_DB_HOST` `FRONTEND_ORIGIN` `ANTHROPIC_API_KEY` など）は `sync: false` にしてあり、
  render.yaml自体には値を含めていない。Renderダッシュボード側で入力する。

### 手順

1. Renderダッシュボード → New → Blueprint → このGitHubリポジトリを選択。
   `render.yaml` が自動検出され、`boatai-backend` サービスが提案される。
2. 作成前後で、`sync: false` になっている環境変数に値を入力する：
   - `DB_USER` は render.yaml側で `app_user` 固定済み
   - `DB_PASSWORD` … ステップ1で生成した `app_user` のパスワード
   - `DB_HOST` … SupabaseのSession poolerホスト名
   - `MIGRATION_DB_PASSWORD` … Supabaseプロジェクトの `postgres` パスワード
   - `MIGRATION_DB_HOST` … `DB_HOST` と同じSession poolerホスト名
   - `FRONTEND_ORIGIN` … いったん空でデプロイし、後述のVercelデプロイ完了後に本番URLを入力して再デプロイでもよい
   - `ANTHROPIC_API_KEY` … Claude APIキー
   - `JWT_SECRET` は `generateValue: true` によりRenderが自動生成するため入力不要
3. デプロイ完了後、`https://<サービス名>.onrender.com/health` が `{"status":"ok"}` を返すことを確認。

補足：Renderの無料プランはアイドル時にスリープするため、久しぶりのアクセス時は
初回応答が数十秒遅れることがある（既知の制約として許容する）。

---

## 4. Vercelへのフロントエンドデプロイ

`frontend/` に [[vercel.json]] を追加済み（SPAのため、存在しないパスへのアクセスも
`index.html` にフォールバックさせるrewriteルールのみ）。

### 手順

1. Vercelダッシュボード → Add New → Project → このリポジトリをインポート。
2. **Root Directory** を `frontend` に設定する（モノレポのため必須）。
   Framework Presetは Vite が自動検出される。
3. Environment Variables に以下を追加（Production向け）：
   - `VITE_API_BASE_URL` = RenderバックエンドのURL（例：`https://boatai-backend.onrender.com`）
4. デプロイを実行し、発行された本番URL（例：`https://boatai.vercel.app`）を控える。

---

## 5. CORS設定（本番Vercel Originの許可）

コード側はすでに `FRONTEND_ORIGIN` 環境変数1つを `allow_origins` に渡す実装になっている
（`backend/app/main.py`）。追加のコード変更は不要で、**Render側の環境変数を設定するだけ**でよい。

1. ステップ4で確定したVercel本番URL（例：`https://boatai.vercel.app`）を、
   Renderダッシュボードの `boatai-backend` サービス → Environment → `FRONTEND_ORIGIN` に設定する。
   末尾にスラッシュを付けないこと（`https://boatai.vercel.app` であって
   `https://boatai.vercel.app/` ではない）。
2. 保存すると自動的に再デプロイされる。

**既知の制約**：VercelのPreview Deployment（PRごとに発行されるランダムなURL）は
`FRONTEND_ORIGIN` に含まれないため、そこからのAPI呼び出しはCORSでブロックされる。
今回は本番Originのみの許可が要件のため、これは想定どおりの挙動。

---

## 6. 本番URLでの動作確認チェックリスト

以下はすべてあなたが本番URL（Vercelのフロントエンド）にアクセスして確認する。

- [ ] フロントエンドURLにアクセスし、ログイン画面が表示される
- [ ] 新規ユーザーでサインアップできる（signup → JWT発行 → レース一覧へ遷移）
- [ ] ログアウト後、同じユーザーで再ログインできる
- [ ] レースを新規登録できる（レース一覧 → 新規レース登録）
- [ ] 出走表（6艇）を入力・保存し、リロードしても内容が保持されている
- [ ] 直前情報・オッズを入力・保存できる
- [ ] 「AI予想を生成」で実際にClaude APIが呼ばれ、買い目・要約・詳細が表示される
      （Renderの環境変数 `ANTHROPIC_API_KEY` が正しく設定されているかの確認を兼ねる）
- [ ] 買い目確定 → 結果入力まで一通り進め、収支（実際 / AI提案）が正しく表示される
- [ ] 収支サマリー画面が表示される
- [ ] ルール管理画面で作成・is_active切り替え・編集・削除ができる
- [ ] 別ユーザーでサインアップし、最初のユーザーのレース・ルールが一切見えないことを確認
      （RLSが本番でも機能していることの確認）
- [ ] ブラウザの開発者ツール Network タブで、APIリクエストがCORSエラーなく成功している
- [ ] スマートフォンの実機（またはブラウザのモバイルシミュレータ）でホーム画面に追加し、
      スタンドアロン表示で起動できる（Step 9のPWA設定の本番確認）
- [ ] Render無料プランのスリープから復帰した直後のアクセスでも、
      （時間はかかっても）正常に応答が返る

すべて確認できたらStep 10は完了。
