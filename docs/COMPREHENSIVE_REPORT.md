# 包括レポート（GSC・GA4・前年同期比・/magazine/）

直近 N 日（既定 30 日）のサイト全体の集客・購入指標に加え、前年同期間との差分、および `/magazine/` 配下の GSC・GA4 セグメントを 1 回の API で取得できます。実データに基づくクエリ・ページの**提案書**は [SEO_QUERY_PAGE_PROPOSAL.md](SEO_QUERY_PAGE_PROPOSAL.md) を参照してください。

## 概要

| 項目 | 内容 |
|------|------|
| エンドポイント | `POST /api/report/comprehensive` |
| 認証 | アプリのセッション Cookie（ログイン必須） |
| 期間 | `days`（既定 30）と `endOffsetDays`（既定 1＝終了日を「今日から 1 日前」＝昨日まで）から計算 |
| 前年比 | 上記「現在期間」と同じ日数・同じ曜日対応の**前年同日**区間（`getYearOverYearPeriod`） |
| サイト全体 | 既存の単期レポート（[`buildSiteReport`](../src/lib/buildSiteReport.ts)）と同一ロジック |
| マガジン | GSC: `page` の **contains**（[`pageContains`](../src/lib/gscClient.ts)）。GA4: `pagePath` の **CONTAINS**（既定 `/magazine/`） |

## 前提条件

### Google API（サーバー側）

[SETUP_CREDENTIALS.md](../SETUP_CREDENTIALS.md) および [REPORT_GUIDE.md](../REPORT_GUIDE.md) と同様です。

- `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY`（または `credentials/service-account.json`）
- `GA4_PROPERTY_ID`
- `GSC_SITE_URL`

### アプリログイン（CLI・curl 利用時）

- `REPORT_LOGIN_ID` / `REPORT_LOGIN_PASSWORD`（ダッシュボードと同じログイン情報）

## API 仕様

### リクエスト

- **URL**: `POST {オリジン}/api/report/comprehensive`
- **Headers**: `Content-Type: application/json`、**Cookie**: ログイン後のセッション
- **Body**（すべて省略可）:

| フィールド | 型 | 既定 | 説明 |
|------------|-----|------|------|
| `days` | number | 30 | 集計日数（1〜366） |
| `endOffsetDays` | number | 1 | 終了日を「今日から何日前」にするか。GSC の反映遅延を考慮し 1（昨日まで）が無難 |
| `magazinePathPrefix` | string | `/magazine/` | GA4 の `pagePath` フィルタ、および GSC の page contains に使う文字列 |

### レスポンス（JSON）

トップレベル構造:

- **`meta`**: `days`, `endOffsetDays`, `magazinePathPrefix`, `currentPeriod`, `yearAgoPeriod`, `notes`
- **`siteWide`**
  - `current` / `yearAgo`: サイト全体レポート。GSC は `gsc.summary` に加え、**`gsc.allQueries`**（query 次元・最大 1 万件）、**`gsc.allPages`**（page 次元・最大 100 件）を含み、クエリ・URL ごとの前年突合に利用できます。
  - `yearOverYear`: 主要 KPI の `current` / `previous` / `absoluteChange` / `percentChange`
- **`magazine`**
  - `current` / `yearAgo`: マガジンセグメントの GSC（**`allQueries`** / **`allPages`** を含む）と GA4（トラフィック系）
  - `yearOverYear`: マガジン指標の前年差分

購入・売上の定義はサイト全体の [`buildSiteReport`](../src/lib/buildSiteReport.ts) と同一（例: トランザクション数は「購入完了」イベントに基づく）です。マガジン配下の**厳密な購入帰属**は、標準の Data API だけでは扱いづらいため、`meta.notes` にもその旨を記載しています。

### Markdown に出力される GSC クエリ・ページの前年比

[`renderComprehensiveMarkdown`](../src/lib/comprehensiveReportMarkdown.ts) が生成する表では、次の観点を追加しています（突合ロジックは [`gscDimensionYoY.ts`](../src/lib/gscDimensionYoY.ts)）。

| 区分 | 内容 |
|------|------|
| クエリポートフォリオ（季節／通年） | [`querySeason.ts`](../src/lib/querySeason.ts) のルールでクエリ行を「季節語ヒット」と「通年寄り」に分け、クリック・インプレッションのシェアを表示 |
| 現在トップ × 前年 | 現在期間でクリック上位のクエリ（または URL）について、前年同期の同一クエリ・同一 URL のクリック数・増減・変化率 |
| 前年同期比で伸長 | 前年よりクリックが増えたクエリ／URL を**増加幅**の大きい順（[`findGrowingQueries` / `findGrowingPages`](../src/lib/gscDimensionYoY.ts)） |
| 前年に強かったが減少 | 前年同期のクリックが閾値以上あるのに、現在が前年より少ないものを**クリック減少幅**の大きい順に列挙 |

**閾値**は減少リスト・伸長リストそれぞれ `comprehensiveReportMarkdown.ts` および `gscDimensionYoY.ts` で調整可能です。

戦略レビューの進め方は [SEO_STRATEGY_GOVERNANCE.md](SEO_STRATEGY_GOVERNANCE.md)、法人意図の議論は [GA4_CORPORATE_INTENT_PROXY.md](GA4_CORPORATE_INTENT_PROXY.md) を参照してください。

## CLI で Markdown / JSON を保存

開発サーバー起動後:

```bash
npm run report:comprehensive
```

または:

```bash
REPORT_LOGIN_ID=あなたのID REPORT_LOGIN_PASSWORD=あなたのパスワード npx tsx scripts/generate-comprehensive-report.ts
```

### 環境変数（CLI）

| 変数 | 説明 |
|------|------|
| `REPORT_LOGIN_ID` / `REPORT_LOGIN_PASSWORD` | 必須（ログイン） |
| `NEXT_PUBLIC_API_URL` | API のベース URL（既定: `http://localhost:3000`） |
| `REPORT_DAYS` | 集計日数（既定: 30） |
| `REPORT_END_OFFSET_DAYS` | 終了日オフセット（既定: 1） |
| `REPORT_MAGAZINE_PREFIX` | マガジンパス（既定: `/magazine/`） |

出力ファイル（リポジトリルート）:

- `comprehensive-report_{開始日}_{終了日}.md`
- `comprehensive-report_{開始日}_{終了日}.json`

Markdown の内容は [`renderComprehensiveMarkdown`](../src/lib/comprehensiveReportMarkdown.ts) で生成します。

## curl の例

```bash
# 1. ログインして Cookie を保存（ID/パスワードは環境変数推奨）
curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$REPORT_LOGIN_ID\",\"password\":\"$REPORT_LOGIN_PASSWORD\"}" \
  -c /tmp/mbo-cookies.txt

# 2. 包括レポート取得
curl -s -X POST "http://localhost:3000/api/report/comprehensive" \
  -H "Content-Type: application/json" \
  -b /tmp/mbo-cookies.txt \
  -d '{"days":30,"endOffsetDays":1,"magazinePathPrefix":"/magazine/"}' \
  | python3 -m json.tool > comprehensive-report.json
```

## 関連ソース

| ファイル | 役割 |
|----------|------|
| [`src/lib/buildComprehensiveReport.ts`](../src/lib/buildComprehensiveReport.ts) | 期間計算・並列取得・YoY 差分 |
| [`src/lib/buildMagazineReport.ts`](../src/lib/buildMagazineReport.ts) | マガジン GSC / GA4 |
| [`src/lib/buildSiteReport.ts`](../src/lib/buildSiteReport.ts) | サイト全体 1 期間 |
| [`src/app/api/report/comprehensive/route.ts`](../src/app/api/report/comprehensive/route.ts) | HTTP ハンドラ |
| [`scripts/generate-comprehensive-report.ts`](../scripts/generate-comprehensive-report.ts) | CLI（ログイン後に API 呼び出し） |
| [`scripts/export-comprehensive-for-docs.ts`](../scripts/export-comprehensive-for-docs.ts) | 本ドキュメントの実データ区間を API ロジックで再生成 |
| [`src/lib/comprehensiveReportMarkdown.ts`](../src/lib/comprehensiveReportMarkdown.ts) | 包括レポートの Markdown 整形（クエリ・ページの YoY 表を含む） |
| [`src/lib/gscDimensionYoY.ts`](../src/lib/gscDimensionYoY.ts) | GSC query / page 行の前年突合・伸長／減少抽出 |
| [`src/lib/querySeason.ts`](../src/lib/querySeason.ts) | クエリ文字列の季節／通年のルール分類 |
| [SEO_STRATEGY_GOVERNANCE.md](SEO_STRATEGY_GOVERNANCE.md) | 四半期レビュー固定アジェンダ |
| [GA4_CORPORATE_INTENT_PROXY.md](GA4_CORPORATE_INTENT_PROXY.md) | 法人意図のプロキシと GA4 の限界 |

## 注意事項

- GSC のデータは**最大で数日遅れ**ることがあります（[REPORT_GUIDE.md](../REPORT_GUIDE.md) と同様）。`endOffsetDays` を 1 以上にすると、直近の不完全な日を避けやすくなります。
- 単期間のみ必要な場合は従来どおり `POST /api/report`（[`src/app/api/report/route.ts`](../src/app/api/report/route.ts)）を利用してください。詳細は [REPORT_GUIDE.md](../REPORT_GUIDE.md) を参照してください。

## 実データスナップショット（直近30日・前年同期比）

この節は Google API から取得した値の記録です。`buildComprehensiveReport` と `renderComprehensiveMarkdown` と同一のロジックで生成しています。再生成する場合はリポジトリルートで次を実行し、本節のマーカー内を更新します。

```bash
export $(grep -v '^#' .env.local | grep -v '^$' | xargs) && npx tsx scripts/export-comprehensive-for-docs.ts
```

（`.env.local` に `GA4_PROPERTY_ID` を含むこと。Google 認証は `credentials/service-account.json` または `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` を使用。）

<!-- COMPREHENSIVE_SNAPSHOT_START -->

### GSC・GA4 包括レポート（直近30日・前年同期比）

**対象期間（現在）**: 2026-04-22 〜 2026-05-21

**前年同期**: 2025-04-22 〜 2025-05-21

**マガジンパス**: `/magazine/`（GSC: page contains / GA4: pagePath contains）

**終端オフセット**: 終了日は今日から 1 日前（GSC の反映遅延を考慮）

**生成日時**: 2026/5/22 12:02:06

### 注記

- Google Search Console のデータは最大で数日遅れて反映されることがあります。
- マガジン配下の厳密な購入帰属には、GA4 の探索や BigQuery 連携が有効な場合があります（本レポートのマガジン GA4 は pagePath に基づくトラフィック指標です）。

---

## サイト全体 — Google Search Console

| 指標 | 現在 | 前年同期 | 変化 |
|------|------|----------|------|
| クリック | 66,443 | 84,853 | -18,410 / -21.7%（注意） |
| インプレッション | 1,684,025 | 1,827,837 | -143,812 / -7.9%（注意） |
| 平均CTR | 3.95% | 4.64% | -0.69% / -14.9%（注意） |
| 平均掲載順位 | 7.55 | 10.49 | -2.94 / -28.0%（好調） |


**考察（サイト全体 GSC サマリ）**

> クリック -21.7%（減少）、インプレッション -7.9%、平均CTR -14.9%、平均掲載順位 -2.94（数値が小さいほど好転）。
> クリック・露出ともに減少だが順位は改善。「上位化したが当該クエリの市場規模が縮小」「上位帯での CTR 低下」の二仮説を検証する。
> 平均CTRが -14.9% と大きく低下。タイトル・ディスクリプション、構造化データの再点検候補。

### クエリポートフォリオ（季節語の目安・現在期間）

クエリ文字列に「お歳暮」「お中元」等の**ルール**が含まれる行を季節寄り、それ以外を通年寄りとして集計しています（`src/lib/querySeason.ts`）。四半期レビューでは通年比率の推移を確認してください（`docs/SEO_STRATEGY_GOVERNANCE.md`）。

| 区分 | クエリ行数 | クリック | シェア | インプレッション | シェア |
|------|------------|----------|--------|------------------|--------|
| 季節語ヒット | 713 | 261 | 0.8% | 36,497 | 4.9% |
| 通年寄り | 9,287 | 33,620 | 99.2% | 700,950 | 95.1% |


**考察（サイト全体 クエリポートフォリオ）**

> サイト全体のクリックは **通年クエリが 99.2%** を占めており、年間を通じた継続施策の効果が出やすい構造。
> ※ 「お歳暮」「お中元」等のルール語のみで判定（`src/lib/querySeason.ts`）。実際の意図（贈答シーンの季節性）と差がある場合は、ルール拡張を検討。

### 検索クエリ（現在クリック上位 25 件 × 前年同期）

| 順位 | クエリ | 現在クリック | 前年クリック | 増減 | 変化率 |
|------|--------|-------------|-------------|------|--------|
| 1 | 退職 お菓子 | 1,312 | 920 | +392 | +42.6% |
| 2 | 香典返し | 545 | 0 | +545 | — |
| 3 | 退職 お菓子 個包装 | 470 | 462 | +8 | +1.7% |
| 4 | お詫びの品 | 432 | 788 | -356 | -45.2% |
| 5 | コーヒー ギフト | 357 | 1 | +356 | +35600.0% |
| 6 | 退職 お菓子 おすすめ | 351 | 681 | -330 | -48.5% |
| 7 | 差し入れ お菓子 | 267 | 117 | +150 | +128.2% |
| 8 | 退職時 お菓子 | 240 | 293 | -53 | -18.1% |
| 9 | 退職 お菓子 おしゃれ 個包装 人気 | 216 | 270 | -54 | -20.0% |
| 10 | 差し入れ おすすめ | 210 | 266 | -56 | -21.1% |
| 11 | 社長就任祝い | 181 | 294 | -113 | -38.4% |
| 12 | コーヒーギフト | 174 | 0 | +174 | — |
| 13 | コーヒー ギフト 高級 | 160 | 0 | +160 | — |
| 14 | コーヒー ギフト おしゃれ | 150 | 1 | +149 | +14900.0% |
| 15 | 謝罪 菓子折り | 137 | 394 | -257 | -65.2% |
| 16 | コーヒー プレゼント | 136 | 0 | +136 | — |
| 17 | 退職お菓子 | 131 | 110 | +21 | +19.1% |
| 18 | 謝罪 手土産 | 129 | 294 | -165 | -56.1% |
| 19 | 三越伊勢丹法人オンラインストア | 126 | 122 | +4 | +3.3% |
| 20 | 開院祝い | 122 | 212 | -90 | -42.5% |
| 21 | ドリップコーヒー ギフト | 121 | 0 | +121 | — |
| 22 | 三越伊勢丹法人オンライン | 121 | 111 | +10 | +9.0% |
| 23 | 叙勲 お祝い | 119 | 745 | -626 | -84.0% |
| 24 | 昇進祝い 女性 | 116 | 53 | +63 | +118.9% |
| 25 | 退職時 お菓子 おすすめ | 99 | 72 | +27 | +37.5% |


**考察（上位クエリ × 前年）**

> 上位 25 件のうち、前年同期比で **増加 15 件 / 減少 10 件**。
> 主要クラスタは 退職・お菓子（8件） / コーヒー・紅茶ギフト（6件） / お詫び・謝罪（3件）。
> 最大の伸びは `香典返し`（0 → 545、+545）。
> 最大の落ち込みは `叙勲 お祝い`（745 → 119、-626）。

### 検索クエリ（前年同期比で伸長したもの）

前年同期よりクリックが増えたクエリを、**クリック増加幅**の大きい順に最大 25 件表示しています（前年 30 クリック以上、または前年 0 で現在 25 クリック以上）。

| 順位 | クエリ | 現在クリック | 前年クリック | 増加 | 変化率 |
|------|--------|-------------|-------------|------|--------|
| 1 | 香典返し | 545 | 0 | 545 | — |
| 2 | 退職 お菓子 | 1,312 | 920 | 392 | +42.6% |
| 3 | コーヒーギフト | 174 | 0 | 174 | — |
| 4 | コーヒー ギフト 高級 | 160 | 0 | 160 | — |
| 5 | 差し入れ お菓子 | 267 | 117 | 150 | +128.2% |
| 6 | コーヒー プレゼント | 136 | 0 | 136 | — |
| 7 | ドリップコーヒー ギフト | 121 | 0 | 121 | — |
| 8 | 餞別の品 | 89 | 0 | 89 | — |
| 9 | コーヒーギフト おすすめ | 83 | 0 | 83 | — |
| 10 | 高級コーヒー ギフト | 71 | 0 | 71 | — |
| 11 | 昇進祝い 女性 | 116 | 53 | 63 | +118.9% |
| 12 | もらって 嬉しいコーヒー ギフト | 61 | 0 | 61 | — |
| 13 | 株主総会 お土産 2026 | 58 | 0 | 58 | — |
| 14 | コーヒー ギフト 高級 人気 | 57 | 0 | 57 | — |
| 15 | 上棟 差し入れ | 87 | 33 | 54 | +163.6% |
| 16 | コーヒー ギフト おしゃれ 美味しい | 54 | 0 | 54 | — |
| 17 | コーヒー ギフト おすすめ | 52 | 0 | 52 | — |
| 18 | 香典返し 品物 | 48 | 0 | 48 | — |
| 19 | センスのいい 香典返し | 47 | 0 | 47 | — |
| 20 | コーヒー 高級 ギフト | 43 | 0 | 43 | — |
| 21 | 仕事で迷惑をかけた お詫び お菓子 | 42 | 0 | 42 | — |
| 22 | コーヒー お菓子 ギフト | 40 | 0 | 40 | — |
| 23 | コーヒーギフト 高級 | 40 | 0 | 40 | — |
| 24 | 香典返し 嬉しかったもの | 39 | 0 | 39 | — |
| 25 | お香典返し | 38 | 0 | 38 | — |


**考察（伸長クエリ）**

> 伸長 25 件のうち、**前年同期にクリック 0 から新規露出が 21 件**、既存からの上積みが 4 件。
> クラスタ別では コーヒー・紅茶ギフト（13件） / 香典返し・法事返礼（5件） / 差し入れ・手土産（2件） に伸びが集中。
> 上位3件: `香典返し`(+545)、`退職 お菓子`(+392)、`コーヒーギフト`(+174)。

### 検索クエリ（前年同期に強かったが減少したもの）

前年同期のクリックが **50 以上** かつ現在のクリックが前年より少ないクエリを、**クリック減少幅**の大きい順に最大 25 件表示しています。

| 順位 | クエリ | 前年クリック | 現在クリック | 減少 | 変化率 |
|------|--------|-------------|-------------|------|--------|
| 1 | 叙勲 お祝い | 745 | 119 | 626 | -84.0% |
| 2 | お詫びの品 | 788 | 432 | 356 | -45.2% |
| 3 | 退職 お菓子 おすすめ | 681 | 351 | 330 | -48.5% |
| 4 | 謝罪 菓子折り | 394 | 137 | 257 | -65.2% |
| 5 | 菓子折り 謝罪 | 252 | 71 | 181 | -71.8% |
| 6 | 差し入れ | 267 | 88 | 179 | -67.0% |
| 7 | 謝罪 手土産 | 294 | 129 | 165 | -56.1% |
| 8 | 菓子折り おすすめ | 182 | 43 | 139 | -76.4% |
| 9 | お詫びのお菓子 | 159 | 26 | 133 | -83.6% |
| 10 | 叙勲とは | 135 | 3 | 132 | -97.8% |
| 11 | 快気祝いとは | 121 | 1 | 120 | -99.2% |
| 12 | 快気祝い | 118 | 2 | 116 | -98.3% |
| 13 | お詫び お菓子 | 160 | 45 | 115 | -71.9% |
| 14 | 社長就任祝い | 294 | 181 | 113 | -38.4% |
| 15 | 開院祝い | 212 | 122 | 90 | -42.5% |
| 16 | お詫び 菓子折り | 136 | 47 | 89 | -65.4% |
| 17 | 退職 手土産 | 147 | 60 | 87 | -59.2% |
| 18 | クリニック 内覧会 手土産 | 100 | 13 | 87 | -87.0% |
| 19 | 退職 菓子折り おすすめ | 151 | 66 | 85 | -56.3% |
| 20 | お世話になりました お菓子 | 136 | 54 | 82 | -60.3% |
| 21 | 開業祝い お返し | 119 | 44 | 75 | -63.0% |
| 22 | 叙勲のお祝い | 139 | 65 | 74 | -53.2% |
| 23 | 開店祝い お返し | 97 | 26 | 71 | -73.2% |
| 24 | 叙勲 褒章 違い | 70 | 1 | 69 | -98.6% |
| 25 | お礼 お菓子 | 67 | 3 | 64 | -95.5% |


**考察（下落クエリ）**

> 下落 25 件のうち、**前年比 100 クリック以上の減少が 14 件**。
> クラスタ別では お詫び・謝罪（9件） / 退職・お菓子（8件） / 就任・昇進・社長（5件） で複数クエリが同時に減少 → 個別ページ単位より **クラスタ単位（SERP 変化・競合参入・意図の変化）** で検証が効率的。
> 減少幅トップ3: `叙勲 お祝い`(-626)、`お詫びの品`(-356)、`退職 お菓子 おすすめ`(-330)。

### ランディングページ（現在クリック上位 25 件 × 前年同期）

| 順位 | URL | 現在クリック | 前年クリック | 増減 | 変化率 |
|------|-----|-------------|-------------|------|--------|
| 1 | https://business.mistore.jp/magazine/article/2638 | 7,671 | 9,826 | -2,155 | -21.9% |
| 2 | https://business.mistore.jp/magazine/article/3033 | 6,244 | 5,654 | +590 | +10.4% |
| 3 | https://business.mistore.jp/magazine/article/315 | 5,299 | 8,501 | -3,202 | -37.7% |
| 4 | https://business.mistore.jp/magazine/article/4184 | 3,310 | 283 | +3,027 | +1069.6% |
| 5 | https://business.mistore.jp/magazine/article/5264 | 1,854 | 2,397 | -543 | -22.7% |
| 6 | https://business.mistore.jp/magazine/article/722 | 1,468 | 4,476 | -3,008 | -67.2% |
| 7 | https://business.mistore.jp/magazine/article/2345 | 1,224 | 0 | +1,224 | — |
| 8 | https://business.mistore.jp/magazine/article/287 | 1,145 | 1,505 | -360 | -23.9% |
| 9 | https://business.mistore.jp/magazine/article/2413 | 1,110 | 933 | +177 | +19.0% |
| 10 | https://business.mistore.jp/magazine/article/244 | 986 | 1,359 | -373 | -27.4% |
| 11 | https://business.mistore.jp/magazine/article/1677 | 970 | 1,455 | -485 | -33.3% |
| 12 | https://business.mistore.jp/magazine/article/2321 | 952 | 1,305 | -353 | -27.0% |
| 13 | https://business.mistore.jp/magazine/article/691 | 951 | 1,706 | -755 | -44.3% |
| 14 | https://business.mistore.jp/magazine/article/4248 | 905 | 1,279 | -374 | -29.2% |
| 15 | https://business.mistore.jp/magazine/article/2704 | 893 | 888 | +5 | +0.6% |
| 16 | https://business.mistore.jp/magazine/article/665 | 889 | 1,256 | -367 | -29.2% |
| 17 | https://business.mistore.jp/magazine/article/2899 | 887 | 671 | +216 | +32.2% |
| 18 | https://business.mistore.jp/magazine/article/4128 | 830 | 1,180 | -350 | -29.7% |
| 19 | https://business.mistore.jp/magazine/article/2383 | 719 | 705 | +14 | +2.0% |
| 20 | https://business.mistore.jp/ | 682 | 698 | -16 | -2.3% |
| 21 | https://business.mistore.jp/magazine/article/157 | 676 | 986 | -310 | -31.4% |
| 22 | https://business.mistore.jp/magazine/article/159 | 648 | 1,484 | -836 | -56.3% |
| 23 | https://business.mistore.jp/magazine/article/2570 | 610 | 677 | -67 | -9.9% |
| 24 | https://business.mistore.jp/magazine/article/4373 | 604 | 199 | +405 | +203.5% |
| 25 | https://business.mistore.jp/shop/pages/article47.aspx | 597 | 1,895 | -1,298 | -68.5% |


**考察（上位ページ × 前年）**

> 上位 25 URL の合計クリックは現在 42,124、前年 51,318（-17.9%）。
> 内訳は マガジン記事（23件） / ショップ記事ページ（1件） / トップ（1件）。
> 上位URLの 17/25 が前年比マイナス。**主力ページ群が同時に弱含み**であり、テンプレ・内部リンク・SERP 監査の優先度が高い。

### ランディングページ（前年同期比で伸長したもの）

前年同期よりクリックが増えた URL を、**クリック増加幅**の大きい順に最大 25 件表示しています。

| 順位 | URL | 現在クリック | 前年クリック | 増加 | 変化率 |
|------|-----|-------------|-------------|------|--------|
| 1 | https://business.mistore.jp/magazine/article/4184 | 3,310 | 283 | 3,027 | +1069.6% |
| 2 | https://business.mistore.jp/magazine/article/2345 | 1,224 | 0 | 1,224 | — |
| 3 | https://business.mistore.jp/magazine/article/3033 | 6,244 | 5,654 | 590 | +10.4% |
| 4 | https://business.mistore.jp/magazine/article/8025 | 568 | 0 | 568 | — |
| 5 | https://business.mistore.jp/magazine/article/707 | 586 | 145 | 441 | +304.1% |
| 6 | https://business.mistore.jp/magazine/article/4373 | 604 | 199 | 405 | +203.5% |
| 7 | https://business.mistore.jp/shop/c/c01_iP04/ | 350 | 110 | 240 | +218.2% |
| 8 | https://business.mistore.jp/magazine/article/336 | 240 | 0 | 240 | — |
| 9 | https://business.mistore.jp/magazine/article/1733 | 406 | 172 | 234 | +136.0% |
| 10 | https://business.mistore.jp/magazine/article/8023 | 234 | 0 | 234 | — |
| 11 | https://business.mistore.jp/magazine/article/4013 | 225 | 0 | 225 | — |
| 12 | https://business.mistore.jp/magazine/article/2899 | 887 | 671 | 216 | +32.2% |
| 13 | https://business.mistore.jp/magazine/article/1345 | 378 | 165 | 213 | +129.1% |
| 14 | https://business.mistore.jp/magazine/article/8027 | 194 | 0 | 194 | — |
| 15 | https://business.mistore.jp/magazine/article/2413 | 1,110 | 933 | 177 | +19.0% |
| 16 | https://business.mistore.jp/magazine/article/4677 | 236 | 96 | 140 | +145.8% |
| 17 | https://business.mistore.jp/magazine/article/971 | 113 | 0 | 113 | — |
| 18 | https://business.mistore.jp/shop/o/oslctgift/ | 112 | 0 | 112 | — |
| 19 | https://business.mistore.jp/shop/o/ooverseas/ | 104 | 0 | 104 | — |
| 20 | https://business.mistore.jp/shop/g/g008W-124/ | 102 | 0 | 102 | — |
| 21 | https://business.mistore.jp/magazine/article/6128 | 94 | 0 | 94 | — |
| 22 | https://business.mistore.jp/shop/o/ohouyou | 93 | 0 | 93 | — |
| 23 | https://business.mistore.jp/magazine/article/5033 | 90 | 0 | 90 | — |
| 24 | https://business.mistore.jp/magazine/article/630 | 197 | 111 | 86 | +77.5% |
| 25 | https://business.mistore.jp/shop/customer/menu.aspx | 84 | 0 | 84 | — |


**考察（伸長ページ）**

> 伸長 25 URL のうち、**前年同期 0 クリックから新規露出が 14 URL**。新規記事・新URLのインデックス進行が一定数寄与。
> 内訳は マガジン記事（19件） / ショップ用途・カテゴリ（4件） / ショップ商品ページ（1件）。
> 上位3件: `/magazine/article/4184`(+3027)、`/magazine/article/2345`(+1224)、`/magazine/article/3033`(+590)。**成功要因（タイトル・見出し・内部リンク・被リンク）を抽出し横展開**するテンプレ化候補。

### ランディングページ（前年同期に強かったが減少したもの）

前年同期のクリックが **30 以上** かつ現在のクリックが前年より少ない URL を、**クリック減少幅**の大きい順に最大 25 件表示しています。

| 順位 | URL | 前年クリック | 現在クリック | 減少 | 変化率 |
|------|-----|-------------|-------------|------|--------|
| 1 | https://business.mistore.jp/magazine/article/315 | 8,501 | 5,299 | 3,202 | -37.7% |
| 2 | https://business.mistore.jp/magazine/article/722 | 4,476 | 1,468 | 3,008 | -67.2% |
| 3 | https://business.mistore.jp/magazine/article/2638 | 9,826 | 7,671 | 2,155 | -21.9% |
| 4 | https://business.mistore.jp/shop/pages/article47.aspx | 1,895 | 597 | 1,298 | -68.5% |
| 5 | https://business.mistore.jp/magazine/article/159 | 1,484 | 648 | 836 | -56.3% |
| 6 | https://business.mistore.jp/magazine/article/691 | 1,706 | 951 | 755 | -44.3% |
| 7 | https://business.mistore.jp/magazine/article/1458 | 1,196 | 450 | 746 | -62.4% |
| 8 | https://business.mistore.jp/shop/i/iP04?occasion=temiyage | 1,197 | 577 | 620 | -51.8% |
| 9 | https://business.mistore.jp/magazine/article/5264 | 2,397 | 1,854 | 543 | -22.7% |
| 10 | https://business.mistore.jp/shop/i/iP05?occasion=temiyage | 601 | 106 | 495 | -82.4% |
| 11 | https://business.mistore.jp/magazine/article/1677 | 1,455 | 970 | 485 | -33.3% |
| 12 | https://business.mistore.jp/shop/i/iP05?occasion=okaeshi | 677 | 205 | 472 | -69.7% |
| 13 | https://business.mistore.jp/magazine/article/2932 | 908 | 479 | 429 | -47.2% |
| 14 | https://business.mistore.jp/magazine/article/592 | 642 | 241 | 401 | -62.5% |
| 15 | https://business.mistore.jp/magazine/article/4248 | 1,279 | 905 | 374 | -29.2% |
| 16 | https://business.mistore.jp/magazine/article/244 | 1,359 | 986 | 373 | -27.4% |
| 17 | https://business.mistore.jp/magazine/article/665 | 1,256 | 889 | 367 | -29.2% |
| 18 | https://business.mistore.jp/magazine/article/287 | 1,505 | 1,145 | 360 | -23.9% |
| 19 | https://business.mistore.jp/shop/pages/article175.aspx | 639 | 279 | 360 | -56.3% |
| 20 | https://business.mistore.jp/magazine/article/2321 | 1,305 | 952 | 353 | -27.0% |
| 21 | https://business.mistore.jp/magazine/article/4128 | 1,180 | 830 | 350 | -29.7% |
| 22 | https://business.mistore.jp/shop/o/otemiyage/ | 589 | 261 | 328 | -55.7% |
| 23 | https://business.mistore.jp/magazine/article/832 | 739 | 422 | 317 | -42.9% |
| 24 | https://business.mistore.jp/magazine/article/157 | 986 | 676 | 310 | -31.4% |
| 25 | https://business.mistore.jp/shop/pages/article257.aspx | 275 | 0 | 275 | -100.0% |


**考察（下落ページ）**

> 下落 25 URL のうち、**前年比 200 クリック以上の減少が 25 URL**。
> 内訳は マガジン記事（18件） / ショップ用途・カテゴリ（4件） / ショップ記事ページ（3件）。
> 減少幅トップ3: `/magazine/article/315`(-3202)、`/magazine/article/722`(-3008)、`/magazine/article/2638`(-2155)。最初に **SERP 監査と意図のズレ確認**を行い、改修 or 統合 or 縮小を判断する。

## サイト全体 — GA4（集客・購入）

| 指標 | 現在 | 前年同期 | 変化 |
|------|------|----------|------|
| セッション | 113,878 | 139,237 | -25,359 / -18.2%（注意） |
| ユーザー | 95,649 | 115,696 | -20,047 / -17.3%（注意） |
| ページビュー | 401,219 | 441,310 | -40,091 / -9.1%（注意） |
| 購入完了（件数） | 615 | 490 | +125 / +25.5%（好調） |
| 売上（推定） | ¥18,516,338 | ¥14,936,855 | +3,579,483円 / +24.0%（好調） |
| CVR（セッション比） | 0.54% | 0.35% | +0.19% / +54.3%（好調） |


**考察（サイト全体 GA4 サマリ）**

> セッション -18.2%、購入完了 +25.5%、売上 +24.0%、CVR 0.54%（前年 0.35%）。
> **流入は減ったが購入は増加** → サイト/商品/カート導線の **質の改善** が効いている可能性。逆に「流入の母集団が法人/購入意図の高い層に絞られた」可能性も併せて検証する。
> セッション減 × 売上増 は短期では「効率改善」だが、**中期的にはトップ・オブ・ファネルの再投資が必要**。

### チャネル別（現在期間）

| チャネル | セッション | ユーザー | 購入完了 | 売上 |
|----------|-----------|----------|----------|------|
| Organic Search | 96,339 | 84,855 | 230 | ¥6,880,241 |
| Direct | 9,690 | 6,593 | 318 | ¥9,358,884 |
| Referral | 3,069 | 2,223 | 24 | ¥355,765 |
| Unassigned | 1,896 | 1,592 | 6 | ¥69,616 |
| Email | 1,062 | 557 | 42 | ¥1,451,102 |
| Display | 105 | 41 | 3 | ¥400,730 |
| (other) | 47 | 46 | 0 | ¥0 |
| Organic Social | 7 | 7 | 0 | ¥0 |
| Paid Search | 7 | 7 | 0 | ¥0 |
| Organic Video | 1 | 1 | 0 | ¥0 |

### チャネル別（前年同期）

| チャネル | セッション | ユーザー | 購入完了 | 売上 |
|----------|-----------|----------|----------|------|
| Organic Search | 121,488 | 105,483 | 168 | ¥5,075,159 |
| Direct | 9,064 | 5,981 | 236 | ¥7,292,280 |
| Referral | 5,045 | 3,399 | 35 | ¥615,395 |
| Email | 2,390 | 1,312 | 46 | ¥1,764,403 |
| Unassigned | 1,246 | 1,031 | 5 | ¥189,618 |
| Organic Social | 27 | 25 | 0 | ¥0 |
| Paid Search | 5 | 4 | 0 | ¥0 |
| Organic Video | 3 | 3 | 0 | ¥0 |


**考察（チャネル別）**

> 売上構成上位3チャネルは Direct（¥9,358,884、51%） / Organic Search（¥6,880,241、37%） / Email（¥1,451,102、8%）。
> Organic Search: セッション -20.7%・購入完了 +36.9%。集客減でも購入は維持/改善できているかを毎月チェック。
> **Direct が売上構成の主軸**（51%）。法人リピート・指名流入の比率が高い可能性。直接訪問の質の維持と、Organic からの新規認知補強が両輪。
> Email の購入 42 件・売上 ¥1,451,102。**少セッションで高効率**のチャネル。配信頻度・セグメントの強化余地あり。

### デバイス別（現在 / 前年）

**現在**

| デバイス | セッション | ユーザー | 購入完了 | 売上 |
|----------|-----------|----------|----------|------|
| mobile | 79,164 | 70,133 | 91 | ¥502,245 |
| desktop | 32,959 | 23,694 | 530 | ¥17,896,858 |
| tablet | 1,110 | 996 | 2 | ¥117,235 |
| (other) | 2 | 2 | 0 | ¥0 |

**前年同期**

| デバイス | セッション | ユーザー | 購入完了 | 売上 |
|----------|-----------|----------|----------|------|
| mobile | 100,326 | 85,373 | 95 | ¥606,925 |
| desktop | 38,344 | 28,234 | 393 | ¥14,284,005 |
| tablet | 1,813 | 1,596 | 2 | ¥45,925 |


**考察（デバイス別）**

> **desktop が売上の 97%**（¥17,896,858）。法人サイトの典型的なオフィス購買パターンを反映。
> mobile はセッションで desktop の 2.4倍だが、CVR は mobile 0.11% vs desktop 1.61%。**mobile は認知・比較フェーズが中心**で、desktop が決済の主戦場。mobile→PC 跨ぎの計測と、mobile からの「あとで PC で買う」導線の強化を検討。
> desktop 購入完了 +34.9%（393 → 530）。


---

## /magazine/ — GSC

| 指標 | 現在 | 前年同期 | 変化 |
|------|------|----------|------|
| クリック | 51,769 | 60,669 | -8,900 / -14.7%（注意） |
| インプレッション | 3,298,213 | 3,152,457 | +145,756 / +4.6%（好調） |
| 平均CTR | 1.57% | 1.92% | -0.35% / -18.2%（注意） |
| 平均掲載順位 | 6.54 | 7.74 | -1.2 / -15.5%（好調） |


**考察（マガジン GSC）**

> マガジン: クリック -14.7%、インプレッション +4.6%、平均CTR -18.2%、平均掲載順位 -1.20。
> **マガジンの露出はサイト全体より相対的に堅調**。記事資産の SEO 価値は維持されており、CTR・順位の精緻化で流入回復の余地がある。

### マガジン クエリポートフォリオ（季節語の目安・現在期間）

| 区分 | クエリ行数 | クリック | シェア | インプレッション | シェア |
|------|------------|----------|--------|------------------|--------|
| 季節語ヒット | 849 | 231 | 0.8% | 80,367 | 4.2% |
| 通年寄り | 9,151 | 29,559 | 99.2% | 1,853,499 | 95.8% |


**考察（マガジン クエリポートフォリオ）**

> マガジンのクリックは **通年クエリが 99.2%** を占めており、年間を通じた継続施策の効果が出やすい構造。
> ※ 「お歳暮」「お中元」等のルール語のみで判定（`src/lib/querySeason.ts`）。実際の意図（贈答シーンの季節性）と差がある場合は、ルール拡張を検討。

### マガジン 検索クエリ（現在クリック上位 20 件 × 前年同期）

| 順位 | クエリ | 現在クリック | 前年クリック | 増減 | 変化率 |
|------|--------|-------------|-------------|------|--------|
| 1 | 退職 お菓子 | 1,319 | 923 | +396 | +42.9% |
| 2 | 香典返し | 547 | 0 | +547 | — |
| 3 | 退職 お菓子 個包装 | 480 | 466 | +14 | +3.0% |
| 4 | お詫びの品 | 432 | 784 | -352 | -44.9% |
| 5 | コーヒー ギフト | 357 | 1 | +356 | +35600.0% |
| 6 | 退職 お菓子 おすすめ | 351 | 681 | -330 | -48.5% |
| 7 | 差し入れ お菓子 | 266 | 116 | +150 | +129.3% |
| 8 | 退職時 お菓子 | 241 | 291 | -50 | -17.2% |
| 9 | 退職 お菓子 おしゃれ 個包装 人気 | 217 | 270 | -53 | -19.6% |
| 10 | 差し入れ おすすめ | 212 | 279 | -67 | -24.0% |
| 11 | 社長就任祝い | 181 | 293 | -112 | -38.2% |
| 12 | コーヒーギフト | 174 | 0 | +174 | — |
| 13 | コーヒー ギフト 高級 | 161 | 0 | +161 | — |
| 14 | コーヒー ギフト おしゃれ | 150 | 1 | +149 | +14900.0% |
| 15 | 謝罪 菓子折り | 137 | 391 | -254 | -65.0% |
| 16 | コーヒー プレゼント | 136 | 0 | +136 | — |
| 17 | 退職お菓子 | 131 | 110 | +21 | +19.1% |
| 18 | 謝罪 手土産 | 129 | 294 | -165 | -56.1% |
| 19 | 開院祝い | 122 | 213 | -91 | -42.7% |
| 20 | ドリップコーヒー ギフト | 121 | 0 | +121 | — |


**考察（マガジン 上位クエリ × 前年）**

> 上位 20 件のうち、前年同期比で **増加 11 件 / 減少 9 件**。
> 主要クラスタは 退職・お菓子（7件） / コーヒー・紅茶ギフト（6件） / お詫び・謝罪（3件）。
> 最大の伸びは `香典返し`（0 → 547、+547）。
> 最大の落ち込みは `お詫びの品`（784 → 432、-352）。

### マガジン 検索クエリ（前年同期比で伸長したもの）

| 順位 | クエリ | 現在クリック | 前年クリック | 増加 | 変化率 |
|------|--------|-------------|-------------|------|--------|
| 1 | 香典返し | 547 | 0 | 547 | — |
| 2 | 退職 お菓子 | 1,319 | 923 | 396 | +42.9% |
| 3 | コーヒーギフト | 174 | 0 | 174 | — |
| 4 | コーヒー ギフト 高級 | 161 | 0 | 161 | — |
| 5 | 差し入れ お菓子 | 266 | 116 | 150 | +129.3% |
| 6 | コーヒー プレゼント | 136 | 0 | 136 | — |
| 7 | ドリップコーヒー ギフト | 121 | 0 | 121 | — |
| 8 | 餞別の品 | 89 | 0 | 89 | — |
| 9 | 昇進祝い | 88 | 0 | 88 | — |
| 10 | コーヒーギフト おすすめ | 83 | 0 | 83 | — |
| 11 | 高級コーヒー ギフト | 71 | 0 | 71 | — |
| 12 | 昇進祝い 女性 | 116 | 53 | 63 | +118.9% |
| 13 | もらって 嬉しいコーヒー ギフト | 61 | 0 | 61 | — |
| 14 | 株主総会 お土産 2026 | 58 | 0 | 58 | — |
| 15 | コーヒー ギフト 高級 人気 | 57 | 0 | 57 | — |
| 16 | 上棟 差し入れ | 87 | 33 | 54 | +163.6% |
| 17 | 開業祝い | 69 | 15 | 54 | +360.0% |
| 18 | コーヒー ギフト おしゃれ 美味しい | 54 | 0 | 54 | — |
| 19 | コーヒー ギフト おすすめ | 52 | 0 | 52 | — |
| 20 | ビール ギフト | 77 | 26 | 51 | +196.2% |


**考察（マガジン 伸長クエリ）**

> 伸長 20 件のうち、**前年同期にクリック 0 から新規露出が 14 件**、既存からの上積みが 6 件。
> クラスタ別では コーヒー・紅茶ギフト（10件） / 就任・昇進・社長（2件） / 差し入れ・手土産（2件） に伸びが集中。
> 上位3件: `香典返し`(+547)、`退職 お菓子`(+396)、`コーヒーギフト`(+174)。

### マガジン 検索クエリ（前年同期に強かったが減少したもの）

前年同期のクリックが **20 以上** かつ現在より少ないクエリを、クリック減少幅の大きい順に最大 20 件です。

| 順位 | クエリ | 前年クリック | 現在クリック | 減少 | 変化率 |
|------|--------|-------------|-------------|------|--------|
| 1 | 叙勲 お祝い | 748 | 119 | 629 | -84.1% |
| 2 | お詫びの品 | 784 | 432 | 352 | -44.9% |
| 3 | 退職 お菓子 おすすめ | 681 | 351 | 330 | -48.5% |
| 4 | 謝罪 菓子折り | 391 | 137 | 254 | -65.0% |
| 5 | 菓子折り 謝罪 | 246 | 71 | 175 | -71.1% |
| 6 | 差し入れ | 251 | 78 | 173 | -68.9% |
| 7 | 謝罪 手土産 | 294 | 129 | 165 | -56.1% |
| 8 | 菓子折り おすすめ | 186 | 43 | 143 | -76.9% |
| 9 | お詫びのお菓子 | 160 | 26 | 134 | -83.8% |
| 10 | 叙勲とは | 133 | 3 | 130 | -97.7% |
| 11 | お詫び お菓子 | 159 | 45 | 114 | -71.7% |
| 12 | 社長就任祝い | 293 | 181 | 112 | -38.2% |
| 13 | 開院祝い | 213 | 122 | 91 | -42.7% |
| 14 | 退職 手土産 | 147 | 60 | 87 | -59.2% |
| 15 | クリニック 内覧会 手土産 | 100 | 13 | 87 | -87.0% |
| 16 | 退職 菓子折り おすすめ | 152 | 66 | 86 | -56.6% |
| 17 | お詫び 菓子折り | 130 | 46 | 84 | -64.6% |
| 18 | お世話になりました お菓子 | 136 | 54 | 82 | -60.3% |
| 19 | 叙勲のお祝い | 140 | 65 | 75 | -53.6% |
| 20 | 開業祝い お返し | 120 | 45 | 75 | -62.5% |


**考察（マガジン 下落クエリ）**

> 下落 20 件のうち、**前年比 100 クリック以上の減少が 12 件**。
> クラスタ別では お詫び・謝罪（9件） / 退職・お菓子（8件） / 就任・昇進・社長（4件） で複数クエリが同時に減少 → 個別ページ単位より **クラスタ単位（SERP 変化・競合参入・意図の変化）** で検証が効率的。
> 減少幅トップ3: `叙勲 お祝い`(-629)、`お詫びの品`(-352)、`退職 お菓子 おすすめ`(-330)。

### マガジン ページ（現在クリック上位 20 件 × 前年同期）

| 順位 | URL | 現在クリック | 前年クリック | 増減 | 変化率 |
|------|-----|-------------|-------------|------|--------|
| 1 | https://business.mistore.jp/magazine/article/2638 | 7,671 | 9,826 | -2,155 | -21.9% |
| 2 | https://business.mistore.jp/magazine/article/3033 | 6,244 | 5,654 | +590 | +10.4% |
| 3 | https://business.mistore.jp/magazine/article/315 | 5,299 | 8,501 | -3,202 | -37.7% |
| 4 | https://business.mistore.jp/magazine/article/4184 | 3,310 | 283 | +3,027 | +1069.6% |
| 5 | https://business.mistore.jp/magazine/article/5264 | 1,854 | 2,397 | -543 | -22.7% |
| 6 | https://business.mistore.jp/magazine/article/722 | 1,468 | 4,476 | -3,008 | -67.2% |
| 7 | https://business.mistore.jp/magazine/article/2345 | 1,224 | 50 | +1,174 | +2348.0% |
| 8 | https://business.mistore.jp/magazine/article/287 | 1,145 | 1,505 | -360 | -23.9% |
| 9 | https://business.mistore.jp/magazine/article/2413 | 1,110 | 933 | +177 | +19.0% |
| 10 | https://business.mistore.jp/magazine/article/244 | 986 | 1,359 | -373 | -27.4% |
| 11 | https://business.mistore.jp/magazine/article/1677 | 970 | 1,455 | -485 | -33.3% |
| 12 | https://business.mistore.jp/magazine/article/2321 | 952 | 1,305 | -353 | -27.0% |
| 13 | https://business.mistore.jp/magazine/article/691 | 951 | 1,706 | -755 | -44.3% |
| 14 | https://business.mistore.jp/magazine/article/4248 | 905 | 1,279 | -374 | -29.2% |
| 15 | https://business.mistore.jp/magazine/article/2704 | 893 | 888 | +5 | +0.6% |
| 16 | https://business.mistore.jp/magazine/article/665 | 889 | 1,256 | -367 | -29.2% |
| 17 | https://business.mistore.jp/magazine/article/2899 | 887 | 671 | +216 | +32.2% |
| 18 | https://business.mistore.jp/magazine/article/4128 | 830 | 1,180 | -350 | -29.7% |
| 19 | https://business.mistore.jp/magazine/article/2383 | 719 | 705 | +14 | +2.0% |
| 20 | https://business.mistore.jp/magazine/article/157 | 676 | 986 | -310 | -31.4% |


**考察（マガジン 上位ページ × 前年）**

> 上位 20 URL の合計クリックは現在 38,983、前年 46,415（-16.0%）。
> 内訳は マガジン記事（20件）。
> 上位URLの 13/20 が前年比マイナス。**主力ページ群が同時に弱含み**であり、テンプレ・内部リンク・SERP 監査の優先度が高い。

### マガジン ページ（前年同期比で伸長したもの）

| 順位 | URL | 現在クリック | 前年クリック | 増加 | 変化率 |
|------|-----|-------------|-------------|------|--------|
| 1 | https://business.mistore.jp/magazine/article/4184 | 3,310 | 283 | 3,027 | +1069.6% |
| 2 | https://business.mistore.jp/magazine/article/2345 | 1,224 | 50 | 1,174 | +2348.0% |
| 3 | https://business.mistore.jp/magazine/article/3033 | 6,244 | 5,654 | 590 | +10.4% |
| 4 | https://business.mistore.jp/magazine/article/8025 | 568 | 19 | 549 | +2889.5% |
| 5 | https://business.mistore.jp/magazine/article/707 | 586 | 145 | 441 | +304.1% |
| 6 | https://business.mistore.jp/magazine/article/4373 | 604 | 199 | 405 | +203.5% |
| 7 | https://business.mistore.jp/magazine/article/1733 | 406 | 172 | 234 | +136.0% |
| 8 | https://business.mistore.jp/magazine/article/8023 | 234 | 0 | 234 | — |
| 9 | https://business.mistore.jp/magazine/article/2899 | 887 | 671 | 216 | +32.2% |
| 10 | https://business.mistore.jp/magazine/article/1345 | 378 | 165 | 213 | +129.1% |
| 11 | https://business.mistore.jp/magazine/article/4013 | 225 | 28 | 197 | +703.6% |
| 12 | https://business.mistore.jp/magazine/article/8027 | 194 | 0 | 194 | — |
| 13 | https://business.mistore.jp/magazine/article/336 | 240 | 53 | 187 | +352.8% |
| 14 | https://business.mistore.jp/magazine/article/2413 | 1,110 | 933 | 177 | +19.0% |
| 15 | https://business.mistore.jp/magazine/article/4677 | 236 | 96 | 140 | +145.8% |
| 16 | https://business.mistore.jp/magazine/article/630 | 197 | 111 | 86 | +77.5% |
| 17 | https://business.mistore.jp/magazine/article/3700 | 80 | 0 | 80 | — |
| 18 | https://business.mistore.jp/magazine/article/6128 | 94 | 20 | 74 | +370.0% |
| 19 | https://business.mistore.jp/magazine/article/2365 | 167 | 96 | 71 | +74.0% |
| 20 | https://business.mistore.jp/magazine/article/4151 | 140 | 84 | 56 | +66.7% |


**考察（マガジン 伸長ページ）**

> 伸長 20 URL のうち、**前年同期 0 クリックから新規露出が 3 URL**。新規記事・新URLのインデックス進行が一定数寄与。
> 内訳は マガジン記事（20件）。
> 上位3件: `/magazine/article/4184`(+3027)、`/magazine/article/2345`(+1174)、`/magazine/article/3033`(+590)。**成功要因（タイトル・見出し・内部リンク・被リンク）を抽出し横展開**するテンプレ化候補。

### マガジン ページ（前年同期に強かったが減少したもの）

前年同期のクリックが **15 以上** かつ現在より少ない URL を、クリック減少幅の大きい順に最大 20 件です。

| 順位 | URL | 前年クリック | 現在クリック | 減少 | 変化率 |
|------|-----|-------------|-------------|------|--------|
| 1 | https://business.mistore.jp/magazine/article/315 | 8,501 | 5,299 | 3,202 | -37.7% |
| 2 | https://business.mistore.jp/magazine/article/722 | 4,476 | 1,468 | 3,008 | -67.2% |
| 3 | https://business.mistore.jp/magazine/article/2638 | 9,826 | 7,671 | 2,155 | -21.9% |
| 4 | https://business.mistore.jp/magazine/article/159 | 1,484 | 648 | 836 | -56.3% |
| 5 | https://business.mistore.jp/magazine/article/691 | 1,706 | 951 | 755 | -44.3% |
| 6 | https://business.mistore.jp/magazine/article/1458 | 1,196 | 450 | 746 | -62.4% |
| 7 | https://business.mistore.jp/magazine/article/5264 | 2,397 | 1,854 | 543 | -22.7% |
| 8 | https://business.mistore.jp/magazine/article/1677 | 1,455 | 970 | 485 | -33.3% |
| 9 | https://business.mistore.jp/magazine/article/2932 | 908 | 479 | 429 | -47.2% |
| 10 | https://business.mistore.jp/magazine/article/592 | 642 | 241 | 401 | -62.5% |
| 11 | https://business.mistore.jp/magazine/article/4248 | 1,279 | 905 | 374 | -29.2% |
| 12 | https://business.mistore.jp/magazine/article/244 | 1,359 | 986 | 373 | -27.4% |
| 13 | https://business.mistore.jp/magazine/article/665 | 1,256 | 889 | 367 | -29.2% |
| 14 | https://business.mistore.jp/magazine/article/287 | 1,505 | 1,145 | 360 | -23.9% |
| 15 | https://business.mistore.jp/magazine/article/2321 | 1,305 | 952 | 353 | -27.0% |
| 16 | https://business.mistore.jp/magazine/article/4128 | 1,180 | 830 | 350 | -29.7% |
| 17 | https://business.mistore.jp/magazine/article/832 | 739 | 422 | 317 | -42.9% |
| 18 | https://business.mistore.jp/magazine/article/157 | 986 | 676 | 310 | -31.4% |
| 19 | https://business.mistore.jp/magazine/article/816 | 425 | 152 | 273 | -64.2% |
| 20 | https://business.mistore.jp/magazine/article/2433 | 323 | 123 | 200 | -61.9% |


**考察（マガジン 下落ページ）**

> 下落 20 URL のうち、**前年比 200 クリック以上の減少が 20 URL**。
> 内訳は マガジン記事（20件）。
> 減少幅トップ3: `/magazine/article/315`(-3202)、`/magazine/article/722`(-3008)、`/magazine/article/2638`(-2155)。最初に **SERP 監査と意図のズレ確認**を行い、改修 or 統合 or 縮小を判断する。

## /magazine/ — GA4（トラフィック）

| 指標 | 現在 | 前年同期 | 変化 |
|------|------|----------|------|
| セッション | 77,375 | 91,232 | -13,857 / -15.2%（注意） |
| ユーザー | 68,678 | 77,659 | -8,981 / -11.6%（注意） |
| ページビュー | 88,616 | 102,047 | -13,431 / -13.2%（注意） |


**考察（マガジン GA4）**

> マガジン GA4: セッション -15.2%、ユーザー -11.6%、ページビュー -13.2%。
> マガジン配下の **購入帰属** は標準 Data API では精緻に取れない。GA4 探索の「セグメント重複」や、マガジン LP → 商品 PV → 購入完了 の遷移をユーザープロパティ/イベントで定点化することを推奨（`docs/GA4_CORPORATE_INTENT_PROXY.md`）。

*サイト全体の売上・購入完了は上記「サイト全体」セクションを参照してください。*

### 戦略レビュー（ドキュメント）

- 四半期アジェンダ: `docs/SEO_STRATEGY_GOVERNANCE.md`
- 法人意図のプロキシと GA4 の限界: `docs/GA4_CORPORATE_INTENT_PROXY.md`
- （本 Markdown を `docs/` 以外に保存した場合は、上記パスに `docs/` を付与して参照してください）

---

*自動生成レポート*


<!-- COMPREHENSIVE_SNAPSHOT_END -->
