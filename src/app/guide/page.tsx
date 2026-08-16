import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import { mutedClass } from '@/components/ui/styles'

const CARDS = [
  {
    title: 'ロール',
    body: [
      '編集者はダッシュボード、画像リサイズ、使い方を使えます。ヘッダーのメールアドレスからマイページを開き、自分のパスワードを変更できます。',
      '管理者はそれに加えて、マイページからユーザーの追加・無効化・ロール変更ができます。セッションは24時間です。古いログインは再ログインが必要です。',
    ],
  },
  {
    title: 'ダッシュボード',
    body: [
      'GA4 と Search Console の KPI、トラフィック推移、キーワード分析、コンテンツ人気を確認します。',
      '期間は直近7日、30日、90日で切り替えられます。',
    ],
  },
  {
    title: '画像リサイズ',
    body: [
      '画像または ZIP をアップロードすると、大（640×533）と小（262×218）の2サイズにリサイズします。',
      '比率は維持され、必要に応じて余白が付きます。',
    ],
  },
  {
    title: 'マイページ',
    body: [
      'ヘッダーのメールアドレスから開きます。自分のパスワードを変更できます。',
      '管理者だけ「ユーザー」へのリンクがあります。',
    ],
  },
  {
    title: 'ユーザー（管理者）',
    body: [
      '管理者と編集者の一覧、追加、ロール変更、無効化ができます。',
      '最後の有効な管理者は無効化・降格できません。',
    ],
  },
]

export default function GuidePage() {
  return (
    <AppLayout>
      <div className="grid gap-10">
        <PageHeader
          title="使い方"
          description="この画面は法人オンラインストアのアクセス解析と画像リサイズを運用するための管理コンソールです。"
        />

        <div className="grid gap-10 md:grid-cols-2">
          {CARDS.map((card) => (
            <section key={card.title} className="grid gap-3 pt-4 border-t border-line">
              <h2 className="m-0 text-[22px] font-semibold text-ink">{card.title}</h2>
              {card.body.map((paragraph) => (
                <p key={paragraph} className={`m-0 ${mutedClass}`}>
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
