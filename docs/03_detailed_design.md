# 詳細設計書（Detailed Design）

## 1. システム構成

- フロントエンド：React（PWA対応、レスポンシブデザイン）
- バックエンド：Python（FastAPI）
- データベース：Supabase（PostgreSQL）
- AI連携：Claude API（予想生成・チャット深掘り機能）
- デプロイ：Vercel（フロント）／Render（バックエンド）／Supabase（DB）

## 2. データベース設計（ER図）

```mermaid
erDiagram
    USERS ||--o{ RACES : "registers"
    USERS ||--o{ RULES : "owns"
    RACES ||--o{ RACE_ENTRIES : "has"
    RACES ||--o{ PREDICTIONS : "has"
    RACES ||--o{ BETS : "has"
    RACES ||--o{ RESULTS : "has"
    PREDICTIONS ||--o{ PREDICTION_RULES : "applies"
    RULES ||--o{ PREDICTION_RULES : "used_in"

    USERS {
        int id PK
        string email
        string password_hash
        string display_name
        datetime created_at
    }

    RACES {
        int id PK
        int user_id FK
        string venue
        int race_number
        date race_date
        string race_type
        datetime created_at
    }

    RACE_ENTRIES {
        int id PK
        int race_id FK
        int boat_number
        string racer_name
        float local_win_rate
        float national_win_rate
        float motor_win_rate
        string flag_status
        int entry_course
        float exhibition_time
        string weather_condition
        string wind_direction
        float wind_speed
    }

    PREDICTIONS {
        int id PK
        int race_id FK
        string stage
        string suggested_bets
        text ai_reasoning
        datetime created_at
    }

    PREDICTION_RULES {
        int id PK
        int prediction_id FK
        int rule_id FK
    }

    RULES {
        int id PK
        int user_id FK
        text rule_text
        string category
        boolean is_active
        datetime created_at
    }

    BETS {
        int id PK
        int race_id FK
        string bet_combination
        int amount
        boolean is_ai_suggested
        datetime created_at
    }

    RESULTS {
        int id PK
        int race_id FK
        string finishing_order
        int payout_amount
        datetime created_at
    }
```

### テーブル補足
- `RACES.race_type` は「一般戦／SG／G1」等を格納し、レース種別ごとの精度集計に利用する。
- `PREDICTIONS.stage` は「entry_confirmed（出走表確定時点）」「pre_race（直前情報公開時点）」「final（締切直前）」の3値を想定。
- `BETS.is_ai_suggested` によって、実際の買い目とAI提案買い目を区別し、収支シミュレーション比較に利用する。
- `RULES` はユーザーごとに独立して管理し、`is_active` フラグでAI予想への反映有無を切り替え可能とする。

## 3. 画面遷移図

```mermaid
flowchart TD
    A[ログイン画面] --> B[ダッシュボード]
    B --> C[レース一覧画面]
    B --> D[ルール管理画面]
    B --> E[収支サマリー画面]
    C --> F[レース登録画面]
    F --> G[出走表入力画面]
    G --> H[AI予想結果画面_出走表確定時点]
    H --> I[直前情報入力画面]
    I --> J[AI予想結果画面_直前情報時点]
    J --> K[オッズ入力画面]
    K --> L[AI予想結果画面_締切直前]
    L --> M[買い目確定・記録画面]
    M --> N[結果入力画面]
    N --> O[振り返り・教訓登録画面]
    H --> P[AI対話・深掘り画面]
    J --> P
    L --> P
    O --> E
```

## 4. AI予想生成フロー（概要）

1. ユーザーが出走表を入力すると、システムはRules（is_active=trueのもの）と出走表データをまとめてClaude APIに送信し、第1段階の予想（買い目・サマリー根拠）を生成する。
2. 直前情報が入力されると、第1段階の予想結果＋新規データを合わせて再度Claude APIに送信し、第2段階の予想に更新する。
3. 最終オッズが入力されると、同様に第3段階（最終）の予想を生成し、これを「確定予想」としてBETSテーブルに保存可能にする。
4. 各段階の予想はPREDICTIONSテーブルに履歴として保存し、後から「予想がどう変化したか」を振り返れるようにする。

## 5. セキュリティ防衛仕様

| 項目 | 対応方針 |
|------|----------|
| パスワード保護 | bcryptによるハッシュ化を実施し、平文保存は行わない |
| 認証方式 | JWT（JSON Web Token）によるセッション管理。トークンの有効期限を設定し、期限切れ時は再ログインを要求 |
| アクセス制御 | 全APIエンドポイントでユーザーIDに基づくデータフィルタリングを実施し、他ユーザーのレース・ルール・収支データへのアクセスを禁止 |
| 通信の暗号化 | フロント・バックエンド間の通信はHTTPS必須（Vercel／Renderの標準証明書を利用） |
| SQLインジェクション対策 | ORM（SQLAlchemy等）を使用し、生SQLの文字列結合を行わない |
| APIキー管理 | Claude APIキーはバックエンドの環境変数として管理し、フロントエンドには一切露出させない |
| CORS設定 | フロントエンドのオリジンのみ許可するCORSポリシーを設定 |
| 入力値検証 | Pydanticモデル等によるリクエストボディのバリデーションを全エンドポイントで実施 |

## 6. モバイル対応（PWA）方針
- manifest.jsonとService Workerを実装し、ホーム画面への追加・オフラインキャッシュの基本対応を行う。
- レイアウトはTailwind CSS等を用いてモバイルファーストで設計し、レース入力・収支確認等の主要操作をスマートフォンでも快適に行えるようにする。
