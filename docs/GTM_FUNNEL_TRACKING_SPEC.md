# GTM ファネル計測仕様（business.mistore.jp）

過去期間の離脱はページパスで見られる（[`FUNNEL_DROPOFF_ANALYSIS.md`](FUNNEL_DROPOFF_ANALYSIS.md)）。この仕様は **ページでは見えない穴** を埋めるための GTM 設定書。コンテナへの実設定は行わない。

新規イベントは公開後のデータからしか取れない。お中元 vs 8月の比較には使わない。

---

## 0. 先に決めること

サイトには GTM が **2 本**、GA4 測定 ID が **2 本** 入っている。

| 種別 | ID |
|------|-----|
| GTM | `GTM-5S358FDK` / `GTM-52B9WN6` |
| GA4 | `G-WNW4C5WNYK` / `G-ET32THX6LV` |
| 旧 UA | `UA-115436407-1`（残存） |
| Ads | `AW-16843056123` / `AW-18190987491` |

**運用コンテナ 1 本だけ** に本仕様を入れる。レポートが読んでいるプロパティ（このリポジトリの `GA4_PROPERTY_ID`）にだけ GA4 イベントを送る。両方に送ると件数が二重になる。

公開前に GA4 管理画面で、既存の日本語イベントと新規 recommended イベントが二重カウントにならないか確認する。

---

## 1. いま取れているイベント（重複させない）

PDP 表示時の `dataLayer` に `view_item` も商品情報もない。既存は日本語カスタムイベントが中心。

| 既存イベント | 役割 | 本仕様での扱い |
|--------------|------|----------------|
| `商品詳細閲覧` | PDP 閲覧 | 残す。`view_item` を足す場合はパラメータだけ揃え、キーイベントにはしない |
| `カートビュー` | カート画面 | 残す。`view_cart` を別名で足すか、こちらを GA4 推奨名にマッピング |
| `購入完了` | レポートの正（件数） | **件数の正として維持**。`purchase` と件数を一致させる |
| `purchase` | 売上金額が載る | ecommerce items / value をここに集約。件数を `購入完了` と一致 |
| `支払完了` | 購入より多い | キーイベントから外すか、発火条件を文書化して止める |
| `新規会員登録ページ到達` | 登録 LP | 残す |
| `register_complete` | 会員完了 | 残す。`sign_up` を併用するなら method だけ付ける |
| `問い合せ閲覧` / `お問い合わせフォーム到達` | 問い合わせ | 残す。完了は `generate_lead` に統一可 |
| `view_search_results` / `mistore_site_search_*` | サイト内検索 | 残す |
| `add_to_cart` | **未計測** | 新設 |
| `begin_checkout` | **未計測** | 新設 |
| `login` | **未計測** | 新設 |

User Insight の法人属性は既に `dataLayer` に載っている（未ログイン時は空）。

```
us_emp_range, us_industry_name_l, us_sales_range, us_rs_code
```

会社名（`us_company_name`）・住所・電話・法人番号は **GA4 に送らない**。

---

## 2. 変数

コンテナ: 運用中の 1 本。命名は `DLV -` / `JS -` / `ED -`。

### 2.1 ページタイプ `JS - page_type`

Page URL から返す。優先順（上からマッチ）。

| パターン | 値 |
|----------|-----|
| `/magazine/` | `magazine` |
| `/shop/g/` | `pdp` |
| `/shop/cart/cart.aspx` | `cart` |
| `/shop/cart/goodsagree.aspx` | `checkout_agree` |
| `/shop/order/service.aspx` | `checkout_sender` |
| `/shop/order/dest.aspx` | `checkout_dest` |
| `/shop/order/detail.aspx` | `checkout_detail` |
| `/shop/order/estimate.aspx` | `checkout_estimate` |
| `/shop/order/save_estimate.aspx` | `quote_save` |
| `/shop/order/order.aspx` | `checkout_pay` |
| `/shop/customer/authmail` | `signup` |
| `/shop/customer/entry.aspx` | `signup_form` |
| `/shop/customer/login.aspx` または `menu.aspx` | `login` |
| `/shop/customer/addresslist.aspx` | `address_book` |
| `/shop/customer/` | `member` |
| `/shop/c/` | `category` |
| `/shop/i/` | `occasion` |
| `/shop/o/` | `feature` |
| `/shop/pages/portiapay.aspx` | `invoice_info` |
| その他 | `other` |

GA4 ユーザー定義ディメンション `page_type`（イベントスコープ）に送る。

### 2.2 ログイン `JS - logged_in`

ヘッダーが「こんにちは。ログインする」でなければ `true`。Cookie / 会員メニューの表示でも可。ユーザープロパティ `logged_in`（`true` / `false`）。

### 2.3 Data Layer 変数（User Insight）

| 変数 | dataLayer キー | GA4 | 送ってよいか |
|------|----------------|-----|----------------|
| `DLV - us_emp_range` | `us_emp_range` | ユーザープロパティ `company_size_range` | 可 |
| `DLV - us_industry_l` | `us_industry_name_l` | ユーザープロパティ `industry_l` | 可 |
| `DLV - us_sales_range` | `us_sales_range` | ユーザープロパティ `sales_range` | 可 |
| （作らない） | `us_company_name` 他 | — | 不可（PII） |

空文字のときはイベントパラメータを付けない。

### 2.4 クリック用

| 変数 | 種別 | 取得 |
|------|------|------|
| `Click Text` | 組み込み | クリック文言 |
| `Click Element` | 組み込み | 要素 |
| `JS - product_id` | カスタム JS | URL `/shop/g/{code}` の code、または PDP の商品番号 |
| `JS - product_name` | カスタム JS | `h1` / 商品名 |
| `JS - product_price` | カスタム JS | 税込価格（数値） |
| `JS - occasion_value` | カスタム JS | 用途プルダウンの選択値 |

---

## 3. トリガー（優先順）

実装は上から。1–8 がファネルの本線、9–10 が帰属と検索。

| # | 名前 | 種別 | 条件 |
|---|------|------|------|
| 1 | `Page - PDP` | ページビュー | `page_type` equals `pdp` |
| 2 | `Click - Add to cart` | クリック | リンク / ボタン文言に「カートへ入れる」。PDP のみ |
| 3 | `Page - Cart` | ページビュー | `page_type` equals `cart` |
| 4 | `Click - Begin checkout` | クリック | 文言「注文手続きへ進む」 |
| 5 | `Page - Checkout step` | ページビュー | `page_type` が `checkout_agree` / `checkout_sender` / `checkout_dest` / `checkout_detail` / `checkout_estimate` / `checkout_pay` |
| 6 | `Click - Save quote` | クリック | 文言に「一時保存」または「見積書」 |
| 7 | `Page - Quote save` | ページビュー | `page_type` equals `quote_save` または path に `impsaveestimate.aspx` |
| 8 | `Page - Purchase` | ページビュー | 既存の購入完了と同じ URL / dataLayer イベント。**既存タグの発火点を流用**し、二重にしない |
| 9 | `Click - Magazine to shop` | クリック | Page path に `/magazine/`、Click URL に `/shop/` |
| 10 | `Event - Site search` | 既存の `mistore_site_search_submit` を流用 | 新設しない |
| 11 | `Change - Occasion` | カスタムイベント or 変更 | 用途プルダウンの change |
| 12 | `Page - Signup complete` | 既存 `register_complete` を流用 | |
| 13 | `Click - Login submit` | クリック | `login.aspx` / `menu.aspx` のログインボタン |

Consent: CMP（`cmpWidget:thirdPartyReady`）後にだけ GA4 タグを出す。既存の同意トリガーに合わせる。

---

## 4. タグ（GA4 イベント）

すべて設定タグは運用 GA4 測定 ID の「Google アナリティクス: GA4 イベント」。

### 4.1 本線

| イベント名 | トリガー | パラメータ | キーイベント |
|------------|----------|------------|--------------|
| `view_item` | Page - PDP | `item_id`, `item_name`, `price`, `page_type` | いいえ（既存 `商品詳細閲覧` がある） |
| `add_to_cart` | Click - Add to cart | 同上 + `occasion`（選択値。未選択なら `none`） | はい（マイクロ CV） |
| `view_cart` | Page - Cart | `page_type` | いいえ（既存 `カートビュー` と重複するなら片方だけ） |
| `begin_checkout` | Click - Begin checkout または goodsagree 閲覧 | `page_type` | はい |
| `add_shipping_info` | dest.aspx 閲覧 | `checkout_step=dest` | いいえ |
| `add_payment_info` | order.aspx 閲覧 | `checkout_step=pay`, `payment_type`（取れるなら `card` / `portiapay`） | いいえ |
| `purchase` | 既存購入完了と **同じ発火** | `transaction_id`, `value`, `currency=JPY`, `items[]` | はい。`購入完了` と同じ回数になるよう改修 |
| `generate_lead` | Click - Save quote または quote_save ページ | `lead_type=estimate_save` | はい（法人マイクロ CV） |

チェックアウト中間ページ（service / detail / estimate）は、recommended に無いのでカスタム `checkout_progress` を 1 本にし、パラメータ `checkout_step` に `sender` / `detail` / `estimate` を入れる。タグをページごとに増やさない。

### 4.2 会員・記事

| イベント名 | トリガー | パラメータ |
|------------|----------|------------|
| `sign_up` | 既存 register_complete にパラメータ追加でも可 | `method=email` |
| `login` | Click - Login submit 成功後（サンクスまたは menu 変化）。失敗は送らない | `method=email` |
| `select_occasion` | Change - Occasion | `occasion`, `item_id` |
| `magazine_to_shop` | Click - Magazine to shop | `link_url`, `magazine_path` |

`select_occasion` はキーイベントにしない。未選択のまま「カートへ入れる」を押した回数は、`add_to_cart` の `occasion=none` で数える。

### 4.3 購入イベントの一本化（必須）

現状 8月: `購入完了` 982 / `purchase` 648 / `支払完了` 1,613。

手順:

1. 既存の `購入完了` タグと `purchase` タグのトリガーを突き合わせる。
2. 完了ページで **1 注文 1 回** だけ `purchase` を送り、`transaction_id` を付ける。
3. キーイベントは `purchase` に寄せるか、`購入完了` を `purchase` の別名にする（GTM のイベント名を `purchase` に変更し、GA4 側で表示名を「購入完了」にする方が安全）。
4. `支払完了` は発火回数の調査後、キーイベント解除。配送件数など別指標なら名前を `shipping_paid` 等に変える。

このリポジトリの [`buildSiteReport.ts`](../src/lib/buildSiteReport.ts) は `購入完了` の eventCount を購入件数に使っている。タグ側のイベント名を変える場合はレポート側も同時に直す。

---

## 5. GA4 管理画面

イベント作成後:

| 設定 | 値 |
|------|-----|
| カスタムディメンション | `page_type`（イベント）、`checkout_step`（イベント）、`occasion`（イベント）、`logged_in`（ユーザー）、`company_size_range`（ユーザー）、`industry_l`（ユーザー） |
| キーイベント | `purchase`（または現状どおり `購入完了` を 1 本に）、`add_to_cart`、`begin_checkout`、`generate_lead`、`register_complete` |
| 探索レポート | セッションファネル: マガジン閲覧 → `magazine_to_shop` → `view_item` / `商品詳細閲覧` → `add_to_cart` → `begin_checkout` → `checkout_progress` → `purchase` |
| 探索（セグメント） | `logged_in=true` vs false、device、`company_size_range` |

---

## 6. 公開チェックリスト

1. 運用 GTM コンテナと GA4 プロパティを 1 組に固定する。
2. GTM プレビューで PDP → 用途選択 → カート → 注文手続き → 各 order ページ → 完了まで、イベントが 1 回ずつ出ることを確認する。
3. 用途未選択でカートへ入れる操作がサイト上できるなら `occasion=none` が出ること。できないならクリック自体が無いことを記録する。
4. 見積一時保存ボタンで `generate_lead` が 1 回だけ出ること。
5. マガジン記事内の商品リンクで `magazine_to_shop` が出ること。
6. DebugView で `purchase` に `transaction_id` と `value` があること。
7. 同意拒否時に GA4 タグが飛ばないこと。
8. 反映後 7 日で DebugView / リアルタイムではなく探索ファネルを保存し、定点にする。

---

## 7. やらないこと

- 会社名など PII を GA4 に送ること
- 両方の GTM コンテナへ同じタグを入れること
- `支払完了` を追加のキーイベントにすること（現状すでに過大）
- この仕様だけでお中元期間を遡って埋められる、と解釈すること
