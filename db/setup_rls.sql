-- ============================================================
-- BoatAI: Row Level Security (RLS) 設定スクリプト
-- 前提：バックエンド(FastAPI)は独自JWT認証を行い、
--       Postgres接続時に SET LOCAL app.current_user_id を実行する。
--
-- 注意（NULLIFが必要な理由）：
-- コネクションプーリング環境（Supabase/PgBouncer等）では、一度でも
-- set_config('app.current_user_id', ..., true) が呼ばれた物理接続は、
-- その後の未認証コンテキストで current_setting('app.current_user_id', true)
-- が NULL ではなく空文字 '' を返すようになる（placeholder GUCが接続の
-- 生存期間中は残り続けるため）。空文字を ::int にキャストすると
-- 「invalid input syntax for type integer」で例外になり、本来単に
-- アクセス拒否されるべき場面でエラーになってしまう。
-- そのため全ポリシーで NULLIF(current_setting(...), '')::int を使い、
-- 空文字を明示的にNULLへ変換してから比較する。
-- ============================================================

-- ------------------------------------------------------------
-- 0. アプリ専用のDBロールを作成（BYPASSRLS権限を持たせない）
--    Supabaseのservice_roleキーは使わず、このロールで接続すること。
-- ------------------------------------------------------------
-- CREATE ROLE app_user WITH LOGIN PASSWORD 'ここに強力なパスワード' NOBYPASSRLS;
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- 上記はSupabaseダッシュボードのSQL Editorで初回のみ実行し、
-- 発行されたパスワードはバックエンドの.envにDB_USER/DB_PASSWORDとして保存する。

-- ------------------------------------------------------------
-- 1. 各テーブルでRLSを有効化
-- ------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. USERS テーブル：自分自身の行のみ参照・更新可能
-- ------------------------------------------------------------
CREATE POLICY users_self_select ON users
    FOR SELECT
    USING (id = NULLIF(current_setting('app.current_user_id', true), '')::int);

CREATE POLICY users_self_update ON users
    FOR UPDATE
    USING (id = NULLIF(current_setting('app.current_user_id', true), '')::int);

-- ユーザー登録（INSERT）は認証前に行われるため、
-- アプリ層（サインアップAPI）でのみ許可し、専用ポリシーは設けない運用にする。
-- 必要であれば以下のように「常に許可」する形にする（サインアップ専用エンドポイントに限定して呼び出すこと）。
CREATE POLICY users_signup_insert ON users
    FOR INSERT
    WITH CHECK (true);

-- ------------------------------------------------------------
-- 3. RACES テーブル：user_idが自分のものだけ操作可能
-- ------------------------------------------------------------
CREATE POLICY races_owner_all ON races
    FOR ALL
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::int)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::int);

-- ------------------------------------------------------------
-- 4. RULES テーブル：user_idが自分のものだけ操作可能
-- ------------------------------------------------------------
CREATE POLICY rules_owner_all ON rules
    FOR ALL
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::int)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::int);

-- ------------------------------------------------------------
-- 5. RACE_ENTRIES テーブル：races経由でuser_idを確認
-- ------------------------------------------------------------
CREATE POLICY race_entries_owner_all ON race_entries
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = race_entries.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = race_entries.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    );

-- ------------------------------------------------------------
-- 6. PREDICTIONS テーブル：races経由でuser_idを確認
-- ------------------------------------------------------------
CREATE POLICY predictions_owner_all ON predictions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = predictions.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = predictions.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    );

-- ------------------------------------------------------------
-- 7. PREDICTION_RULES テーブル：predictions経由でuser_idを確認
-- ------------------------------------------------------------
CREATE POLICY prediction_rules_owner_all ON prediction_rules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM predictions
            JOIN races ON races.id = predictions.race_id
            WHERE predictions.id = prediction_rules.prediction_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM predictions
            JOIN races ON races.id = predictions.race_id
            WHERE predictions.id = prediction_rules.prediction_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    );

-- ------------------------------------------------------------
-- 8. BETS テーブル：races経由でuser_idを確認
-- ------------------------------------------------------------
CREATE POLICY bets_owner_all ON bets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = bets.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = bets.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    );

-- ------------------------------------------------------------
-- 9. RESULTS テーブル：races経由でuser_idを確認
-- ------------------------------------------------------------
CREATE POLICY results_owner_all ON results
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = results.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM races
            WHERE races.id = results.race_id
              AND races.user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
        )
    );
