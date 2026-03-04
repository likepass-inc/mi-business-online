import { ReactNode } from 'react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-gray-700 hover:text-gray-900 font-medium">
              ダッシュボード
            </Link>
            <Link href="/products" className="text-gray-700 hover:text-gray-900 font-medium">
              商品動向
            </Link>
            <Link href="/image-resize" className="text-gray-700 hover:text-gray-900 font-medium">
              画像リサイズ
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">
      {children}
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
        <div className="container mx-auto px-4 flex justify-between items-center text-sm text-gray-600">
          <div>Developed by LIKEPASS Inc.</div>
          <LogoutButton />
        </div>
      </footer>
    </div>
  )
}

