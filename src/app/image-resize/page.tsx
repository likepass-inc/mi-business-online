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
          ZIPで複数画像をまとめてアップロードすることもできます（最大30枚、50MBまで）。
        </p>

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
      </div>
    </AppLayout>
  )
}
