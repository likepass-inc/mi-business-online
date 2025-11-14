# MI Business Online Analytics

GA4 と GSC のデータをリアルタイムで取得し、LLM（OpenAI）を用いてインサイトと改善提案を自動生成する Web サービスです。

## 機能

- **GA4 データ取得**: Google Analytics 4 のデータを API から取得
- **GSC データ取得**: Google Search Console のデータを API から取得
- **AI アナリスト**: 自然言語で質問すると、データを分析してインサイトと改善提案を生成
- **ダッシュボード**: KPI カードとトラフィック推移グラフを表示

## 技術スタック

- **フロントエンド / バックエンド**: Next.js 14 (App Router), TypeScript, React
- **外部 API**:
  - GA4 Data API (`@google-analytics/data`)
  - Google Search Console API (`googleapis`)
  - OpenAI API (`openai`)
- **UI**: Tailwind CSS, Recharts
- **デプロイ**: Render.com (Web Service)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成し、以下の環境変数を設定してください：

```env
# Google Analytics 4
GOOGLE_CLIENT_EMAIL=your-service-account-email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GA4_PROPERTY_ID=123456789

# Google Search Console
GSC_SITE_URL=https://business.mistore.jp/

# OpenAI
OPENAI_API_KEY=sk-...
```

### 3. Google サービスアカウントの設定

1. Google Cloud Console でプロジェクトを作成
2. GA4 Data API と Search Console API を有効化
3. サービスアカウントを作成し、JSON キーをダウンロード
4. GA4 プロパティでサービスアカウントに「表示者」以上の権限を付与
5. Search Console でサービスアカウントにアクセス権限を付与

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## Render.com へのデプロイ

1. GitHub リポジトリにプッシュ
2. Render.com で新しい Web Service を作成
3. 環境変数を設定:
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GA4_PROPERTY_ID`
   - `GSC_SITE_URL`
   - `OPENAI_API_KEY`
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`

## プロジェクト構造

```
/
  src/
    app/
      api/
        ga4/route.ts      # GA4 API エンドポイント
        gsc/route.ts      # GSC API エンドポイント
        chat/route.ts     # チャット API エンドポイント
      layout.tsx          # ルートレイアウト
      page.tsx            # メインダッシュボード
    components/
      layout/             # レイアウトコンポーネント
      dashboard/          # ダッシュボードコンポーネント
      chat/               # チャットコンポーネント
    lib/
      ga4Client.ts        # GA4 クライアント
      gscClient.ts        # GSC クライアント
      openaiClient.ts     # OpenAI クライアント
      queryParser.ts      # クエリパーサー
      analyticsService.ts # アナリティクスサービス
      dateUtils.ts        # 日付ユーティリティ
      types.ts            # 型定義
    styles/
      globals.css         # グローバルスタイル
```

## 使用方法

1. **期間選択**: 上部のボタンで期間を選択（直近7日/30日/90日）
2. **KPI 確認**: 中央のカードで主要指標を確認
3. **グラフ確認**: トラフィック推移グラフで時系列データを確認
4. **AI アナリスト**: 右側のチャットで自然言語で質問

### 質問例

- 「直近30日間の自然検索からのセッションとCVの推移と前月比を教えて」
- 「検索クエリでクリック数が多いキーワードを教えて」
- 「CVRが低いページの改善案を教えて」

## ライセンス

ISC

