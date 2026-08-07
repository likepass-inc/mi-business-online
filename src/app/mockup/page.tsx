export const metadata = {
  title: 'マガジン・ショップ連携 モックアップ',
  description: 'business.mistore.jp マガジンの理想構造モックアップ',
}

export default function MockupIndexPage() {
  return (
    <div className="min-h-screen bg-[#f9f8f6] p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-[#333] mb-2">
          マガジン・ショップ連携 モックアップ
        </h1>
        <p className="text-[#666] mb-8">
          business.mistore.jp マガジンおよび記事ページの理想構造のモックアップです。
        </p>

        <nav className="space-y-4">
          <a
            href="/mockup/magazine-top"
            className="block p-6 bg-white rounded border border-[#e0dcd5] hover:shadow-md transition-shadow mockup-article-card"
          >
            <h2 className="text-lg font-semibold text-[#333]">
              マガジン TOP ページ
            </h2>
            <p className="text-sm text-[#999] mt-1">
              /mockup/magazine-top
            </p>
            <p className="text-[#666] mt-2 text-sm">
              カテゴリ一覧、記事グリッド、ショップへの導線を強化した構造
            </p>
          </a>

          <div className="block p-6 bg-white rounded border border-[#e0dcd5] hover:shadow-md transition-shadow mockup-article-card">
            <h2 className="text-lg font-semibold text-[#333]">
              <a href="/mockup/article" className="text-[#333] hover:text-[#0066a2] hover:underline">
                記事ページ
              </a>
            </h2>
            <p className="text-sm text-[#999] mt-1">
              /mockup/article
            </p>
            <p className="text-[#666] mt-2 text-sm">
              記事/商品一覧のタブ切り替え、関連商品、CTA、サイドバー導線を強化（moodmarkgift を参考）
            </p>
            <p className="text-xs text-[#999] mt-1">
              <a href="/mockup/article#product_list" className="text-[#0066a2] hover:underline">
                商品一覧タブで開く →
              </a>
            </p>
          </div>
        </nav>

        <p className="mt-8 text-sm text-[#999]">
          comprehensive_improvement_proposal の「3.3 マガジンとショップの連携強化」に基づくデザイン
        </p>
      </div>
    </div>
  )
}
