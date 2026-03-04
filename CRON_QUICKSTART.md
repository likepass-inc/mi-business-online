# 毎日クロールを回す設定（クイックスタート）

以下を順に実施すると、毎日定時（例: 午前2時）に商品クロールが実行され、ダッシュボードの情報が日次で更新されます。

---

## ステップ1: CRON_SECRET を用意する

**上記でターミナルに表示された CRON_SECRET をコピーして保管してください。**

- 表示例: `6a2275e05dca396ffbc77e0c4566f7db351ad8ef1f9f2018d3e49ca14e6d6516`
- 再生成する場合: `./scripts/generate-cron-secret.sh` を実行

---

## ステップ2: Render.com に環境変数を設定

1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. 対象の Web Service（**mi-business-online**）を選択
3. 左メニュー **Environment** をクリック
4. **Add Environment Variable** をクリック
5. 以下を入力:
   - **Key**: `CRON_SECRET`
   - **Value**: ステップ1でコピーした CRON_SECRET（そのまま貼り付け）
6. **Save Changes** をクリック
7. 再デプロイが完了するまで数分待つ

---

## ステップ3: cron-job.org で Cron Job を作成

1. [cron-job.org](https://cron-job.org/) にアクセスし、アカウント作成またはログイン
2. **Create cronjob** をクリック
3. 次のように設定:

   | 項目 | 値 |
   |------|-----|
   | **Title** | 商品クロール定期実行（任意） |
   | **URL** | `https://mi-business-online.onrender.com/api/cron/crawl-products` |
   | **Schedule** | Daily → **02:00**（毎日午前2時） |
   | **Request Method** | GET または POST |
   | **Request Headers** | `Authorization: Bearer （CRON_SECRETの値）` |

   Request Headers の例（CRON_SECRET は実際の値に置き換え）:
   ```
   Authorization: Bearer 6a2275e05dca396ffbc77e0c4566f7db351ad8ef1f9f2018d3e49ca14e6d6516
   ```

4. 推奨オプション:
   - **Timeout**: 300 秒
   - **Retry on failure**: 3 回
5. **Create cronjob** をクリック

---

## ステップ4: 動作確認

1. **Render の再デプロイが完了していること**を確認
2. cron-job.org の該当ジョブで **Run now** をクリックしてテスト実行
3. またはターミナルで:
   ```bash
   ./scripts/test-cron.sh （CRON_SECRETの値）
   ```
4. 成功時は HTTP 200 が返り、数分後に [クロール状況 API](https://mi-business-online.onrender.com/api/crawl/products/status) やダッシュボードで結果を確認できます

---

## まとめ

- **Render**: 環境変数 `CRON_SECRET` を設定済み
- **cron-job.org**: 上記 URL を毎日 02:00 に呼ぶ Cron Job を作成済み

これで毎日、商品データが自動更新され、ダッシュボードの「新商品」「販売終了」が日々の情報として更新されます。

詳細やトラブルシューティングは [CRON_SETUP_GUIDE.md](CRON_SETUP_GUIDE.md) を参照してください。
