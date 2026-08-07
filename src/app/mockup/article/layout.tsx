import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '記事ページ（タブ切り替え） - モックアップ',
  description: '記事/商品一覧のタブ切り替え形式モックアップ（moodmarkgift を参考）',
}

export default function ArticleMockupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
