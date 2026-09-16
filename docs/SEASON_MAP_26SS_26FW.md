# 26SS→26FW 商品コード切替

2026年春夏（S26）商品を 2026年秋冬（F26）へ切り替えるための API 対応です。

切替時刻: **2026-09-18 10:00 JST**（UTC 01:00）

相対表は 466 組。うち 463 組は同一ベースの `S26`→`F26`、3 組だけ接頭辞が `M`→`R` に変わります。

## 動き

- 切替前: SS コードはそのまま SS を返す。マップは適用しない。
- 切替後: SS コードは FW 商品（価格・画像・FW URL）に解決する。
- 複数コード取得（雑誌カード）では、照合のため `product_code` を要求コードのまま返し、`canonical_product_code` と FW の `product_url` を付ける。
- 単体取得・検索は canonical（FW）を返す。
- FW が未クロールなら、SS の最終スナップショット（または相対表の名前）を FW URL 付きで返す。SS の「販売終了」は引き継がない。

環境変数 `SEASON_MAP_ACTIVE_AT` で切替時刻を上書きできる（ISO 8601）。未設定時は `2026-09-18T01:00:00.000Z`。

## 事前準備（9/17まで）

1. この変更を mi-business-online にデプロイする。
2. FW 466 件をシード＋クロールする。

```bash
# 本番（Render）
curl -X POST "https://mi-business-online.onrender.com/api/cron/crawl-season-map" \
  -H "Authorization: Bearer $CRON_SECRET"

# 名前だけ先に入れる場合
curl -X POST "https://mi-business-online.onrender.com/api/cron/crawl-season-map?seed_only=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

ローカル:

```bash
npx tsx scripts/crawl-season-map.ts --seed-only
npx tsx scripts/crawl-season-map.ts
```

確認例:

```bash
curl "https://mi-business-online.onrender.com/api/products?product_code[]=gR600-303F26"
# 切替前の SS はまだ SS のまま
curl "https://mi-business-online.onrender.com/api/products?product_code[]=gR600-303S26"
```

## 切替当日 10:00

1. マップは時刻で自動的に有効になる。
2. FW を再クロールして価格・在庫を更新する（上記 `crawl-season-map`）。
3. 雑誌 WordPress の商品キャッシュを消す（未対応でも URL 書き換えが入っていれば表示は継続し、最大約 10 分で自然失効する）。

```bash
wp eval 'echo mi_magazine_flush_product_cache();'
# またはログイン済み管理者で
# POST /wp-json/mi-magazine/v1/flush-products
```

4. 例外 3 件をブラウザで確認する。
   - `M674-413S26` → `R674-413F26`
   - `M679-173S26` → `R679-173F26`
   - `M679-293S26` → `R679-293F26`

## テスト

```bash
npm run test:season-map
```
