'use client'

import { useState, useCallback } from 'react'
import AppLayout from '@/components/layout/AppLayout'

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
        <BatchResizeSection />
      </div>
    </AppLayout>
  )
}

function BatchResizeSection() {
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [step, setStep] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [jobId, setJobId] = useState<number | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)

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
      const urlData = await urlRes.json()
      if (!urlRes.ok || !urlData.uploadUrl || !urlData.objectKey) {
        setBatchError(urlData.error || 'アップロード URL の取得に失敗しました')
        setStep('error')
        return
      }
      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        })
        xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload ${xhr.status}`))))
        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.open('PUT', urlData.uploadUrl)
        xhr.setRequestHeader('Content-Type', 'application/zip')
        xhr.send(batchFile)
      })
      setStep('processing')
      const jobRes = await fetch('/api/image-resize/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectKey: urlData.objectKey }),
      })
      const jobData = await jobRes.json()
      if (!jobRes.ok || !jobData.jobId) {
        setBatchError(jobData.error || 'ジョブの登録に失敗しました')
        setStep('error')
        return
      }
      setJobId(jobData.jobId)
      const poll = async () => {
        const res = await fetch(`/api/image-resize/jobs/${jobData.jobId}`)
        const data = await res.json()
        if (data.status === 'completed' && data.downloadUrl) {
          setDownloadUrl(data.downloadUrl)
          setStep('done')
          return
        }
        if (data.status === 'failed') {
          setBatchError(data.errorMessage || '処理に失敗しました')
          setStep('error')
          return
        }
        setTimeout(poll, 3000)
      }
      setTimeout(poll, 2000)
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'エラーが発生しました')
      setStep('error')
    }
  }, [batchFile])

  const resetBatch = useCallback(() => {
    setBatchFile(null)
    setStep('idle')
    setUploadProgress(0)
    setJobId(null)
    setDownloadUrl(null)
    setBatchError(null)
  }, [])

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
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
        <p className="text-gray-600 mb-2">リサイズ処理中です。完了までお待ちください（ジョブ ID: {jobId}）…</p>
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
