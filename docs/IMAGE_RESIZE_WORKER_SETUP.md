# 画像リサイズ 専用ワーカー + PostgreSQL セットアップ（Option C）

大容量画像リサイズをデプロイ・スリープの影響を受けずに安定して完了させるため、ジョブキューを PostgreSQL に置き、専用の Background Worker で処理する構成です。

## アーキテクチャ

- **Web サービス**: ジョブ登録・一覧・詳細・ダウンロード URL 発行。`image_resize_jobs` は PostgreSQL に接続。
- **Background Worker**: 同一リポジトリ。30 秒ごとに `processNextImageResizeJob()` を実行。PostgreSQL から pending ジョブを取得し、R2 の ZIP を処理して結果を R2 にアップロード。
- **PostgreSQL**: ジョブキュー用。Web と Worker の両方から同じ接続 URL で参照。
- **画像処理**: リサイズ前に Sharp の `rotate()`（引数なし）で **EXIF Orientation を自動適用**し、ブラウザや他ツールの表示向きと整合させる（`src/lib/imageResize.ts`）。

---

# 本番で動かすまでの手順（詳細）

## ステップ 1: Render で PostgreSQL を 1 つ作成する

1. ブラウザで [Render Dashboard](https://dashboard.render.com/) を開き、ログインする。
2. 左上の **New +** をクリックし、一覧から **PostgreSQL** を選ぶ。
3. **Create PostgreSQL** 画面で以下を設定する。
   - **Name**: 任意の名前（例: `mi-business-image-resize-db`）。サービス一覧で識別しやすくするため。
   - **Database**: そのままでよい（自動で DB 名が付く）。
   - **User**: そのままでよい（自動でユーザー名が付く）。
   - **Region**: Web サービスと同じリージョン（例: Singapore や Oregon）を選ぶとレイテンシが小さくなる。
   - **Plan**: 無料プランがあれば **Free**、なければ最小の有料プランを選ぶ。
4. **Create Database** をクリックして作成する。
5. 作成が完了したら、その PostgreSQL サービスを開く。
6. 左メニューまたは上部の **Info** タブを開く。
7. **Connections** のところにある **Internal Database URL** をコピーする。
   - 形式は `postgres://ユーザー名:パスワード@ホスト名/データベース名` のような長い文字列。
   - **Internal** を使うこと（同一 Render アカウント内の Web / Worker から同じネットワーク内で接続するため）。External URL は使わない。
8. この URL は **ステップ 2 と 3 の両方** で使うので、メモ帳などに一時保存しておく。

---

## ステップ 2: Web サービスの環境変数に IMAGE_RESIZE_JOBS_DATABASE_URL を追加する

1. Render Dashboard で、既存の **Web サービス**（例: `mi-business-online`）をクリックして開く。
2. 左メニューから **Environment** をクリックする。
3. **Environment Variables** の一覧で **Add Environment Variable** または **+ Add** をクリックする。
4. 次の 1 件を追加する。
   - **Key**: `IMAGE_RESIZE_JOBS_DATABASE_URL`（そのままコピーして入力）
   - **Value**: ステップ 1 でコピーした **Internal Database URL** をそのまま貼り付ける（前後にスペースや改行を入れない）。
5. **Save Changes** をクリックする。
6. 保存後、Render が自動で **再デプロイ** を開始することがある。開始されたら完了まで待つ。自動で始まらない場合は、**Manual Deploy** → **Deploy latest commit** で 1 回デプロイする。

これで Web サービスは、画像リサイズのジョブ情報を **PostgreSQL** に保存・参照するようになる。R2 用の環境変数（`R2_ACCOUNT_ID` など）は既存のまま変更しない。

---

## ステップ 3: Background Worker を新規作成し、同じリポジトリ・同じ環境変数・Start Command を設定する

### 3-1. Background Worker の新規作成

1. Render Dashboard の左上 **New +** をクリックする。
2. 一覧から **Background Worker** を選ぶ（Web Service ではない）。

### 3-2. リポジトリの接続

1. **Connect a repository** で、**Web サービスで使っているのと同じ GitHub（または GitLab）リポジトリ** を選ぶ。
2. まだ接続していない場合は **Configure account** で GitHub 等を連携してから、該当リポジトリを選ぶ。
3. **Branch** は Web と同じブランチ（通常は `main`）を選ぶ。

### 3-3. 基本設定

1. **Name**: 任意（例: `mi-business-image-resize-worker`）。一覧で Web と区別しやすくするため。
2. **Region**: Web サービスと同じリージョンにするとよい。
3. **Branch**: 上で選んだブランチのまま。

### 3-4. Build & Start コマンド

1. **Build Command**: Web サービスと同じにする。
   - 例: `npm install && npm run build`  
   - または、Worker だけ軽くしたい場合は `npm install` のみでもよい（Next のビルドは不要だが、依存関係は必要）。
2. **Start Command**: 必ず次のとおりにする。
   ```bash
   npm run worker
   ```
   - 内部で `scripts/run-worker-from-root.cjs` がプロジェクトルートに cd してからワーカーを起動するため、Render で cwd がずれていても動作する。
   - 30 秒ごとに `processNextImageResizeJob()` が実行される。

### 3-5. 環境変数（DB URL + R2）

Worker は **PostgreSQL と R2 の両方** に接続するため、次の環境変数をすべて設定する。

1. **Environment** セクションで **Add Environment Variable** を繰り返し、以下を 1 件ずつ追加する。

| Key | Value |
|-----|--------|
| `IMAGE_RESIZE_JOBS_DATABASE_URL` | ステップ 1 でコピーした **Internal Database URL**（Web で設定したのと同じ値） |
| `R2_ACCOUNT_ID` | Web サービスで設定している値と同じ |
| `R2_ACCESS_KEY_ID` | Web サービスで設定している値と同じ |
| `R2_SECRET_ACCESS_KEY` | Web サービスで設定している値と同じ |
| `R2_BUCKET_NAME` | Web サービスで設定している値と同じ（例: `mi-business-image-resize`） |
| `IMAGE_RESIZE_MAX_REQUEUE_COUNT` | （任意）リトライ上限。大容量ジョブで「Server unhealthy」が出やすい場合は `5` などに増やすと完了しやすい。省略時は 2（最大 3 回実行）。 |
| `IMAGE_RESIZE_TEMP_DIR` | （任意）永続ディスクをマウントした場合、一時ファイル用ディレクトリ（例: `/var/data/tmp`）。設定すると /tmp の 2GB 制限を回避。下記「Evicted. Size of temporary storage volume /tmp exceeded」参照。 |

2. 値の取得方法:
   - **IMAGE_RESIZE_JOBS_DATABASE_URL**: ステップ 1 の Internal Database URL。
   - **R2 の 4 つ**: Web サービスの **Environment** 画面を開き、同じ Key の Value をコピーして Worker に貼り付ける。

3. **Save Changes** または **Create Background Worker** をクリックする。

### 3-6. 作成完了後

1. Worker が作成されると、自動でビルド・起動する。
2. 左メニューの **Logs** を開く。
3. 次のようなログが出ていれば正常起動している。
   ```text
   [image-resize-worker] Started. Polling every 30 seconds.
   ```
4. `IMAGE_RESIZE_JOBS_DATABASE_URL (PostgreSQL) が未設定です。終了します。` と出る場合は、環境変数名または値（Internal Database URL が正しいか）を確認する。

---

## 推奨インスタンス（大容量 ZIP 用）

- **1GB 以上、とくに 2GB 超の ZIP** を扱う場合は、Worker の **Instance Type** で次を推奨する。
  - **メモリ**: 4GB 以上（sharp による画像処理のピーク時に余裕を持たせる）。
  - **ディスク**: 処理時に「入力 ZIP 全体 + 出力 ZIP 用」の一時ファイルが作成される。ZIP サイズと同程度以上のエフェメラルディスク空きがあるプランを選ぶ（例: 2.6GB の ZIP なら合計 4GB 程度以上の一時ディスクが望ましい）。
- Render Dashboard → Background Worker → **Settings** → **Instance Type** で、メモリ・ディスクが十分なプラン（例: Pro 2 CPU 4 GB）を選択する。

---

## Server unhealthy が出た場合

Worker または Web で「Server unhealthy」と通知され、ジョブがリトライ上限で失敗する場合は、次を順に確認する。

1. **Render の Metrics を確認**  
   Worker の **Metrics** タブでメモリ・ディスク使用量を確認する。処理中にメモリやディスクが上限に張り付いている場合はリソース不足が疑われる。
2. **インスタンスのメモリ・ディスクを増やす**  
   Worker の **Instance Type** を 1 段階以上上げる（例: Standard 2GB → Pro 4GB）。大容量 ZIP の目安は上記「推奨インスタンス」を参照。
3. **リトライ回数を増やす**  
   環境変数 **`IMAGE_RESIZE_MAX_REQUEUE_COUNT`** を `4` または `5` に設定する。まれに unhealthy になっても、再試行の余地が増え、完了しやすくなる。Worker の **Environment** に追加し、必要なら Web サービスにも同じキーで設定する（履歴表示時の stale 処理で同じ上限が使われる）。
4. **未対応画像形式・巨大ファイル**  
   ログに **`Input buffer contains unsupported image format`** が出る場合、ZIP 内に sharp が扱えない画像（未対応形式・破損・拡張子と中身が異なるファイルなど）が含まれている。Worker のログで **`resize error:`** の直後に出ている**ファイル名**を確認し、そのファイルを ZIP から削除するか、対応形式（例: sRGB の JPEG/PNG）に変換してからジョブを再登録する。1 ファイルあたりの読み込みサイズ上限（デフォルト 30MB）を超えるファイルはスキップされ、同様にログにファイル名が出る。環境変数 **`IMAGE_RESIZE_MAX_IMAGE_BYTES`** で上限を変更可能（バイト数）。
5. **「Evicted. Size of temporary storage volume /tmp exceeded the limit of 2GB」が出る場合**  
   Render の Background Worker では **/tmp の上限が 2GB** です。入力 ZIP と出力 ZIP を両方 /tmp に保存するため、大容量ジョブ（例: 入力 1.5GB + 出力 1.5GB）で 2GB を超え、インスタンスが Evicted で強制終了されます。  
   **対処**: Worker に **Persistent Disk をマウント**し、一時ファイルを /tmp ではなくそのディスク上に書くようにします。
   - Render Dashboard → **Background Worker**（mi-business-image-resize-worker）→ **Disk** タブで **Add Disk** をクリックする。
   - **Mount Path**: `/var/data`（例）。**Size**: 大容量 ZIP を想定し **10GB 以上**を推奨（入力＋出力で数 GB 使うため）。
   - **Environment** タブで **Add Environment Variable** をクリックし、**Key**: `IMAGE_RESIZE_TEMP_DIR`、**Value**: `/var/data/tmp` を追加する（Mount Path が `/var/data` の場合は `/var/data/tmp`）。保存後、Worker が再デプロイされる。  
   コード側で `IMAGE_RESIZE_TEMP_DIR` が指定されていると、そのディレクトリが存在しなければ自動作成され、入力・出力 ZIP はすべてそのディスク上に書かれるため、/tmp の 2GB 制限の影響を受けなくなります。

---

## 動作確認の流れ

1. **Web**: ブラウザで `https://mi-business-online.onrender.com/image-resize` などを開く。
2. 大容量用で ZIP をアップロードし、「アップロードしてジョブ登録」を実行する。
3. **Worker**: Render の Worker の **Logs** で、数十秒以内にジョブ取り込みやリサイズ処理のログが出ることを確認する。
4. **Web**: 画像リサイズページの「履歴」で、該当ジョブのステータスが「完了」になり、ダウンロードリンクが表示されることを確認する。

---

## IMAGE_RESIZE_JOBS_DATABASE_URL を設定しない場合の動き

- **IMAGE_RESIZE_JOBS_DATABASE_URL**（および **DATABASE_URL** で `postgres` で始まる URL）を **どちらも設定していない** 場合:
  - 画像リサイズのジョブは **これまでどおり SQLite**（Web プロセス内の `products.db` など）に保存される。
  - **Background Worker は使われない**。ジョブ登録は Web の POST 時に、これまで通り「fire-and-forget で 1 件だけ処理を開始」する動きになる。
  - デプロイやスリープで Web プロセスが落ちると、処理中のジョブは途中で終了し、2 時間タイムアウトで「失敗」扱いになる。

つまり、「PostgreSQL も Worker も使わず、これまで通り SQLite だけで動かす」場合は、**IMAGE_RESIZE_JOBS_DATABASE_URL を追加しなければよい**。Worker サービスは作成しなくてよい。

---

## 取り残しジョブの自動再試行とリトライ上限

- デプロイなどで Worker が落ち、「処理中」のまま更新が止まったジョブは、**約 5 分**（最終更新から）経過すると自動で **pending** に戻る。
- 履歴を開く（または「再読み込み」）するたびに stale チェックが走る。Worker が動いていれば、pending に戻ったジョブを Worker が再取得して先頭から再実行する。
- 5 分のしきい値は環境変数 **`IMAGE_RESIZE_STALE_RETRY_MINUTES`** で変更できる（例: `1` にすると 1 分で再試行対象になる）。2 時間以上更新がないジョブは従来どおり「失敗」になる。
- **リトライ上限**: 同じジョブを何度も pending に戻すと無限ループになるため、**再投入（リトライ）回数に上限**を設けている。デフォルトは **2 回**（= 初回を含め最大 3 回まで実行）。上限に達したジョブは「リトライ上限に達しました」で failed になり、再実行されない。環境変数 **`IMAGE_RESIZE_MAX_REQUEUE_COUNT`** で変更可能（例: `5` で最大 6 回実行）。**大容量ジョブで Server unhealthy が発生しやすい場合は 4〜5 に増やすと完了しやすくなる。**  
  「リトライ上限に達しました」は **Worker が何度か落ちた結果**であることが多い。未対応画像形式や巨大ファイルの除去・変換（上記「Server unhealthy が出た場合」の 4）のほか、推奨インスタンス（大容量 ZIP 用）のスペックと「Server unhealthy が出た場合」の手順を確認すること。

---

## 注意事項

- **Worker だけをデプロイした場合**: デプロイの瞬間に実行中だった 1 件のジョブは途中で終了する。約 5 分後に「処理中」が pending に戻り、Worker が再開すれば自動で再試行される。2 時間以上放置したジョブは「失敗」になる。
- **ローカル開発**: `IMAGE_RESIZE_JOBS_DATABASE_URL` を設定しなければ、従来どおり SQLite で動作する。PostgreSQL をローカルで立て、その URL を設定すると、本番に近い形で Worker 相当の動きを試せる。
- **Internal Database URL**: Render の同じアカウント内のサービス同士で使う URL。外部に公開しないこと。
