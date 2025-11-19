# レポート生成ガイド

## 概要

このガイドでは、11/1-11/15の期間における三越伊勢丹法人オンラインサイトの集客やトランザクションの状況をレポートする方法を説明します。

## 前提条件

以下の環境変数が設定されている必要があります：

- `GOOGLE_CLIENT_EMAIL`: Google APIのサービスアカウントのメールアドレス
- `GOOGLE_PRIVATE_KEY`: Google APIのサービスアカウントの秘密鍵
- `GSC_SITE_URL`: Google Search ConsoleのサイトURL（例: `https://example.com/`）
- `GA4_PROPERTY_ID`: Google Analytics 4のプロパティID

## レポート生成方法

### 方法1: APIエンドポイントを直接呼び出す

1. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

2. 別のターミナルで、ログインしてセッションCookieを取得:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"id":"tk","password":"nakamura"}' \
     -c /tmp/cookies.txt
   ```

3. レポートAPIを呼び出し:
   ```bash
   curl -X POST http://localhost:3000/api/report \
     -H "Content-Type: application/json" \
     -d '{"startDate":"2024-11-01","endDate":"2024-11-15"}' \
     -b /tmp/cookies.txt | python3 -m json.tool > report.json
   ```

### 方法2: ブラウザからAPIを呼び出す

1. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

2. ブラウザで `http://localhost:3000` にアクセスしてログイン

3. ブラウザの開発者ツール（F12）を開き、Consoleタブで以下を実行:
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
   .then(data => {
     console.log(JSON.stringify(data, null, 2));
     // ファイルに保存する場合
     const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = 'report-2024-11-01-2024-11-15.json';
     a.click();
   });
   ```

## レポートの内容

レポートには以下の情報が含まれます：

### Google Search Console (GSC) データ
- **サマリー**
  - 総クリック数
  - 総インプレッション数
  - 平均CTR
  - 平均ポジション
- **トップ10検索クエリ**: クリック数、インプレッション数、CTR、ポジション
- **トップ10ページ**: クリック数、インプレッション数、CTR、ポジション

### Google Analytics 4 (GA4) データ
- **サマリー**
  - セッション数
  - ユーザー数
  - ページビュー数
  - トランザクション数
  - 売上
  - コンバージョン率
- **チャネル別データ**: セッション、ユーザー、トランザクション、売上
- **デバイス別データ**: セッション、ユーザー、トランザクション、売上

## トラブルシューティング

### エラー: "GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set"

環境変数が設定されていません。`.env.local` ファイルを作成して、必要な環境変数を設定してください。

### エラー: "認証が必要です"

ログインしていないか、セッションが期限切れです。再度ログインしてください。

### エラー: "GSC_SITE_URL must be set" または "GA4_PROPERTY_ID must be set"

対応する環境変数が設定されていません。`.env.local` ファイルに追加してください。

## 注意事項

- レポートの生成には数秒から数十秒かかる場合があります
- GSCのデータは最大3日前までしか取得できない場合があります
- GA4のデータはリアルタイムで更新されますが、完全なデータが反映されるまでに時間がかかる場合があります




