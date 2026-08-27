# SprintScope

Supabase、Go、および Vanilla JS で構築された、動画投稿機能付きの掲示板、コーチング質問箱、および決済機能を備えたフルスタック Web アプリケーションです。

## プロジェクト概要

SprintScope は、ユーザーが自身の動画（陸上競技などのスプリントフォームなど）を投稿し、コメントでのやり取りを行えるほか、有料のコーチング（質問箱）機能を通じてコーチから動画付きのアドバイスを受け取ることができるサービスです。

### 主な機能

- **掲示板 (Board)**:
  - 投稿の作成・削除・一覧表示（動画のサムネイル・URLを含む）
  - コメントの投稿・編集・削除・返信
  - 不適切な動画/コメントの通報、および問い合わせフォームの送信
- **質問箱 (Question Box)**:
  - ユーザーからの質問投稿（プラン選択、Cloudinaryへの動画アップロード）
  - コーチ用ダッシュボード（届いた質問の一覧、アドバイス・動画の登録）
  - ユーザー用回答確認画面
- **決済連携 (KOMOJU)**:
  - 質問投稿時のKOMOJU決済連携（クレジットカード、PayPay、Apple Pay）
  - Webhook を利用した決済ステータス（pending -> paid）の自動更新
- **認証 (Supabase)**:
  - Google OAuth ログイン
  - メールアドレス宛のワンタイムパスワード (OTP) ログイン

---

## システム構成

- **フロントエンド**: HTML5, CSS3, JavaScript (Vanilla JS)
  - `frontend/board/`: 掲示板 UI
  - `frontend/question-box/`: 質問箱 UI
  - `frontend/supabase-client.js`: Supabase JS SDK によるクライアント
- **バックエンド (Go)**:
  - `backend/main.go`, `router.go`, `handlers_*.go`
  - Supabase REST API の中継、セッション認証、KOMOJU決済 API 連携、および Webhook の処理を担当。
- **データベース**: Supabase (PostgreSQL)
  - Row Level Security (RLS) を用いたセキュアなデータアクセス制御。
- **外部サービス**:
  - **Supabase**: データベースおよび認証基盤
  - **KOMOJU**: 決済処理
  - **Cloudinary**: 動画および画像のアップロード・ストレージ

---

## 開発環境のセットアップ

### 1. データベース (Supabase) の準備

1. Supabase で新規プロジェクトを作成します。
2. Supabase SQL Editor を開き、ルートディレクトリにある以下の SQL スクリプトを実行して、テーブルと RLS ポリシーを作成します。
   - [supabase-board-schema.sql](file:///Users/hinata/SprintScope%20%E6%94%B9/supabase-board-schema.sql)
   - [supabase_questions.sql](file:///Users/hinata/SprintScope%20%E6%94%B9/supabase_questions.sql)
3. 認証設定で Google OAuth またはメール OTP を有効化します。

### 2. バックエンド (Go) のセットアップ

1. `/backend` ディレクトリへ移動します。
2. `.env` ファイルを作成し、必要な環境変数を設定します（`env.example` を参考にしてください）。
   ```bash
   cp env.example .env
   ```
   **環境変数一覧:**
   - `PORT`: サーバー起動ポート (デフォルト: `8080`)
   - `PUBLIC_BASE_URL`: バックエンドの公開URL
   - `ALLOWED_ORIGINS`: CORSで許可するフロントエンドのオリジン（カンマ区切り）
   - `FRONTEND_RETURN_URL`: 決済完了後のフロントエンド戻り先URL
   - `SUPABASE_URL`: Supabase のプロジェクトURL
   - `SUPABASE_ANON_KEY`: Supabase の anon (public) キー
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase の service_role キー (Webhook更新などに必要)
   - `KOMOJU_SECRET_KEY`: KOMOJU の秘密鍵 (テスト/本番)
   - `KOMOJU_WEBHOOK_SECRET`: KOMOJU の Webhook 署名検証用キー
   - `CLOUDINARY_CLOUD_NAME`: Cloudinary のクラウド名
   - `CLOUDINARY_UPLOAD_PRESET`: Cloudinary のアップロードプリセット (Unsigned)
3. 依存ライブラリをインストールし、サーバーを起動します。
   ```bash
   go run .
   ```
   または、Windows の場合は `start-dev.bat` や `start-dev.ps1` を利用して起動することもできます。

### 3. フロントエンドのセットアップ

フロントエンドは静的ファイルで構成されています。
1. `frontend/supabase-client.js` 内の `SUPABASE_URL` と `SUPABASE_ANON_KEY` を、ご自身の Supabase プロジェクトのものに書き換えます。
2. 静的ファイル用のローカル開発サーバー（例: VS Code の Live Server、または `npx http-server` など）を起動します。
   - `ALLOWED_ORIGINS` で設定したポート（例: `http://localhost:5500`）で起動するようにしてください。

---

## ディレクトリ構成

```text
SprintScope/
├── backend/                       # Go バックエンド
│   ├── auth.go                    # JWT認証ロジック
│   ├── config.go                  # 環境変数読み込み
│   ├── handlers_*.go              # APIハンドラー (board, questions, checkout, uploads等)
│   ├── router.go                  # ルーティング定義
│   ├── main.go                    # エントリーポイント
│   └── env.example                # 環境変数のサンプル
├── frontend/                      # フロントエンド
│   ├── board/                     # 掲示板画面 (HTML, CSS, JS)
│   ├── question-box/              # 質問箱画面 (HTML, CSS, JS)
│   ├── api-client.js              # バックエンドAPI呼出クライアント
│   └── supabase-client.js         # Supabaseクライアント及び認証補助
├── supabase-board-schema.sql      # 掲示板用SQLスキーマ
└── supabase_questions.sql         # 質問箱用SQLスキーマ
```
