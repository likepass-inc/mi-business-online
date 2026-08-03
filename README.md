# MI Business Online Analytics

GA4 と GSC のデータをリアルタイムで取得し、LLM（OpenAI）を用いてインサイトと改善提案を自動生成する Web サービスです。

## 機能

- **GA4 データ取得**: Google Analytics 4 のデータを API から取得
- **GSC データ取得**: Google Search Console のデータを API から取得
- **AI アナリスト**: 自然言語で質問すると、データを分析してインサイトと改善提案を生成
- **ダッシュボード**: KPI カードとトラフィック推移グラフを表示
- **Weekly KPI Bot**: GSC キーワード TOP10（週間）、GA4 セグメント比較（トータル/マガジンLP/その他）、ランディングページ TOP5、トータル KPI の前年同週比を Slack スレッドで毎週月曜 8:00 に通知（`/api/cron/seo-weekly`）
- **Monthly KPI Bot**: 前月暦月の包括レポート要約（サイト/マガジン前年同月比、GSC クエリハイライト、チャネル/デバイス、季節/通年ポートフォリオ）を Slack スレッドで毎月第1月曜 8:00 に通知（`/api/cron/seo-monthly`）

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

# 商品データ（マガジン記事-商品連携API用）
PRODUCT_CSV_PATH=./data/AIチャットボット用商品情報_UTF8.csv

# データベースパス（Render.comの永続ディスクを使用する場合）
# 永続ディスクのマウントパスに合わせて設定（例: /var/data）
DB_DIR=/var/data
# または個別にファイルパスを指定
# DB_PATH=/var/data/products.db

# Weekly KPI Bot
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0XXXXXXX
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SEO_WEEKLY_MAGAZINE_PREFIX=/magazine/
SEO_WEEKLY_POSTING_ENABLED=true

# Monthly KPI Bot（SLACK_* / CRON_SECRET は Weekly と共通で可）
SEO_MONTHLY_MAGAZINE_PREFIX=/magazine/
SEO_MONTHLY_POSTING_ENABLED=true
CRON_SECRET=your-secret-token-here
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
3. **永続ディスクの設定**（推奨）:
   - 「Disk」タブから永続ディスクを追加
   - Mount Path: `/var/data`
   - Size: 10 GB（推奨）
4. 環境変数を設定:
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GA4_PROPERTY_ID`
   - `GSC_SITE_URL`
   - `OPENAI_API_KEY`
   - `DB_DIR=/var/data`（永続ディスクを使用する場合）
   - `PRODUCT_CSV_PATH`（商品CSVファイルのパス、オプション）
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`

**注意**: 永続ディスクを使用しない場合、データベースファイルは再起動時に削除される可能性があります。

## プロジェクト構造

```
/
  src/
    app/
      api/
        ga4/route.ts      # GA4 API エンドポイント
        gsc/route.ts      # GSC API エンドポイント
        chat/route.ts     # チャット API エンドポイント
        crawl/
          products/route.ts           # 商品クロール実行API
          products/incremental/route.ts  # 差分クロールAPI
          products/status/route.ts     # クロール状況取得API
        cron/
          crawl-products/route.ts     # Cron用クロールAPI
        products/
          route.ts                     # 商品一覧取得API
          [productCode]/route.ts       # 商品詳細取得API
          search/route.ts              # 商品検索API
        magazine/
          related-products/route.ts      # マガジン記事関連商品取得API
          products-by-category/route.ts  # カテゴリ別商品取得API
      layout.tsx          # ルートレイアウト
      page.tsx            # メインダッシュボード
    components/
      layout/             # レイアウトコンポーネント
      dashboard/          # ダッシュボードコンポーネント
      chat/               # チャットコンポーネント
    lib/
      db/
        schema.ts         # データベーススキーマ
        productRepository.ts  # 商品データリポジトリ
      ga4Client.ts        # GA4 クライアント
      gscClient.ts        # GSC クライアント
      openaiClient.ts     # OpenAI クライアント
      queryParser.ts      # クエリパーサー
      analyticsService.ts # アナリティクスサービス
      productService.ts   # 商品データサービス
      productParser.ts    # 商品情報抽出パーサー
      productCrawler.ts   # 商品URL収集機能
      scraper.ts          # ページスクレイピング
      dateUtils.ts        # 日付ユーティリティ
      types.ts            # 型定義
    styles/
      globals.css         # グローバルスタイル
  data/
    products.db           # SQLiteデータベース（自動生成）
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

## マガジン記事-商品連携API

マガジン記事に関連する商品を自動表示するAPIです。

### エンドポイント

#### 1. 関連商品取得API

```
GET /api/magazine/related-products?article_id=315&limit=6
```

**パラメータ:**
- `article_id` (必須): 記事ID（例: "315", "2638", "3033"）
- `category` (オプション): カテゴリ名（例: "お詫び・謝罪", "退職"）
- `limit` (オプション): 表示件数（デフォルト: 6）
- `min_price` (オプション): 最低価格
- `max_price` (オプション): 最高価格

**レスポンス例:**
```json
{
  "success": true,
  "article_id": "315",
  "total_products": 6,
  "products": [
    {
      "product_code": "ABC123",
      "product_name": "謝罪・お詫び用高級菓子折りセット",
      "brand_name": "銀座千疋屋",
      "category": "お菓子",
      "price_incl_tax": 5400,
      "product_url": "https://business.mistore.jp/shop/g/gABC123",
      "match_score": 95,
      "tags": ["法人向けお詫びギフト・謝罪の品"]
    }
  ],
  "metadata": {
    "category": "お詫び・謝罪",
    "match_score_threshold": 60,
    "execution_time_ms": 45
  }
}
```

#### 2. カテゴリ別商品取得API

```
GET /api/magazine/products-by-category?category=お詫び・謝罪&limit=12&sort=price_asc&page=1
```

**パラメータ:**
- `category` (必須): カテゴリ名
- `limit` (オプション): 表示件数（デフォルト: 12）
- `sort` (オプション): ソート順（`price_asc`, `price_desc`, `popular`, `new`）
- `page` (オプション): ページ番号（デフォルト: 1）

### セットアップ

1. 商品データCSVファイルを配置:
   - デフォルトパス: `./data/AIチャットボット用商品情報_UTF8.csv`
   - または環境変数 `PRODUCT_CSV_PATH` でパスを指定

2. CSVファイルの形式:
   - 必須カラム: `商品コード`, `商品名`, `ブランド名`, `大カテゴリ`, `中カテゴリ`, `税抜価格`, `税込価格`, `商品説明`, `URL` または `ＵＲＬ`
   - タグカラム: `法人向けお詫びギフト・謝罪の品`, `退職記念品・退職祝いギフト`, `法人向け手土産・差し入れギフト`, `法人向けお祝い・記念品ギフト`, `胡蝶蘭` など（`○` または `true` で有効）

### マッチングロジック

商品は以下のスコアリングアルゴリズムで評価されます:

- **タグマッチング** (50点): 記事カテゴリのタグと商品タグが一致
- **キーワードマッチング** (最大30点): 記事のキーワードが商品名・説明に含まれる
- **価格帯適合性** (10点): 商品価格が記事の典型的な予算範囲内
- **商品説明の充実度** (10点): 商品説明が50文字以上

スコア60点以上の商品が返されます。

## 商品クロール・API

business.mistore.jpの商品ページを定期的にクロールし、商品データをデータベースに保存して、WordPress/SWELLテーマ用のREST APIを提供します。

### 商品URL収集の仕組み

商品URLは以下の方法で収集されます：

1. **カテゴリページからの収集（優先）**
   - `/shop/` および `/shop/c/` からカテゴリページを発見
   - 各カテゴリページから商品URL（`/shop/g/` で始まるURL）を抽出
   - ページネーションに対応（最大200ページまで）

2. **サイトマップからの収集（補助的）**
   - 正規のサイトマップインデックス（`sitemap_index.xml`）から商品URLを収集
   - `robots.txt`からサイトマップの場所を取得して収集
   - 古いサイトマップ（`sitemap.xml`）は使用しません

3. **URLの正規化**
   - 古いドメイン（`kinogift.jp`）のURLは自動的に`business.mistore.jp`に正規化
   - クエリパラメータを除去して正規化

### セットアップ

1. データベースは自動的に作成されます（`data/products.db`）
2. 環境変数（オプション）:
   - `CRON_SECRET`: Cron実行用の認証トークン（設定推奨）

### APIエンドポイント

#### 商品クロール実行

- `POST /api/crawl/products`: 全商品のクロールを実行
  - リクエストボディ: `{ "type": "full" }` または `{ "type": "incremental" }`
- `POST /api/crawl/products/incremental`: 差分クロールを実行（更新が必要な商品のみ）
- `POST /api/crawl/products/single`: 特定の商品をクロール
  - リクエストボディ: `{ "product_code": "g020W-977" }` または `{ "product_url": "https://business.mistore.jp/shop/g/g020W-977/" }`
  - レスポンス例:
    ```json
    {
      "success": true,
      "product_code": "g020W-977",
      "product_name": "商品名",
      "image_url": "https://d3b4uw7lo85s1k.cloudfront.net/img/goods/L/020W-977_1.jpg",
      "image_urls": ["https://..."],
      "availability": null,
      "message": "Product g020W-977 crawled and saved successfully"
    }
    ```
- `GET /api/crawl/products/status`: クロール実行状況を取得

#### 商品データ取得（WordPress/STORK19用）

- `GET /api/products`: 商品一覧取得
  - クエリパラメータ:
    - `category`: カテゴリでフィルタ
    - `limit`: 取得件数（デフォルト: 100）
    - `offset`: オフセット（デフォルト: 0）
    - `sort`: ソート順（`name`, `price_asc`, `price_desc`, `updated_desc`）
    - `q`: 検索キーワード
    - `product_code[]`: 複数の商品コードを指定（配列形式、記事ページ内の複数商品を一度に取得可能）
    - `product_id[]`: `product_code[]` の別名（同じ動作）
- `GET /api/products/[productCode]`: 商品詳細取得
- `GET /api/products/search?q=キーワード`: 商品検索

**複数商品ID一括取得の例**:
```
GET /api/products?product_code[]=ABC123&product_code[]=DEF456&product_code[]=GHI789
```

**レスポンス例**:
```json
{
  "success": true,
  "data": [
    {
      "product_code": "ABC123",
      "product_name": "商品名",
      "price_incl_tax": 5400,
      "product_url": "https://business.mistore.jp/shop/g/ABC123",
      "image_urls": ["https://..."],
      "category": "カテゴリ名"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

#### 定期実行（Cron）

- `GET /api/cron/crawl-products`: 定期クロール実行
  - 認証: `Authorization: Bearer {CRON_SECRET}` ヘッダーが必要
  - 外部cronサービス（cron-job.org等）から呼び出し可能
  - 差分クロールを実行（更新が必要な商品のみ）

**詳細な設定手順**: [CRON_SETUP_GUIDE.md](./CRON_SETUP_GUIDE.md) を参照してください。

**クイックスタート**:
1. CRON_SECRETを生成: `./scripts/generate-cron-secret.sh`
2. Render.comで環境変数 `CRON_SECRET` を設定
3. cron-job.orgでCron Jobを作成
4. 動作確認: `./scripts/test-cron.sh {CRON_SECRET}`

**環境変数の設定**:
```env
CRON_SECRET=your-secret-token-here
```

**cron-job.org設定手順**（簡易版）:
1. [cron-job.org](https://cron-job.org/) にアカウントを作成
2. 「Create cronjob」をクリック
3. 以下の設定を入力:
   - **Title**: `商品クロール定期実行`
   - **URL**: `https://mi-business-online.onrender.com/api/cron/crawl-products`
   - **Schedule**: `Daily` → `02:00` (毎日午前2時)
   - **Request Method**: `GET`
   - **Request Headers**: 
     ```
     Authorization: Bearer your-secret-token-here
     ```
4. 「Create cronjob」をクリック

**推奨スケジュール**:
- **差分クロール**: 毎日 午前2時（デフォルト）
- **フルクロール**: 週1回（日曜日 午前3時など）

**手動でフルクロールを実行する場合**:
```bash
curl -X POST https://mi-business-online.onrender.com/api/crawl/products \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'
```

### 使用方法

1. **初回クロール実行**:
   ```bash
   curl -X POST https://your-domain.com/api/crawl/products \
     -H "Content-Type: application/json" \
     -d '{"type": "full"}'
   ```

2. **WordPress/SWELLから商品データを取得**:
   ```php
   $response = wp_remote_get('https://your-domain.com/api/products?limit=10');
   $products = json_decode(wp_remote_retrieve_body($response));
   ```

3. **定期実行の設定**:
   - cron-job.org等の外部サービスを使用
   - または、サーバーのcronで設定

## Weekly KPI Bot

GSC のクリック数上位キーワード TOP10（順位・CTR 併記、週間集計）に加え、GA4 のセグメント別サマリ（トータル / マガジンLP / マガジン以外LP）、ランディングページ TOP5（セッション数・貢献CV・貢献売上）、トータル KPI の前年同週比（52週前）を Slack に投稿します。対象期間は JST 基準で**直前の完全週（日曜〜土曜）**です。

**売上・CV の帰属**: GA4 キーイベント帰属（`keyEvents` / `purchaseRevenue`）を使用します。GA4 管理画面で `購入完了` のルックバックウィンドウを **30日** に設定してください（Admin → データの表示 → アトリビューション）。

**投稿形式**（Bot Token 設定時）:
1. 親メッセージ: タイトル + 週間期間
2. スレッド1: GSC キーワード TOP10（週間）
3. スレッド2: GA4 セグメント概況（トータル / マガジンLP / マガジン以外LP）+ 前年同週比
4. スレッド3: ランディングページ TOP5（セッション数）— 全体 + マガジン
5. スレッド4: ランディングページ TOP5（貢献CV・貢献売上）— 全体 + マガジン

未設定時は `SLACK_WEBHOOK_URL` で上記を1通にまとめて投稿します。

### セットアップ

1. Slack App に Bot Token Scopes `chat:write` を付与し、Bot を投稿先チャンネルに `/invite` で招待
2. Render.com（または `.env.local`）に以下を設定:
   - `SLACK_BOT_TOKEN`: Bot User OAuth Token（`xoxb-...`）
   - `SLACK_CHANNEL_ID`: 投稿先チャンネル ID（`C...`）
   - `SLACK_WEBHOOK_URL`: フォールバック用（Bot Token 未設定時のみ使用）
   - `SEO_WEEKLY_MAGAZINE_PREFIX`: 任意（デフォルト `/magazine/`）。マガジンLP セグメント判定に使用
   - `SEO_WEEKLY_POSTING_ENABLED`: 任意（デフォルト有効）。`false` で Slack 投稿のみ停止（緊急時）
   - `CRON_SECRET`: cron ルート認証用（商品クロールと共通で可）

### ローカルテスト

```bash
npm run seo:weekly
```

### Cron エンドポイント

- `GET /api/cron/seo-weekly`: レポート生成 → Slack 投稿
- 認証: `Authorization: Bearer {CRON_SECRET}`

**手動実行例**（Slack に投稿せず確認する場合）:
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  "https://mi-business-online.onrender.com/api/cron/seo-weekly?dryRun=1"
```

本番投稿（同一週は1回まで。再実行しても重複投稿しません）:
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  https://mi-business-online.onrender.com/api/cron/seo-weekly
```

旧エンドポイント `/api/cron/seo-daily` は **410 Gone** を返します。

### GitHub Actions 設定（毎週月曜 8:00 JST）

スケジュール実行は [`.github/workflows/seo-weekly.yml`](.github/workflows/seo-weekly.yml) が担当します（cron-job.org は不要）。

1. [GitHub → Settings → Secrets and variables → Actions](https://github.com/tknakamuratakeshi/mi-business-online/settings/secrets/actions) で Secret を追加:
   - **Name**: `CRON_SECRET`
   - **Value**: Render の `CRON_SECRET` と同一の値
2. 手動テスト: GitHub の **Actions** タブ → **SEO Weekly KPI Bot** → **Run workflow**
   - 初回は `dry_run: true` で Slack 投稿なし確認を推奨
3. スケジュール: 毎週月曜 08:00 JST（workflow 内 cron: 日曜 23:00 UTC）

**ローカルテスト**（dryRun）:
```bash
./scripts/test-seo-weekly.sh your-secret-token --dry-run
```

**curl で直接確認**:
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  "https://mi-business-online.onrender.com/api/cron/seo-weekly?dryRun=1"
```

## Monthly KPI Bot

前月の暦月（例: 8月第1月曜実行 → 7/1〜7/31）について、サイト全体・マガジンの GSC/GA4 前年同月比、GSC クエリハイライト（TOP10・伸長/減少）、チャネル/デバイス、季節/通年クエリポートフォリオを Slack に投稿します。データ層は [`buildComprehensiveReport`](src/lib/buildComprehensiveReport.ts) を再利用した要約版です。

**投稿形式**（Bot Token 設定時）:
1. 親メッセージ: タイトル + 対象月
2. スレッド1: サイト全体 GSC + GA4 前年同月比
3. スレッド2: マガジン GSC + GA4 前年同月比
4. スレッド3: GSC クエリ（クリック TOP10・伸長 TOP5・減少 TOP5）
5. スレッド4: GA4 チャネル TOP5・デバイス
6. スレッド5: クエリポートフォリオ（季節/通年）+ 自動考察
7. スレッド6〜15: サイト全体 KPI の **13ヶ月推移グラフ**（GSC 4種 + GA4 6種、1指標1スレッド）

### セットアップ

Weekly KPI Bot と同じ Slack App・チャンネル設定を流用できます。グラフ投稿には Bot Token に **`files:write`** スコープを追加し、ワークスペースに再インストールしてください。

追加の環境変数:

- `SEO_MONTHLY_MAGAZINE_PREFIX`: 任意（未設定時は Weekly のプレフィックス → `/magazine/`）
- `SEO_MONTHLY_POSTING_ENABLED`: 任意（デフォルト有効）。`false` で Slack 投稿のみ停止

### ローカルテスト

```bash
npm run seo:monthly
```

### Cron エンドポイント

- `GET /api/cron/seo-monthly`: レポート生成 → Slack 投稿
- 認証: `Authorization: Bearer {CRON_SECRET}`

**手動実行例**（Slack に投稿せず確認）:
```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  "https://mi-business-online.onrender.com/api/cron/seo-monthly?dryRun=1"
```

### GitHub Actions 設定（毎月第1月曜 8:00 JST）

スケジュール実行は [`.github/workflows/seo-monthly.yml`](.github/workflows/seo-monthly.yml) が担当します。

1. `CRON_SECRET` は Weekly と同一の GitHub Actions Secret を使用
2. 手動テスト: **Actions** → **SEO Monthly KPI Bot** → **Run workflow**（`dry_run: true` 推奨）
3. スケジュール: 毎月第1月曜 08:00 JST（workflow 内 cron: `0 23 1-7 * 0` UTC）

**ローカルテスト**（dryRun）:
```bash
./scripts/test-seo-monthly.sh your-secret-token --dry-run
```

## ライセンス

ISC

