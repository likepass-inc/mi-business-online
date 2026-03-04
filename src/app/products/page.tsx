'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Link from 'next/link'
import type { Product } from '@/lib/types'

const PAGE_SIZE = 20
const DAYS_OPTIONS = [7, 14, 30] as const

function formatDate(iso?: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

type Tab = 'new' | 'discontinued'

function ProductsPageContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const daysParam = searchParams.get('days')
  const [tab, setTab] = useState<Tab>(tabParam === 'discontinued' ? 'discontinued' : 'new')
  const [days, setDays] = useState(() => {
    const d = daysParam ? parseInt(daysParam, 10) : 30
    return DAYS_OPTIONS.includes(d as any) ? d : 30
  })
  const [page, setPage] = useState(0)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(() => {
    setLoading(true)
    setError(null)
    const offset = page * PAGE_SIZE
    const url =
      tab === 'new'
        ? `/api/products?filter=new&days=${days}&limit=${PAGE_SIZE}&offset=${offset}`
        : `/api/products?filter=discontinued&limit=${PAGE_SIZE}&offset=${offset}`
    fetch(url)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setProducts(res.data)
          setTotal(res.pagination?.total ?? res.data.length)
        } else {
          setError(res.error || 'Failed to load')
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to fetch'))
      .finally(() => setLoading(false))
  }, [tab, days, page])

  useEffect(() => {
    setTab(tabParam === 'discontinued' ? 'discontinued' : 'new')
  }, [tabParam])

  useEffect(() => {
    if (daysParam) {
      const d = parseInt(daysParam, 10)
      if (DAYS_OPTIONS.includes(d as any)) setDays(d)
    }
  }, [daysParam])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">商品動向</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            ダッシュボードに戻る
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => { setTab('new'); setPage(0) }}
              className={`px-4 py-2 text-sm font-medium ${tab === 'new' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              新規登録商品
            </button>
            <button
              onClick={() => { setTab('discontinued'); setPage(0) }}
              className={`px-4 py-2 text-sm font-medium ${tab === 'discontinued' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              販売終了商品
            </button>
          </div>
          {tab === 'new' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">直近</span>
              {DAYS_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => { setDays(d); setPage(0) }}
                  className={`px-3 py-1 text-sm rounded ${days === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {d}日
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-6">
          {tab === 'new'
            ? `直近${days}日以内に当システムに登録された商品です。サイトで新規掲載された商品をクロールで取得したものを含みます。`
            : '商品ページ内の在庫表示（販売終了に関連するテキスト）に基づいて表示しています。'}
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            読み込み中...
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品コード</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {tab === 'new' ? '登録日' : '更新日'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">リンク</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          該当する商品はありません
                        </td>
                      </tr>
                    ) : (
                      products.map(p => (
                        <tr key={p.product_code} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={p.product_name}>
                            {p.product_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{p.product_code}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDate(tab === 'new' ? p.created_at : p.updated_at)}
                          </td>
                          <td className="px-4 py-3">
                            <a
                              href={p.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              開く
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  前へ
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  {page + 1} / {totalPages}（全 {total} 件）
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </AppLayout>
    }>
      <ProductsPageContent />
    </Suspense>
  )
}
