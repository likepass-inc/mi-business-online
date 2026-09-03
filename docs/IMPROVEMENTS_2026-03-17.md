# 本日の改善まとめ（2026-03-17）

画像リサイズ Worker の不安定化（Instance failed / Evicted）に対する対応を実施しました。

---

## 1. 改善の背景

Render の Background Worker（`mi-business-image-resize-worker`）で、**「Evicted. Size of temporary storage volume /tmp exceeded the limit of 2GB」** によりインスタンスが繰り返し強制終了していました。

- **原因**: Render では /tmp の上限が **2GB**。画像リサイズ処理で「入力 ZIP」と「出力 ZIP」の両方を /tmp に保存するため、大容量ジョブ（例: 入力 1.5GB + 出力 1.5GB）で 2GB を超え、Evicted が発生していました。

---

## 2. 実施した改善

### 2.1 コード変更

| 項目 | 内容 |
|------|------|
| ファイル | `src/lib/imageResizeJobProcessor.ts` |
| 変更内容 | 一時ディレクトリを環境変数で指定可能にした。 |
| 詳細 | `tempDir` を `process.env.IMAGE_RESIZE_TEMP_DIR || os.tmpdir()` で取得。`IMAGE_RESIZE_TEMP_DIR` が指定されている場合は、そのディレクトリを `fs.mkdirSync(..., { recursive: true })` で自動作成。 |

これにより、Worker 側で永続ディスクをマウントし、そのパスを `IMAGE_RESIZE_TEMP_DIR` に設定すれば、一時ファイルを /tmp ではなくそのディスク上に書き出せるようになりました。

### 2.2 ドキュメント更新

| 項目 | 内容 |
|------|------|
| ファイル | `docs/IMAGE_RESIZE_WORKER_SETUP.md` |
| 追加内容 | 「Server unhealthy が出た場合」に **5. 「Evicted. Size of temporary storage volume /tmp exceeded the limit of 2GB」が出る場合** を追加。 |
| 詳細 | 原因（/tmp 2GB 制限）と対処手順（Worker に Persistent Disk をマウントし、環境変数 `IMAGE_RESIZE_TEMP_DIR` を設定する）を記載。環境変数一覧テーブルに `IMAGE_RESIZE_TEMP_DIR` を追記。 |

### 2.3 運用設定（Render Dashboard）

以下を Render Dashboard で設定済みです。

| 項目 | 設定値 |
|------|--------|
| Worker | mi-business-image-resize-worker |
| Disk | Add Disk → Mount Path: `/var/data`、Size: 10GB 以上 |
| 環境変数 | `IMAGE_RESIZE_TEMP_DIR` = `/var/data/tmp` |

一時ファイルはすべて `/var/data/tmp` に書き出されるため、/tmp の 2GB 制限を超えても Evicted が発生しません。

---

## 3. コミット・デプロイ

- **コミット**: `fix(image-resize): /tmp 2GB超過Evicted対策 - IMAGE_RESIZE_TEMP_DIR対応とドキュメント追記`
- **対象**: `src/lib/imageResizeJobProcessor.ts`、`docs/IMAGE_RESIZE_WORKER_SETUP.md`
- **リモート**: `main` にプッシュ済み（Render の自動デプロイが実行される想定）

---

## 4. 参照

- 詳細な手順・トラブルシュート: [docs/IMAGE_RESIZE_WORKER_SETUP.md](IMAGE_RESIZE_WORKER_SETUP.md) の「Server unhealthy が出た場合」→ 5. Evicted. Size of temporary storage volume /tmp exceeded
- 画像リサイズ機能の仕様・運用提案: [docs/SITE_SEARCH_AND_OPERATIONS_CLIENT.md](SITE_SEARCH_AND_OPERATIONS_CLIENT.md)（クライアント向け）
