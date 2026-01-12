# 定期実行（Cron）設定ガイド

商品データを自動的に最新の状態に保つため、定期クロールの設定を行います。

## クイックスタート

1. **CRON_SECRETを生成**:
   ```bash
   ./scripts/generate-cron-secret.sh
   ```

2. **Render.comで環境変数を設定**:
   - Key: `CRON_SECRET`
   - Value: 生成されたシークレット

3. **cron-job.orgでCron Jobを作成**:
   - URL: `https://mi-business-online.onrender.com/api/cron/crawl-products`
   - Headers: `Authorization: Bearer {CRON_SECRET}`

4. **動作確認**:
   ```bash
   ./scripts/test-cron.sh {CRON_SECRET}
   ```

## 目次

1. [環境変数の設定](#環境変数の設定)
2. [cron-job.orgでの設定](#cron-joborgでの設定)
3. [動作確認](#動作確認)
4. [トラブルシューティング](#トラブルシューティング)
5. [設定チェックリスト](#設定チェックリスト)

---

## 環境変数の設定

### ステップ1: CRON_SECRETの生成

安全なランダムな文字列を生成します。以下のいずれかの方法で生成できます：

**方法1: OpenSSLを使用（推奨）**
```bash
openssl rand -hex 32
```

**方法2: Node.jsを使用**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**方法3: オンラインツール**
- [Random.org](https://www.random.org/strings/) などで32文字以上のランダムな文字列を生成

### ステップ2: Render.comで環境変数を設定

1. [Render.com Dashboard](https://dashboard.render.com/) にログイン
2. 対象のWeb Service（`mi-business-online`）を選択
3. 左メニューから「Environment」をクリック
4. 「Add Environment Variable」をクリック
5. 以下の値を設定：
   - **Key**: `CRON_SECRET`
   - **Value**: ステップ1で生成したランダムな文字列（例: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`）
6. 「Save Changes」をクリック
7. サービスが自動的に再デプロイされます（数分かかります）

**重要**: この`CRON_SECRET`の値は安全に保管してください。`cron-job.org`の設定でも使用します。

---

## cron-job.orgでの設定

### ステップ1: アカウント作成

1. [cron-job.org](https://cron-job.org/) にアクセス
2. 「Sign Up」をクリックしてアカウントを作成（無料プランで利用可能）
3. メールアドレスを確認してアカウントを有効化

### ステップ2: Cron Jobの作成

1. ダッシュボードで「Create cronjob」をクリック

2. **基本設定**:
   - **Title**: `商品クロール定期実行`（任意の名前）
   - **URL**: `https://mi-business-online.onrender.com/api/cron/crawl-products`
   - **Schedule**: `Daily` → `02:00`（毎日午前2時）
     - または `Custom` で `0 2 * * *`（Cron形式）

3. **リクエスト設定**:
   - **Request Method**: `GET`（または`POST`）
   - **Request Headers**: 以下の形式で追加
     ```
     Authorization: Bearer {CRON_SECRETの値}
     ```
     例: `Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

4. **オプション設定**（推奨）:
   - **Timeout**: `300`秒（5分）
   - **Retry on failure**: `3`回
   - **Notification**: メール通知を有効化（失敗時に通知）

5. 「Create cronjob」をクリック

### ステップ3: 動作確認

作成後、すぐに「Run now」ボタンでテスト実行できます。

---

## 動作確認

### 方法1: cron-job.orgのログで確認

1. cron-job.orgのダッシュボードで作成したCron Jobを開く
2. 「Execution History」タブを確認
3. 成功した場合は「200 OK」が表示されます

### 方法2: APIで直接確認

```bash
# CRON_SECRETを設定（実際の値に置き換えてください）
export CRON_SECRET="your-secret-token-here"

# Cron APIを直接呼び出し
curl -X GET "https://mi-business-online.onrender.com/api/cron/crawl-products" \
  -H "Authorization: Bearer $CRON_SECRET"

# クロール状況を確認
curl "https://mi-business-online.onrender.com/api/crawl/products/status"
```

**期待されるレスポンス**:
```json
{
  "success": true,
  "message": "Crawl started successfully",
  "log_id": 123
}
```

### 方法3: Render.comのログで確認

1. Render.comのダッシュボードで対象のWeb Serviceを開く
2. 「Logs」タブを確認
3. 以下のようなログが表示されます：
   ```
   [Cron API] Crawl started successfully
   [Crawl API] Starting incremental crawl
   ```

---

## スケジュール設定の推奨値

### 差分クロール（推奨）

- **頻度**: 毎日
- **時刻**: 午前2時（サーバー負荷が低い時間帯）
- **Cron形式**: `0 2 * * *`
- **用途**: 新規商品や更新された商品のみをクロール

### フルクロール（オプション）

週1回のフルクロールも設定できます：

1. 新しいCron Jobを作成
2. **URL**: `https://mi-business-online.onrender.com/api/crawl/products`
3. **Method**: `POST`
4. **Body**: `{"type": "full"}`
5. **Schedule**: `Weekly` → `Sunday` → `03:00`（日曜日午前3時）
6. **Cron形式**: `0 3 * * 0`

**注意**: フルクロールは時間がかかるため、差分クロールとは別の時間帯に設定してください。

---

## トラブルシューティング

### エラー: "Unauthorized"

**原因**: `CRON_SECRET`が正しく設定されていない、またはヘッダーの形式が間違っている

**解決方法**:
1. Render.comで`CRON_SECRET`環境変数が正しく設定されているか確認
2. cron-job.orgのRequest Headersが以下の形式になっているか確認：
   ```
   Authorization: Bearer {実際のCRON_SECRETの値}
   ```
3. スペースや改行が含まれていないか確認

### エラー: "Failed to start crawl"

**原因**: 内部APIの呼び出しに失敗

**解決方法**:
1. Render.comのログで詳細なエラーメッセージを確認
2. データベースが正しく初期化されているか確認：
   ```bash
   # Render.comのシェルで実行
   ls -la /var/data/products.db
   ```
3. 手動でクロールを実行して動作確認：
   ```bash
   curl -X POST "https://mi-business-online.onrender.com/api/crawl/products" \
     -H "Content-Type: application/json" \
     -d '{"type": "incremental"}'
   ```

### Cron Jobが実行されない

**原因**: cron-job.orgの設定が正しくない、またはスケジュールが無効

**解決方法**:
1. cron-job.orgのダッシュボードでCron Jobのステータスを確認
2. 「Run now」ボタンで手動実行して動作確認
3. スケジュール設定を確認（タイムゾーンに注意）

### タイムアウトエラー

**原因**: クロールに時間がかかりすぎている

**解決方法**:
1. cron-job.orgのTimeout設定を延長（300秒以上推奨）
2. 差分クロール（`incremental`）を使用して処理時間を短縮
3. Render.comのログで実際の処理時間を確認

---

## セキュリティのベストプラクティス

1. **CRON_SECRETの管理**:
   - 長いランダムな文字列を使用（32文字以上推奨）
   - 定期的に変更する（3-6ヶ月ごと）
   - バージョン管理システムにコミットしない

2. **アクセス制限**:
   - `CRON_SECRET`が設定されている場合、認証なしのアクセスは拒否されます
   - cron-job.org以外のサービスからも呼び出し可能ですが、`CRON_SECRET`を知っている必要があります

3. **ログ監視**:
   - Render.comのログを定期的に確認
   - 異常なアクセスパターンを監視

---

## その他のCronサービス

cron-job.org以外にも以下のサービスが利用可能です：

- **EasyCron**: https://www.easycron.com/
- **Cronitor**: https://cronitor.io/
- **Uptime Robot**: https://uptimerobot.com/（Cron機能あり）

設定方法は同様ですが、各サービスのドキュメントを参照してください。

---

## 設定チェックリスト

設定が完了したら、以下のチェックリストで確認してください：

### ステップ1: CRON_SECRETの生成
- [ ] `./scripts/generate-cron-secret.sh` を実行してCRON_SECRETを生成
- [ ] 生成されたCRON_SECRETを安全に保管（メモ帳などに保存）

### ステップ2: Render.comでの設定
- [ ] Render.comのダッシュボードにログイン
- [ ] 対象のWeb Service（`mi-business-online`）を選択
- [ ] 「Environment」タブを開く
- [ ] `CRON_SECRET`環境変数を追加
- [ ] 値に生成したCRON_SECRETを設定
- [ ] 「Save Changes」をクリック
- [ ] サービスが再デプロイされるのを確認（数分かかります）

### ステップ3: cron-job.orgでの設定
- [ ] [cron-job.org](https://cron-job.org/) にアカウントを作成・ログイン
- [ ] 「Create cronjob」をクリック
- [ ] Title: `商品クロール定期実行` を設定
- [ ] URL: `https://mi-business-online.onrender.com/api/cron/crawl-products` を設定
- [ ] Schedule: `Daily` → `02:00` を設定
- [ ] Request Method: `GET` を選択
- [ ] Request Headers に `Authorization: Bearer {CRON_SECRET}` を追加
- [ ] 「Create cronjob」をクリック

### ステップ4: 動作確認
- [ ] cron-job.orgで「Run now」ボタンをクリックしてテスト実行
- [ ] 実行履歴で「200 OK」が表示されることを確認
- [ ] または `./scripts/test-cron.sh {CRON_SECRET}` でテスト
- [ ] Render.comのログでクロールが開始されることを確認
- [ ] `/api/crawl/products/status` でクロール状況を確認

### ステップ5: 定期実行の確認
- [ ] 翌日の実行時刻（午前2時）にcron-job.orgの実行履歴を確認
- [ ] Render.comのログで正常に実行されていることを確認
- [ ] 商品データが更新されていることを確認

## まとめ

定期実行の設定により、商品データが自動的に最新の状態に保たれます。

**設定完了後の確認事項**:
- [ ] Render.comで`CRON_SECRET`環境変数が設定されている
- [ ] cron-job.orgでCron Jobが作成されている
- [ ] 「Run now」でテスト実行が成功している
- [ ] 翌日の実行ログを確認して正常に動作している

問題が発生した場合は、上記のトラブルシューティングセクションを参照してください。

