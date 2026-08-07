'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const relatedProductsByCategory = [
  {
    category: 'お菓子',
    products: [
      { name: 'エスプリ・アンテノール', price: '¥3,240', url: 'https://business.mistore.jp/shop/g/gP672-513F25?occasion=houyou' },
      { name: 'ロイスダールギフト', price: '¥4,320', url: 'https://business.mistore.jp/shop/g/gP672-813F25?occasion=houyou' },
      { name: '花あわせ', price: '¥2,700', url: 'https://business.mistore.jp/shop/g/gP674-243F25?occasion=houyou' },
    ]
  },
  {
    category: 'ドリンク',
    products: [
      { name: 'ブレンディカフェラトリースティック', price: '¥2,160', url: 'https://business.mistore.jp/shop/g/gP666-723F25?occasion=houyou' },
      { name: 'ティーバッグギフトコレクション', price: '¥3,240', url: 'https://business.mistore.jp/shop/g/gP665-563F25?occasion=houyou' },
      { name: '天皇杯受賞生産者の茶', price: '¥4,320', url: 'https://business.mistore.jp/shop/g/gP671-203F25?occasion=houyou' },
    ]
  },
  {
    category: 'タオル',
    products: [
      { name: '御白金浴巾 タオルセット', price: '¥5,400', url: 'https://business.mistore.jp/shop/g/gP623-143F25?occasion=houyou' },
      { name: 'ウォッシュタオルセット', price: '¥6,480', url: 'https://business.mistore.jp/shop/g/gP601-043F25?occasion=houyou' },
      { name: 'わたいろ タオルセット', price: '¥4,320', url: 'https://business.mistore.jp/shop/g/gP600-693F25?occasion=houyou' },
    ]
  },
  {
    category: 'カタログギフト',
    products: [
      { name: 'ギフト オブ グルメ［味覚百景］賓コース', price: '¥10,800〜', url: 'https://business.mistore.jp/shop/g/g008W-474/' },
    ]
  },
]

const allProducts = relatedProductsByCategory.flatMap(c => c.products)

const recommendArticles = [
  { title: '香典返しのカタログギフトとは？選ばれる理由と相場・マナーを解説', url: '/mockup/article' },
  { title: '法事のお返しで人気のお菓子とは？選ばれる理由とおすすめ・マナーを解説', url: '/mockup/article' },
  { title: '香典返しの品物人気ランキング｜贈る前に知っておきたい相場・選び方・マナー', url: '/mockup/article' },
]

type Tab = 'article' | 'product_list'

export default function ArticleMockupPage() {
  const [activeTab, setActiveTab] = useState<Tab>('article')

  // URLハッシュ（#product_list）でタブを切り替え（moodmarkgift と同様）
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash === '#product_list') {
      setActiveTab('product_list')
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#f9f8f6]">
      {/* ヘッダー - business.mistore.jp 風 */}
      <header className="mockup-header px-4 md:px-8 py-4 flex justify-between items-center bg-white">
        <span className="text-base font-medium text-[#333]">
          三越伊勢丹法人オンラインストア【ギフトマガジン】
        </span>
        <Link
          href="https://business.mistore.jp/shop/"
          target="_blank"
          rel="noopener"
          className="text-sm text-[#0066a2] hover:underline px-3 py-1.5 border border-[#e0dcd5] rounded"
        >
          ショッピングサイトはこちら
        </Link>
      </header>

      {/* パンくず */}
      <nav className="mockup-breadcrumb px-4 md:px-8 py-2.5 text-sm">
        <Link href="/mockup/magazine-top" className="text-[#666] hover:text-[#0066a2]">HOME</Link>
        <span className="mx-1 text-[#999]">›</span>
        <Link href="/mockup/magazine-top" className="text-[#666] hover:text-[#0066a2]">弔事の贈りもの</Link>
        <span className="mx-1 text-[#999]">›</span>
        <span className="text-[#333]">失敗しない法事 法要のお返し・引き物</span>
      </nav>

      {/* タブナビゲーション */}
      <div className="border-b border-[#e0dcd5] bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <nav className="flex gap-1" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'article'}
              onClick={() => {
                setActiveTab('article')
                window.history.replaceState(null, '', window.location.pathname)
              }}
              className={`px-5 py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'article'
                  ? 'border-[#5c4a3a] text-[#333]'
                  : 'border-transparent text-[#999] hover:text-[#666]'
              }`}
            >
              記事
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'product_list'}
              onClick={() => {
                setActiveTab('product_list')
                window.history.replaceState(null, '', '#product_list')
              }}
              className={`px-5 py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'product_list'
                  ? 'border-[#5c4a3a] text-[#333]'
                  : 'border-transparent text-[#999] hover:text-[#666]'
              }`}
            >
              商品一覧
            </button>
          </nav>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex max-w-6xl mx-auto">
        <main className="flex-1 px-4 md:px-8 py-8 max-w-3xl bg-white rounded-lg shadow-sm mx-4 md:mx-6 my-6">
          {activeTab === 'article' ? (
            <>
              {/* 記事ヘッダー */}
              <header className="mb-6 pb-4 border-b border-[#e0dcd5]">
                <span className="text-sm text-[#666]">弔事の贈りもの</span>
                <span className="mx-2 text-[#999]">|</span>
                <time className="text-sm text-[#666]">2026.02.08</time>
                <h1 className="text-xl md:text-2xl font-bold text-[#333] mt-2 leading-tight">
                  失敗しない法事 法要のお返し・引き物｜選び方と相場、人気の品物ランキングとマナー
                </h1>
              </header>

              {/* 目次 */}
              <nav className="mb-8 p-4 bg-[#f9f8f6] border border-[#e0dcd5] rounded">
                <h2 className="font-semibold text-[#333] mb-2">目次</h2>
                <ol className="list-decimal list-inside text-sm space-y-1 text-[#666]">
                  <li>法事や法要のお返し・引き物とは？</li>
                  <li>法事や法要のお返し・引き物のマナーは？</li>
                  <li>【法事のお返し・引き物】喜ばれるお菓子のおすすめランキング</li>
                  <li>【法事のお返し・引き物】日持ちするドリンクのおすすめランキング</li>
                  <li>三越伊勢丹法人オンラインストアは個人でも利用できる</li>
                </ol>
              </nav>

              {/* 本文（抜粋） */}
              <div className="prose max-w-none mb-8">
                <p className="text-[#333] leading-relaxed">
                  法事や法要の引き物は、香典のお返しとして、参列してくれた方に感謝の気持ちを込めて贈るギフトです。
                  この記事では、法事や法要の引き物のマナーと、おすすめの品物をご紹介いたします。
                </p>
                <p className="text-[#333] leading-relaxed mt-4">
                  法事や法要のお返しは、基本的に参列して頂いた方全員に渡します。
                </p>

                {/* カテゴリ別商品紹介（記事内） */}
                {relatedProductsByCategory.map((group) => (
                  <div key={group.category} className="my-8">
                    <h3 className="text-base font-semibold text-[#333] mb-4">
                      【法事のお返し・引き物】{group.category}のおすすめランキング
                    </h3>
                    {group.products.map((product) => (
                      <div key={product.name} className="mb-6 p-4 border border-[#e0dcd5] rounded bg-[#f9f8f6]">
                        <h4 className="font-medium text-[#333] mb-2">{product.name}</h4>
                        <div className="flex gap-4">
                          <div className="w-24 h-24 bg-[#e8e6e2] rounded flex items-center justify-center text-[#999] text-xs shrink-0">
                            [画像]
                          </div>
                          <div>
                            <p className="text-sm text-[#666] mb-2">
                              商品説明文がここに入ります。日持ちするものが多いため、賞味期限をあまり気にせず...
                            </p>
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener"
                              className="text-sm text-[#0066a2] hover:underline font-medium"
                            >
                              商品詳細はこちらから
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* 商品一覧タブへの導線 */}
              <div className="mb-10 p-4 bg-[#f9f8f6] rounded border border-[#e0dcd5]">
                <p className="text-sm text-[#666] mb-2">
                  この記事で紹介した商品を一覧でご覧いただけます。
                </p>
                <button
                  onClick={() => setActiveTab('product_list')}
                  className="text-sm font-medium text-[#0066a2] hover:underline"
                >
                  → 商品一覧を見る
                </button>
              </div>

              {/* CTA */}
              <section className="mb-10 p-6 bg-[#f9f8f6] rounded border border-[#e0dcd5]">
                <h2 className="font-semibold text-[#333] mb-2">関連商品を見る</h2>
                <a
                  href="https://business.mistore.jp/shop/o/ohouyou"
                  target="_blank"
                  rel="noopener"
                  className="inline-block px-6 py-3 bg-white text-[#5c4a3a] border border-[#5c4a3a] text-sm font-medium rounded hover:bg-[#f9f8f6] transition-colors"
                >
                  法要の引き物をすべて見る
                </a>
              </section>

              {/* 関連記事 */}
              <section>
                <h2 className="text-lg font-bold text-[#333] mb-4">関連記事</h2>
                <ul className="space-y-3">
                  {recommendArticles.map((art) => (
                    <li key={art.title}>
                      <Link
                        href={art.url}
                        className="block p-4 border border-[#e0dcd5] rounded hover:bg-[#f9f8f6] transition-colors"
                      >
                        <span className="text-xs text-[#666]">弔事の贈りもの</span>
                        <h3 className="text-sm font-medium text-[#333] mt-1 hover:text-[#0066a2]">
                          {art.title}
                        </h3>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            /* 商品一覧タブ（#product_list 相当） */
            <div id="product_list">
              <header className="mb-6 pb-4 border-b border-[#e0dcd5]">
                <h1 className="text-lg font-bold text-[#333]">
                  この記事で紹介した商品一覧
                </h1>
                <p className="text-sm text-[#666] mt-1">
                  法事・法要の引き物におすすめの商品を価格帯・カテゴリ別にご紹介
                </p>
              </header>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {allProducts.map((product) => (
                  <a
                    key={product.name}
                    href={product.url}
                    target="_blank"
                    rel="noopener"
                    className="block border border-[#e0dcd5] rounded overflow-hidden hover:shadow-md transition-shadow bg-white"
                  >
                    <div className="aspect-square bg-[#f0eeea] flex items-center justify-center text-[#999] text-sm">
                      [画像]
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-[#333] line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-sm font-semibold text-[#5c4a3a] mt-1">
                        {product.price}
                      </p>
                      <p className="text-xs text-[#0066a2] mt-1 hover:underline">商品を見る</p>
                    </div>
                  </a>
                ))}
              </div>

              <div className="mt-8 p-6 bg-[#f9f8f6] rounded border border-[#e0dcd5]">
                <a
                  href="https://business.mistore.jp/shop/o/ohouyou"
                  target="_blank"
                  rel="noopener"
                  className="inline-block px-6 py-3 bg-white text-[#5c4a3a] border border-[#5c4a3a] text-sm font-medium rounded hover:bg-[#f9f8f6] transition-colors"
                >
                  法要の引き物をすべて見る
                </a>
              </div>

              <p className="mt-4 text-xs text-[#999]">
                参考: isetan.mistore.jp/moodmarkgift のタブ切り替え形式（記事 / 商品一覧）を採用
              </p>
            </div>
          )}
        </main>

        {/* サイドバー */}
        <aside className="w-56 shrink-0 border-l border-[#e0dcd5] p-6 hidden lg:block bg-white rounded-r-lg">
          <div className="sticky top-24">
            <h3 className="font-semibold text-[#333] mb-4">このカテゴリの商品</h3>
            <a
              href="https://business.mistore.jp/shop/o/ohouyou"
              target="_blank"
              rel="noopener"
              className="block w-full px-4 py-3 bg-white text-[#5c4a3a] border border-[#5c4a3a] text-center text-sm rounded hover:bg-[#f9f8f6] transition-colors"
            >
              法要の引き物をすべて見る
            </a>
            <div className="mt-4">
              <button
                onClick={() => setActiveTab(activeTab === 'article' ? 'product_list' : 'article')}
                className="text-sm text-[#0066a2] hover:underline w-full text-left"
              >
                {activeTab === 'article' ? '商品一覧を見る' : '記事に戻る'}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* フッター */}
      <div className="border-t border-[#e0dcd5] bg-white px-4 md:px-8 py-3 text-center text-sm text-[#666] mt-6">
        <Link href="/mockup" className="text-[#0066a2] hover:underline">
          ← モックアップ一覧に戻る
        </Link>
        {' · '}
        <Link href="/mockup/magazine-top" className="text-[#0066a2] hover:underline">
          マガジンTOP
        </Link>
        {' · '}
        <span className="text-[#999]">記事/商品一覧タブ切り替えモックアップ</span>
      </div>
    </div>
  )
}
