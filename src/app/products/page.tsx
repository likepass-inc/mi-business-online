'use client'

import AppLayout from '@/components/layout/AppLayout'

/*
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import { linkClass, tableClass, tdClass, thClass } from '@/components/ui/styles'
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
      <div className="grid gap-6">
        <PageHeader
          title="商品動向"
          description={
            tab === 'new'
              ? `直近${days}日以内に当システムに登録された商品です。サイトで新規掲載された商品をクロールで取得したものを含みます。`
              : '商品ページ内の在庫表示（販売終了に関連するテキスト）に基づいて表示しています。'
          }
        >
          <div className="flex flex-wrap gap-4 items-center">
            <SegmentedControl
              ariaLabel="商品の種類"
              value={tab}
              onChange={(next) => { setTab(next); setPage(0) }}
              options={[
                { value: 'new', label: '新規登録商品' },
                { value: 'discontinued', label: '販売終了商品' },
              ]}
            />
            {tab === 'new' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">直近</span>
                <SegmentedControl
                  ariaLabel="対象日数"
                  value={String(days) as '7' | '14' | '30'}
                  onChange={(next) => { setDays(Number(next)); setPage(0) }}
                  options={DAYS_OPTIONS.map((d) => ({ value: String(d) as '7' | '14' | '30', label: `${d}日` }))}
                />
              </div>
            )}
          </div>
        </PageHeader>

        {error && (
          <p className="m-0 text-danger text-sm">{error}</p>
        )}

        {loading ? (
          <p className="m-0 text-muted text-sm">読み込み中...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>商品名</th>
                    <th className={thClass}>商品コード</th>
                    <th className={thClass}>
                      {tab === 'new' ? '登録日' : '更新日'}
                    </th>
                    <th className={thClass}>リンク</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={`${tdClass} text-center text-muted`}>
                        該当する商品はありません
                      </td>
                    </tr>
                  ) : (
                    products.map(p => (
                      <tr key={p.product_code} className="hover:bg-[#fafafa]">
                        <td className={`${tdClass} max-w-xs truncate`} title={p.product_name}>
                          {p.product_name}
                        </td>
                        <td className={`${tdClass} text-muted`}>{p.product_code}</td>
                        <td className={`${tdClass} text-muted`}>
                          {formatDate(tab === 'new' ? p.created_at : p.updated_at)}
                        </td>
                        <td className={tdClass}>
                          <a
                            href={p.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${linkClass} text-sm`}
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

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  前へ
                </Button>
                <span className="text-sm text-muted">
                  {page + 1} / {totalPages}（全 {total} 件）
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  次へ
                </Button>
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
        <p className="m-0 text-muted text-sm">読み込み中...</p>
      </AppLayout>
    }>
      <ProductsPageContent />
    </Suspense>
  )
}
*/

export default function ProductsPage() {
  return <AppLayout>{null}</AppLayout>
}
