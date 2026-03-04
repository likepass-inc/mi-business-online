'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Product } from '@/lib/types'

interface ProductChangesProps {
  /** 新商品の表示件数 */
  newLimit?: number
  /** 新商品の対象日数（直近N日） */
  newDays?: number
  /** 販売終了の表示件数 */
  discontinuedLimit?: number
}

function formatDate(iso?: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export default function ProductChanges({
  newLimit = 10,
  newDays = 30,
  discontinuedLimit = 10
}: ProductChangesProps) {
  const [newProducts, setNewProducts] = useState<Product[]>([])
  const [discontinuedProducts, setDiscontinuedProducts] = useState<Product[]>([])
  const [newTotal, setNewTotal] = useState(0)
  const [discontinuedTotal, setDiscontinuedTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/products?filter=new&days=${newDays}&limit=${newLimit}&offset=0`).then(r => r.json()),
      fetch(`/api/products?filter=discontinued&limit=${discontinuedLimit}&offset=0`).then(r => r.json())
    ])
      .then(([newRes, discRes]) => {
        if (cancelled) return
        if (newRes.success && newRes.data) {
          setNewProducts(newRes.data)
          setNewTotal(newRes.pagination?.total ?? newRes.data.length)
        }
        if (discRes.success && discRes.data) {
          setDiscontinuedProducts(discRes.data)
          setDiscontinuedTotal(discRes.pagination?.total ?? discRes.data.length)
        }
        if (!newRes.success || !discRes.success) {
          setError(newRes.error || discRes.error || 'Failed to load product changes')
        }
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to fetch')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [newLimit, newDays, discontinuedLimit])

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 新商品 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">新規登録商品（直近{newDays}日以内にDB登録）</h3>
          <Link
            href={`/products?tab=new&days=${newDays}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            もっと見る
          </Link>
        </div>
        {newProducts.length === 0 ? (
          <p className="text-gray-500 text-sm">該当なし</p>
        ) : (
          <ul className="space-y-2">
            {newProducts.map(p => (
              <li key={p.product_code} className="flex flex-wrap items-center gap-2 text-sm border-b border-gray-100 pb-2 last:border-0">
                <a
                  href={p.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium truncate max-w-[60%]"
                >
                  {p.product_name}
                </a>
                <span className="text-gray-500">{p.product_code}</span>
                <span className="text-gray-400">{formatDate(p.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-400 mt-2">計 {newTotal} 件</p>
      </div>

      {/* 販売終了 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">販売終了商品（在庫状況が「販売終了」のもの）</h3>
          <Link
            href="/products?tab=discontinued"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            もっと見る
          </Link>
        </div>
        {discontinuedProducts.length === 0 ? (
          <p className="text-gray-500 text-sm">該当なし</p>
        ) : (
          <ul className="space-y-2">
            {discontinuedProducts.map(p => (
              <li key={p.product_code} className="flex flex-wrap items-center gap-2 text-sm border-b border-gray-100 pb-2 last:border-0">
                <a
                  href={p.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium truncate max-w-[60%]"
                >
                  {p.product_name}
                </a>
                <span className="text-gray-500">{p.product_code}</span>
                {p.updated_at && (
                  <span className="text-gray-400">{formatDate(p.updated_at)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-400 mt-2">計 {discontinuedTotal} 件</p>
      </div>
    </div>
  )
}
