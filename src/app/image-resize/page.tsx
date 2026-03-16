'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import AppLayout from '@/components/layout/AppLayout'

type JobItem = {
  jobId: number
  status: string
  createdAt: string
  imageCount?: number
  inputSizeBytes?: number
  errorMessage?: string
  processedCount?: number
}

type Result = {
  large: string
  small: string
  filename: string
  largeFilename: string
  smallFilename: string
}

export default function ImageResizePage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [zipDownloadUrl, setZipDownloadUrl] = useState<string | null>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f && (f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip')) {
      setFile(f)
      setError(null)
      setResult(null)
      setZipDownloadUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    } else {
      setError('画像ファイルまたはZIPを選択してください。')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setError(null)
      setResult(null)
      setZipDownloadUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
    e.target.value = ''
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!file) {
      setError('ファイルを選択してください。')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    setZipDownloadUrl(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/image-resize', {
        method: 'POST',
        body: formData,
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/zip')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setZipDownloadUrl(url)
        setLoading(false)
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'リサイズに失敗しました。')
        return
      }
      setResult({
        large: data.large,
        small: data.small,
        filename: data.filename,
        largeFilename: data.largeFilename,
        smallFilename: data.smallFilename,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'リクエストに失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [file])

  const clear = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
    if (zipDownloadUrl) {
      URL.revokeObjectURL(zipDownloadUrl)
      setZipDownloadUrl(null)
    }
  }, [zipDownloadUrl])

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">画像リサイズ</h1>
        <p className="text-gray-600 mb-6">
          画像をアップロードすると、大（640×533）と小（262×218）の2サイズにリサイズします。比率は維持され、必要に応じて余白が付きます。
        </p>
        <p className="text-gray-600 mb-6">
          <strong>小規模</strong>：下の枠で1枚の画像、またはZIP（最大30枚・50MBまで）をその場でリサイズできます。
          <strong>大容量</strong>：ページ下部の「大容量バッチ（R2）」で、数千枚・数GB規模のZIPにも対応しています。
        </p>

        <h2 className="text-xl font-semibold mb-3 text-gray-800">小規模（1枚 or ZIP 最大30枚・50MB）</h2>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.zip"
            onChange={handleFileChange}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer block">
            {file ? (
              <span className="text-gray-700">
                {file.name.toLowerCase().endsWith('.zip') ? 'ZIPを選択中: ' : '選択中: '}
                <strong>{file.name}</strong>（{(file.size / 1024).toFixed(1)} KB）
              </span>
            ) : (
              <span className="text-gray-500">クリックまたはドラッグ＆ドロップで画像またはZIPを選択</span>
            )}
          </label>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg" role="alert">
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || loading}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '処理中...' : 'リサイズする'}
          </button>
          <button
            type="button"
            onClick={clear}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            クリア
          </button>
        </div>

        {zipDownloadUrl && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-bold">結果</h2>
            <p className="text-gray-600">リサイズが完了しました。ZIPをダウンロードしてください。</p>
            <a
              href={zipDownloadUrl}
              download="resized.zip"
              className="inline-block px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ZIPをダウンロード
            </a>
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-6">
            <h2 className="text-xl font-bold">結果</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-700 mb-2">大（640×533）</h3>
                <img src={result.large} alt="大サイズ" className="max-w-full h-auto border border-gray-200 rounded" />
                <a
                  href={result.large}
                  download={result.largeFilename}
                  className="mt-3 inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  ダウンロード
                </a>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium text-gray-700 mb-2">小（262×218）</h3>
                <img src={result.small} alt="小サイズ" className="max-w-full h-auto border border-gray-200 rounded" />
                <a
                  href={result.small}
                  download={result.smallFilename}
                  className="mt-3 inline-block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  ダウンロード
                </a>
              </div>
            </div>
          </div>
        )}

        <hr className="my-12 border-gray-200" />

        <h2 className="text-2xl font-bold mb-4">大容量バッチ（R2）</h2>
        <p className="text-gray-600 mb-4">
          数千枚・数 GB 規模の ZIP をアップロードして一括リサイズできます。まず ZIP をアップロードし、ジョブ登録後に完了までお待ちください。完了したらリサイズ済み ZIP をダウンロードできます。
        </p>

        <h3 className="text-lg font-semibold mb-2 text-gray-800">ご利用の流れ</h3>
        <ol className="list-decimal list-inside text-gray-600 mb-4 space-y-1">
          <li>ZIP を選択し「アップロードしてジョブ登録」を押す</li>
          <li>ブラウザからアップロード先へ ZIP を直接アップロード（進捗表示あり）</li>
          <li>ジョブ登録後、サーバー側でリサイズ処理が開始されます。画面を閉じても処理は続行され、再ログイン後に「履歴」からダウンロード可能です。</li>
          <li>処理完了後、このページの「履歴」またはその場に表示されるリンクからリサイズ済み ZIP をダウンロードする</li>
        </ol>

        <h3 className="text-lg font-semibold mb-2 text-gray-800">所要時間の目安</h3>
        <ul className="text-gray-600 mb-4 list-disc list-inside space-y-1">
          <li><strong>アップロード：</strong>ZIP のサイズと回線速度により変動。数 GB の場合は十数分〜数十分かかることがあります。</li>
          <li><strong>リサイズ処理：</strong>画像枚数・解像度により変動。数百枚で数分、数千枚で十数分〜数十分が目安です。</li>
          <li><strong>ダウンロード：</strong>完了後に表示されるリンクから取得。ファイルサイズと回線速度により変動します。</li>
        </ul>

        <p className="text-gray-600 mb-4">
          <strong>画面について：</strong>画面を閉じても処理は続きます。完了後は再ログインして「履歴」からダウンロードできます。
        </p>

        <p className="text-gray-600 mb-4">
          <strong>限界値：</strong>1ジョブあたり <strong>最大5,000枚</strong>まで。ZIP のサイズは R2 の制限内であれば数 GB 規模まで対応しています。
        </p>
        <BatchResizeSection />
        <BatchHistorySection />
      </div>
    </AppLayout>
  )
}

function BatchResizeSection() {
  const [outputSize, setOutputSize] = useState<'large' | 'small'>('large')
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [step, setStep] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [jobId, setJobId] = useState<number | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [processedCount, setProcessedCount] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleBatchFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f && f.name.toLowerCase().endsWith('.zip')) {
      setBatchFile(f)
      setStep('idle')
      setBatchError(null)
      setDownloadUrl(null)
      setJobId(null)
    }
    e.target.value = ''
  }, [])

  const startBatch = useCallback(async () => {
    if (!batchFile) return
    setBatchError(null)
    setStep('uploading')
    setUploadProgress(0)
    try {
      const urlRes = await fetch(
        `/api/image-resize/upload-url?filename=${encodeURIComponent(batchFile.name)}`
      )
      const urlText = await urlRes.text()
      let urlData: { uploadUrl?: string; objectKey?: string; error?: string }
      try {
        urlData = urlText.startsWith('{') ? JSON.parse(urlText) : {}
      } catch {
        setBatchError(
          urlText.startsWith('<') ? 'サーバーが HTML を返しました。認証切れまたはサーバーエラーの可能性があります。' : 'アップロード URL の取得に失敗しました。'
        )
        setStep('error')
        return
      }
      if (!urlRes.ok || !urlData.uploadUrl || !urlData.objectKey) {
        setBatchError(urlData.error || 'アップロード URL の取得に失敗しました')
        setStep('error')
        return
      }
      const uploadUrl = urlData.uploadUrl
      const objectKey = urlData.objectKey
      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`アップロードに失敗しました（HTTP ${xhr.status} ${xhr.statusText || ''}）. CORS またはバケット設定をご確認ください。`))
          }
        })
        xhr.addEventListener('error', () =>
          reject(new Error('アップロードに失敗しました。ネットワークまたは CORS 設定をご確認ください。'))
        )
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', 'application/zip')
        xhr.send(batchFile)
      })
      setStep('processing')
      setProcessingStartedAt(Date.now())
      setElapsedSeconds(0)
      setProcessedCount(null)
      const jobRes = await fetch('/api/image-resize/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectKey,
          inputSizeBytes: batchFile.size,
          outputSize,
        }),
      })
      const jobText = await jobRes.text()
      let jobData: { jobId?: number; error?: string }
      try {
        jobData = jobText.startsWith('{') ? JSON.parse(jobText) : {}
      } catch {
        setBatchError(
          jobText.startsWith('<') ? 'サーバーが HTML を返しました。PostgreSQL 接続や環境変数を確認してください。' : 'ジョブの登録に失敗しました。'
        )
        setStep('error')
        return
      }
      if (!jobRes.ok || !jobData.jobId) {
        setBatchError(jobData.error || 'ジョブの登録に失敗しました')
        setStep('error')
        return
      }
      setJobId(jobData.jobId)
      const poll = async () => {
        const res = await fetch(`/api/image-resize/jobs/${jobData.jobId}`, { credentials: 'include' })
        const text = await res.text()
        let data: { status?: string; downloadUrl?: string; errorMessage?: string; processedCount?: number }
        try {
          data = text.startsWith('{') ? JSON.parse(text) : {}
        } catch {
          return
        }
        if (data.processedCount !== undefined) setProcessedCount(data.processedCount)
        if (data.status === 'completed' && data.downloadUrl) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          setDownloadUrl(data.downloadUrl)
          setStep('done')
          return
        }
        if (data.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          setBatchError(data.errorMessage || '処理に失敗しました')
          setStep('error')
          return
        }
        setTimeout(poll, 3000)
      }
      intervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
      setTimeout(poll, 2000)
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'エラーが発生しました')
      setStep('error')
    }
  }, [batchFile, outputSize])

  useEffect(() => {
    if (step !== 'processing') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [step])

  const resetBatch = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setBatchFile(null)
    setStep('idle')
    setUploadProgress(0)
    setJobId(null)
    setDownloadUrl(null)
    setBatchError(null)
    setProcessingStartedAt(null)
    setElapsedSeconds(0)
    setProcessedCount(null)
  }, [])

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">リサイズするサイズ</p>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="batch-output-size"
              checked={outputSize === 'large'}
              onChange={() => setOutputSize('large')}
              className="text-blue-500"
            />
            <span className="text-sm">大（640×533）のみ</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="batch-output-size"
              checked={outputSize === 'small'}
              onChange={() => setOutputSize('small')}
              className="text-blue-500"
            />
            <span className="text-sm">小（262×218）のみ</span>
          </label>
        </div>
      </div>
      <input
        type="file"
        accept=".zip"
        onChange={handleBatchFileChange}
        className="hidden"
        id="batch-file-input"
      />
      <label htmlFor="batch-file-input" className="cursor-pointer block mb-4">
        {batchFile ? (
          <span className="text-gray-700">
            選択中: <strong>{batchFile.name}</strong>（{(batchFile.size / 1024 / 1024).toFixed(2)} MB）
          </span>
        ) : (
          <span className="text-gray-500 underline">ZIP ファイルを選択（大容量用）</span>
        )}
      </label>
      {(step === 'idle' || step === 'error') && batchFile && (
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={startBatch}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            アップロードしてジョブ登録
          </button>
          <button type="button" onClick={resetBatch} className="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
            クリア
          </button>
        </div>
      )}
      {step === 'uploading' && (
        <p className="text-gray-600 mb-2">R2 へアップロード中… {uploadProgress}%</p>
      )}
      {step === 'processing' && (
        <div className="text-gray-600 mb-2 space-y-1">
          <p>リサイズ処理中です。完了までお待ちください（ジョブ ID: {jobId}）</p>
          <p className="text-sm">
            経過 {Math.floor(elapsedSeconds / 60)} 分 {elapsedSeconds % 60} 秒
            {processedCount != null && `　（${processedCount} 枚リサイズ済み）`}
          </p>
        </div>
      )}
      {step === 'done' && downloadUrl && (
        <div className="mb-4">
          <p className="text-gray-600 mb-2">完了しました。</p>
          <a
            href={downloadUrl}
            download="resized.zip"
            className="inline-block px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            リサイズ済み ZIP をダウンロード
          </a>
        </div>
      )}
      {batchError && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg" role="alert">
          {batchError}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  try {
    // サーバー（Render）は UTC で保存。Z や ±HH:MM が無い場合は UTC として解釈する
    const hasTz = /Z|[+-]\d{2}:?\d{2}$/.test(iso.trim())
    const normalized = hasTz ? iso.trim() : iso.trim().replace(/\s/, 'T') + 'Z'
    const d = new Date(normalized)
    return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
  } catch {
    return iso
  }
}

function BatchHistorySection() {
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/image-resize/jobs', { credentials: 'include' })
      const text = await res.text()
      let data: { jobs?: JobItem[]; error?: string }
      try {
        data = text.startsWith('{') ? JSON.parse(text) : {}
      } catch {
        setError(text.startsWith('<') ? 'サーバーが HTML を返しました。' : '履歴の取得に失敗しました')
        setJobs([])
        return
      }
      if (!res.ok) {
        const message =
          res.status === 401
            ? '認証が必要です。ページを再読み込みするか、再度ログインしてください。'
            : data.error || '履歴の取得に失敗しました'
        setError(message)
        setJobs([])
        return
      }
      setJobs(data.jobs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '履歴の取得に失敗しました')
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const [cancellingJobId, setCancellingJobId] = useState<number | null>(null)

  const handleDownload = useCallback(async (jobId: number) => {
    try {
      const res = await fetch(`/api/image-resize/jobs/${jobId}`, { credentials: 'include' })
      const text = await res.text()
      let data: { downloadUrl?: string; errorMessage?: string }
      try {
        data = text.startsWith('{') ? JSON.parse(text) : {}
      } catch {
        alert(text.startsWith('<') ? 'サーバーエラーです。' : 'ダウンロードURLの取得に失敗しました')
        return
      }
      if (data.downloadUrl) {
        window.location.href = data.downloadUrl
      } else {
        alert(data.errorMessage || 'ダウンロードURLの取得に失敗しました')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ダウンロードに失敗しました')
    }
  }, [])

  const handleCancel = useCallback(
    async (jobId: number) => {
      setCancellingJobId(jobId)
      try {
        const res = await fetch(`/api/image-resize/jobs/${jobId}/cancel`, {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          alert(data.error || '中止に失敗しました')
          return
        }
        await fetchJobs()
      } catch (e) {
        alert(e instanceof Error ? e.message : '中止に失敗しました')
      } finally {
        setCancellingJobId(null)
      }
    },
    [fetchJobs]
  )

  const statusLabel: Record<string, string> = {
    pending: '待機中',
    processing: '処理中',
    completed: '完了',
    failed: '失敗',
  }

  return (
    <div className="mt-8 border border-gray-200 rounded-lg p-6 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">履歴</h3>
        <button
          type="button"
          onClick={fetchJobs}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          {loading ? '読み込み中…' : '再読み込み'}
        </button>
      </div>
      {error && (
        <p className="text-red-600 text-sm mb-4" role="alert">
          {error}
        </p>
      )}
      {!loading && jobs.length === 0 && !error && (
        <p className="text-gray-500 text-sm">まだジョブはありません。</p>
      )}
      {!loading && jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4">ジョブID</th>
                <th className="text-left py-2 pr-4">登録日時</th>
                <th className="text-left py-2 pr-4">枚数</th>
                <th className="text-left py-2 pr-4">サイズ</th>
                <th className="text-left py-2 pr-4">ステータス</th>
                <th className="text-left py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.jobId} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{job.jobId}</td>
                  <td className="py-2 pr-4">{formatDate(job.createdAt)}</td>
                  <td className="py-2 pr-4">
                    {job.status === 'processing' && job.processedCount != null
                      ? `約 ${job.processedCount} 枚リサイズ済み`
                      : job.imageCount != null
                        ? `${job.imageCount} 枚`
                        : '—'}
                  </td>
                  <td className="py-2 pr-4">{formatSize(job.inputSizeBytes)}</td>
                  <td className="py-2 pr-4">
                    {job.status === 'processing' && job.processedCount != null
                      ? `処理中（${job.processedCount} 枚済み）`
                      : statusLabel[job.status] ?? job.status}
                  </td>
                  <td className="py-2">
                    {job.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleDownload(job.jobId)}
                        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                      >
                        ダウンロード
                      </button>
                    )}
                    {(job.status === 'pending' || job.status === 'processing') && (
                      <button
                        type="button"
                        onClick={() => handleCancel(job.jobId)}
                        disabled={cancellingJobId === job.jobId}
                        className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50"
                      >
                        {cancellingJobId === job.jobId ? '中止中…' : '中止'}
                      </button>
                    )}
                    {job.status === 'failed' && job.errorMessage && (
                      <span className="text-red-600 text-xs" title={job.errorMessage}>
                        {job.errorMessage.length > 30 ? `${job.errorMessage.slice(0, 30)}…` : job.errorMessage}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
