# 認証情報の設定方法

## 概要

11/1-11/15の期間のレポートを生成するには、Googleサービスアカウントの認証情報を設定する必要があります。

## 設定方法（2つの選択肢）

### 方法1: 環境変数を使用（推奨）

`.env.local` ファイルをプロジェクトルートに作成し、以下の内容を設定してください：

```env
# Googleサービスアカウント
GOOGLE_CLIENT_EMAIL=your-service-account-email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Analytics 4
GA4_PROPERTY_ID=your-ga4-property-id

# Google Search Console
GSC_SITE_URL=https://business.mistore.jp/
```

**注意**: `GOOGLE_PRIVATE_KEY` は改行文字を含むため、`\n` をエスケープする必要があります。

### 方法2: JSONファイルを使用（推奨）

`credentials/service-account.json` ファイルに、Google Cloud ConsoleからダウンロードしたサービスアカウントのJSONキーを配置してください。

**注意**: `credentials/` ディレクトリは `.gitignore` で除外されているため、Gitリポジトリにコミットされません。

JSONファイルの形式：

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account-email@project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## 必要な権限

サービスアカウントには以下の権限が必要です：

1. **Google Analytics 4**: プロパティの「表示者」以上の権限
2. **Google Search Console**: サイトへのアクセス権限

## レポート生成

認証情報を設定した後、以下のコマンドでレポートを生成できます：

```bash
# 開発サーバーが起動していることを確認
npm run dev

# 別のターミナルで実行
./generate-report.sh
```

または、ブラウザから `http://localhost:3000` にアクセスしてログインし、開発者ツールのConsoleで以下を実行：

```javascript
fetch('/api/report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2024-11-01',
    endDate: '2024-11-15'
  })
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)));
```

## トラブルシューティング

### エラー: "GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set"

環境変数が設定されていないか、JSONファイルが存在しない/空です。
- `.env.local` ファイルを作成して環境変数を設定するか
- `mistore-analytics-integration-f07be07249a8.json` ファイルに認証情報を設定してください

### エラー: "GA4_PROPERTY_ID must be set"

GA4のプロパティIDが設定されていません。`.env.local` に `GA4_PROPERTY_ID` を追加してください。

### エラー: "GSC_SITE_URL must be set"

デフォルトで `https://business.mistore.jp/` が使用されますが、環境変数で上書きできます。

