import Link from 'next/link'

export const metadata = {
  title: 'マガジン TOP - モックアップ',
  description: 'マガジンTOPページの理想構造モックアップ（business.mistore.jp 準拠）',
}

const categories = [
  'お中元',
  'お歳暮',
  'お祝いのギフト',
  '手土産・差し入れ',
  '記念日・イベント用のギフト',
  'お礼のギフト',
  '季節のギフト',
  '特集',
]

const popularKeywords = [
  'マナー',
  '相場',
  '退職お菓子',
  '香典返し',
  'お詫び',
  '表書き',
  '法人ギフト',
  'カタログギフト',
  'お中元',
  'お歳暮',
]

const popularCategories = [
  { name: 'お中元', desc: 'お中元に関する贈り物のマナーとおすすめ商品をご紹介します。', href: '/mockup/article' },
  { name: 'お歳暮', desc: 'お歳暮に関する贈り物のマナーとおすすめ商品をご紹介します。', href: '/mockup/article' },
  { name: '弔事の贈りもの', desc: '弔事・香典返しに関する贈り物のしきたりとマナーをご紹介します。', href: '/mockup/article' },
  { name: '退職・お礼のギフト', desc: '退職時の挨拶やお礼の品選びのポイントをご紹介します。', href: '/mockup/article' },
  { name: 'お詫び・謝罪の品', desc: 'お詫びや謝罪の際の贈り物選びとマナーをご紹介します。', href: '/mockup/article' },
  { name: '記念日・イベント用', desc: '記念日やイベントに贈るギフトの選び方をお伝えします。', href: '/mockup/article' },
]

const allCategoriesWithCount = [
  { name: 'お中元', count: 12 },
  { name: 'お歳暮', count: 8 },
  { name: '弔事の贈りもの', count: 15 },
  { name: 'お祝いのギフト', count: 6 },
  { name: '手土産・差し入れ', count: 10 },
  { name: '記念日・イベント用のギフト', count: 9 },
  { name: 'お礼のギフト', count: 11 },
  { name: '季節のギフト', count: 5 },
  { name: '特集', count: 7 },
  { name: '販促・ノベルティ', count: 4 },
]

const faqItems = [
  { q: '法人向けギフトは個人でも購入できますか？', a: '三越伊勢丹法人オンラインストアは、名称に法人とありますが個人のお客様でもご利用いただけます。包装紙・のし・手さげ袋の無料サービスや、送料の割引などもご利用可能です。' },
  { q: 'お中元・お歳暮の相場はどのくらいですか？', a: '一般的に3,000円〜5,000円程度が相場とされています。関係性や地域によって変動するため、事前に確認することをお勧めします。' },
  { q: '退職祝いのお菓子はどのようなものを選べばよいですか？', a: '小分け・個包装のお菓子が職場での配布に便利です。日持ちするものや、上品な味わいの和洋菓子が喜ばれます。' },
  { q: '香典返しの時期やマナーは？', a: '四十九日の法要を済ませてから、忌明け法要までの約14日間のうちに贈るのが一般的です。金額はいただいた香典の半分〜3分の1程度が目安です。' },
]

const popularShopCategories = [
  { name: '法要の引き物を見る', url: 'https://business.mistore.jp/shop/o/ohouyou' },
  { name: '退職お菓子を見る', url: 'https://business.mistore.jp/shop/c/c01_iP04/' },
  { name: 'お詫びの品を見る', url: 'https://business.mistore.jp/shop/b/bB1000092?occasion=apology' },
]

const articles = [
  { id: 1, title: '法人向けノベルティで人気が高いのは？年度末や期末の予算消化で差がつくアイテム特集', category: '販促・ノベルティ', date: '2026.01.18' },
  { id: 2, title: 'バレンタインにチョコを贈って感謝の気持ちを伝えよう｜従業員に贈るギフトの選び方も紹介', category: '記念日・イベント用のギフト', date: '2026.01.20' },
  { id: 3, title: '失敗しない法事 法要のお返し・引き物｜選び方と相場、人気の品物ランキングとマナー', category: '弔事の贈りもの', date: '2026.02.08' },
  { id: 4, title: '退職時に贈るお礼のお菓子おすすめ20選｜感謝の気持ちが伝わる人気のお菓子', category: 'お礼のギフト', date: '2026.02.03' },
]

export default function MagazineTopMockupPage() {
  return (
    <div className="bg-[#f9f8f6]">
      {/* ヘッダー - business.mistore.jp 風 */}
      <header className="mockup-header px-4 py-4 md:px-8 flex justify-between items-center">
        <h1 className="text-base md:text-lg font-medium text-[#333] tracking-wide">
          三越伊勢丹法人オンラインストア【ギフトマガジン】
        </h1>
        <Link
          href="https://business.mistore.jp/shop/"
          target="_blank"
          rel="noopener"
          className="text-sm text-[#0066a2] hover:underline px-3 py-1.5 border border-[#e0dcd5] rounded"
        >
          ショッピングサイトはこちら
        </Link>
      </header>

      {/* カテゴリナビ - 実サイトと同じ構成 */}
      <nav className="mockup-nav-categories px-4 md:px-8 py-3 overflow-x-auto">
        <ul className="flex gap-6 md:gap-8 whitespace-nowrap text-sm">
          {categories.map((cat) => (
            <li key={cat}>
              <Link href="/mockup/article" className="text-[#333] hover:text-[#5c4a3a]">
                {cat}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ヒーロー */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10">
        <h2 className="text-xl md:text-2xl font-bold text-[#333] mb-2">
          法人向けギフトの選び方とマナー
        </h2>
        <p className="text-[#666] leading-relaxed">
          お中元・お歳暮・退職祝い・弔事など、シーン別のマナーとおすすめ商品をご紹介します。大切な方への贈り物選びにご活用ください。
        </p>
      </section>

      {/* 人気のキーワード */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-6">
        <h3 className="text-sm font-semibold text-[#333] mb-3">人気のキーワード</h3>
        <div className="flex flex-wrap gap-2">
          {popularKeywords.map((kw) => (
            <Link
              key={kw}
              href="/mockup/article"
              className="px-3 py-1.5 text-sm border border-[#e0dcd5] rounded text-[#0066a2] hover:underline hover:border-[#5c4a3a]"
            >
              {kw}
            </Link>
          ))}
        </div>
      </section>

      {/* 人気カテゴリ一覧 */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-10">
        <h3 className="text-base font-semibold text-[#333] mb-4">
          法人ギフトをシーン別に解説
        </h3>
        <p className="text-sm text-[#666] mb-6">
          お中元、お歳暮、弔事、退職祝いなど、シーン別の贈り物マナーを詳しくご紹介します。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {popularCategories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="mockup-article-card block p-5 rounded-sm"
            >
              <h4 className="font-medium text-[#333] mb-2">{cat.name}</h4>
              <p className="text-sm text-[#666] mb-3 line-clamp-2">{cat.desc}</p>
              <span className="text-sm text-[#0066a2] hover:underline">
                詳細を見る →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* メインコンテンツ */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 flex gap-10">
        <main className="flex-1 min-w-0">
          {/* 人気記事 */}
          <section>
            <h3 className="text-base font-semibold text-[#333] mb-2">人気記事</h3>
            <p className="text-sm text-[#666] mb-6">
              贈り物選びでよくある疑問や悩みを解決する人気記事を厳選。おすすめの品物やマナーをご紹介します。
            </p>
          <ul className="space-y-6">
            {articles.map((art) => (
              <li key={art.id}>
                <article className="mockup-article-card p-5 md:p-6 bg-white rounded-sm">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="md:w-48 shrink-0 aspect-video md:aspect-square bg-[#f0eeeb] rounded-sm flex items-center justify-center text-[#999] text-xs">
                      [画像]
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="mockup-category-tag mb-1">{art.category}</p>
                      <p className="mockup-date mb-2">{art.date}</p>
                      <h2 className="mockup-article-title mb-2">
                        <Link href="/mockup/article" className="text-[#333] hover:text-[#0066a2] hover:underline">
                          {art.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-[#666] leading-relaxed line-clamp-2 mb-3">
                        記事の抜粋文がここに入ります。マナーや選び方のポイントを分かりやすくご紹介いたします...
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href="/mockup/article"
                          className="text-sm text-[#0066a2] hover:underline"
                        >
                          記事を読む
                        </Link>
                        <span className="text-[#e0dcd5]">|</span>
                        <Link
                          href="https://business.mistore.jp/shop/"
                          target="_blank"
                          rel="noopener"
                          className="text-sm text-[#0066a2] hover:underline"
                        >
                          該当商品を見る
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          </section>

          {/* 全カテゴリ一覧 */}
          <section className="mt-10">
            <h3 className="text-base font-semibold text-[#333] mb-2">
              マガジン全カテゴリ一覧
            </h3>
            <p className="text-sm text-[#666] mb-4">
              お祝いごとから弔事まで、法人ギフトのマナーをシーン別にまとめました。
            </p>
            <div className="flex flex-wrap gap-2">
              {allCategoriesWithCount.map((cat) => (
                <Link
                  key={cat.name}
                  href="/mockup/article"
                  className="px-3 py-1.5 text-sm bg-white border border-[#e0dcd5] rounded text-[#0066a2] hover:underline hover:border-[#5c4a3a]"
                >
                  {cat.name}（{cat.count}）
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-10">
            <h3 className="text-base font-semibold text-[#333] mb-2">
              法人ギフトでよくある質問と回答
            </h3>
            <p className="text-sm text-[#666] mb-4">
              金額相場、包装の仕方、のし紙の書き方など、贈り物選びで迷いがちなポイントをQ&A形式で解説します。
            </p>
            <div className="mockup-faq space-y-0 border border-[#e0dcd5] rounded overflow-hidden divide-y divide-[#e0dcd5]">
              {faqItems.map((item, i) => (
                <details key={i} className="group">
                  <summary className="mockup-faq-question py-4 px-4 cursor-pointer text-sm font-medium text-[#333] bg-white hover:bg-[#f9f8f6] list-none flex items-center justify-between gap-2">
                    <span>{item.q}</span>
                    <span className="mockup-faq-icon shrink-0 text-[#999] transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  <div className="px-4 pb-4 pt-0 text-sm text-[#666] leading-relaxed bg-[#f9f8f6]">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* CTA - 実サイト風の落ち着いたトーン */}
          <section className="mt-10 p-6 md:p-8 bg-white rounded-sm border border-[#e0dcd5]">
            <h2 className="text-base font-medium text-[#333] mb-3">
              法人向けギフトをお探しなら
            </h2>
            <Link
              href="https://business.mistore.jp/shop/"
              target="_blank"
              rel="noopener"
              className="mockup-btn-primary inline-block rounded-sm"
            >
              ショッピングサイトへ
            </Link>
          </section>
        </main>

        {/* サイドバー - 実サイトのCATEGORY風 */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-6">
            <h3 className="text-sm font-semibold text-[#333] mb-4 tracking-wide border-b border-[#e0dcd5] pb-2">
              人気の商品カテゴリ
            </h3>
            <ul className="space-y-2 text-sm">
              {popularShopCategories.map((cat) => (
                <li key={cat.name}>
                  <a
                    href={cat.url}
                    target="_blank"
                    rel="noopener"
                    className="text-[#0066a2] hover:underline block py-1"
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* フッター */}
      <footer className="mockup-footer px-4 md:px-8 py-4 mt-8">
        <div className="max-w-6xl mx-auto text-center">
          <Link href="/mockup" className="text-[#0066a2] hover:underline">
            モックアップ一覧に戻る
          </Link>
          <span className="mx-2 text-[#999]">·</span>
          <span>business.mistore.jp マガジン 理想構造モックアップ</span>
        </div>
      </footer>
    </div>
  )
}
