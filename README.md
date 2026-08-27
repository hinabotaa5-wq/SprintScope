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

前提: Go と Make がインストールされていること。

### 1. データベース (Supabase) の準備

1. Supabase でプロジェクトを用意します（新規作成、または既存プロジェクトを利用）。
2. Supabase SQL Editor を開き、リポジトリ直下の SQL を実行してテーブルと RLS ポリシーを作成します。
   - [supabase-board-schema.sql](supabase-board-schema.sql)
   - [supabase_questions.sql](supabase_questions.sql)
3. 認証設定で Google OAuth またはメール OTP を有効化します。

### 2. バックエンドのローカル起動

`.env` が無い状態でも、次のコマンドだけで `.env` が生成され、Go サーバーが起動します。

```bash
cd backend && make dev
```

- `.env` が無いとき: `.env.example` をコピーして `.env` を作り、その内容を読み込んで `go run .` します。
- `.env` が既にあるとき: 既存の `.env` は上書きせず、そのまま使って起動します。
- サーバーは `http://localhost:8080` で待ち受けます（`PORT` / `PUBLIC_BASE_URL` のデフォルト）。

Windows で Make が使えない場合は、`backend/start-dev.bat` または `backend/start-dev.ps1` でも起動できます（その場合は事前に `.env` を用意してください）。

### 3. `.env` のキーを差し替える（必要に応じて）

`make dev` で作られた `.env` には、ポートや CORS などローカル固定のデフォルトが入っています。自分の Supabase / KOMOJU を使うときは、サーバーを止めたうえで `backend/.env` だけ編集します。

1. `backend/.env` を開きます。
2. **Supabase**（Dashboard → Project Settings → API）から次をコピーして置き換えます。
   - `SUPABASE_URL` … Project URL
   - `SUPABASE_ANON_KEY` … `anon` `public` キー
   - `SUPABASE_SERVICE_ROLE_KEY` … `service_role` キー（書き込み・Webhook 更新に必要）
3. **KOMOJU**（テストモードの Merchant Settings）から次をコピーして置き換えます。
   - `KOMOJU_SECRET_KEY` … Secret Key（決済 API に必要）
   - `KOMOJU_WEBHOOK_SECRET` … Webhook の署名検証用（コンビニ決済など Webhook を使う場合。使わなければ空のままで可）
4. フロントの起動 URL が `http://localhost:5500` 以外なら、あわせて次も直します。
   - `ALLOWED_ORIGINS` … CORS 許可オリジン（カンマ区切り）
   - `FRONTEND_RETURN_URL` … 決済完了後の戻り先
5. 保存したあと、もう一度起動します。

```bash
cd backend && make dev
```

`.env` は Git 管理対象外です。サンプルは `backend/.env.example` を参照してください。

主な変数:

| 変数 | 役割 |
| --- | --- |
| `PORT` | サーバー起動ポート（デフォルト `8080`） |
| `PUBLIC_BASE_URL` | バックエンドの公開 URL |
| `ALLOWED_ORIGINS` | CORS で許可するフロントのオリジン |
| `FRONTEND_RETURN_URL` | 決済完了後のフロント戻り先 |
| `SUPABASE_URL` | Supabase のプロジェクト URL |
| `SUPABASE_ANON_KEY` | Supabase の anon キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase の service_role キー |
| `KOMOJU_SECRET_KEY` | KOMOJU の秘密鍵 |
| `KOMOJU_WEBHOOK_SECRET` | KOMOJU Webhook 署名検証用キー |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary のクラウド名 |
| `CLOUDINARY_UPLOAD_PRESET` | Cloudinary の Unsigned アップロードプリセット |

### 4. フロントエンドのセットアップ

フロントエンドは静的ファイルで構成されています。

1. `frontend/supabase-client.js` の `SUPABASE_URL` と `SUPABASE_ANON_KEY` を、`.env` に書いたものと同じ値にします。
2. 静的ファイル用のローカルサーバー（VS Code の Live Server、`npx http-server` など）を起動します。
3. フロントのオリジンを `ALLOWED_ORIGINS` と揃えます（デフォルトは `http://localhost:5500`）。

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
│   ├── Makefile                   # ローカル起動 (make dev)
│   └── .env.example               # 環境変数のサンプル
├── frontend/                      # フロントエンド
│   ├── board/                     # 掲示板画面 (HTML, CSS, JS)
│   ├── question-box/              # 質問箱画面 (HTML, CSS, JS)
│   ├── api-client.js              # バックエンドAPI呼出クライアント
│   └── supabase-client.js         # Supabaseクライアント及び認証補助
├── supabase-board-schema.sql      # 掲示板用SQLスキーマ
└── supabase_questions.sql         # 質問箱用SQLスキーマ
```
