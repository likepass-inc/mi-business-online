# R2 API トークン作成手順（Create Account API Token）

大容量バッチ用の Cloudflare R2 に接続するために、API トークンを作成します。

---

## 作成時の設定

| 項目 | 選択内容 |
|------|----------|
| **Token name** | 任意（例: `R2 Account Token` または `mi-business-image-resize R2 Token`） |
| **Permissions** | **Object Read & Write** を選択。バケット内オブジェクトの読み取り・書き込み・一覧に必要。Admin は不要。 |
| **Specify bucket(s)** | **Apply to specific buckets only** を選び、対象バケット **mi-business-image-resize** にチェック。 |
| **TTL** | **Forever**（無期限）。必要に応じて期限付きにもできる。 |
| **Client IP Address Filtering** | 未設定のままで可（すべての IP から利用）。Render の IP に限定する場合は Include に Render の IP を指定。 |

上記で **Create API Token** を実行する。

---

## 作成後に表示される情報

- **Token value** … このトークンは S3 互換では使わない。**Access Key ID** と **Secret Access Key** を使う。
- **Access Key ID** … Render の環境変数 `R2_ACCESS_KEY_ID` に設定する。
- **Secret Access Key** … Render の環境変数 `R2_SECRET_ACCESS_KEY` に設定する（再表示できないので必ずコピーして保管）。
- **S3 エンドポイント** … `https://<Account ID>.r2.cloudflarestorage.com` の形式。Account ID は R2 の Overview などで確認し、`R2_ACCOUNT_ID` に設定する。

---

## Render への反映

1. [Render Dashboard](https://dashboard.render.com/) で **mi-business-online** を開く。
2. **Environment** で以下を追加する。

   | Key | Value |
   |-----|--------|
   | `R2_ACCOUNT_ID` | 上記の Account ID（エンドポイントのサブドメイン部分） |
   | `R2_ACCESS_KEY_ID` | 表示された Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | 表示された Secret Access Key |
   | `R2_BUCKET_NAME` | `mi-business-image-resize`（作成したバケット名） |

3. **Save Changes** のあと、再デプロイする。

---

## バケットの CORS 設定（ブラウザから直接アップロードする場合）

大容量バッチでは、ブラウザから presigned URL 経由で R2 へ直接 PUT します。別オリジンへのリクエストになるため、**R2 バケットに CORS を設定しないとアップロードがブロックされ「Upload failed」になります。**

1. Cloudflare Dashboard → **R2** → バケット **mi-business-image-resize** → **Settings**
2. **CORS policy** で **Add CORS policy** または **Edit** を開く
3. 次の JSON を設定して保存する（本番＋ローカル開発用）:

```json
[
  {
    "AllowedOrigins": [
      "https://mi-business-online.onrender.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

本番のみでよい場合は `AllowedOrigins` を `["https://mi-business-online.onrender.com"]` だけにしても可。

---

## 注意

- **Secret Access Key** と **Token value** はリポジトリにコミットしないこと。このファイルに貼り付けた場合は、Render に設定したうえで削除するか、`.gitignore` に追加する。
- トークンが漏れた場合は、Cloudflare の R2 → Manage R2 API Tokens から該当トークンを削除し、新しいトークンを作成して Render の環境変数を更新する。
