'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import HeaderUser from './HeaderUser'
import { wrapClass } from '@/components/ui/styles'

const NAV_ITEMS = [
  { href: '/', label: 'ダッシュボード' },
  // { href: '/products', label: '商品動向' },
  { href: '/image-resize', label: '画像リサイズ' },
]

interface AppLayoutProps {
  children: ReactNode
}

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-ink">
      <header className="bg-white border-b border-line">
        <div className={`${wrapClass} grid grid-cols-[1fr_auto] items-center min-h-[72px] gap-4`}>
          <p className="m-0 text-xl font-bold tracking-[0.04em]">
            MI Business Online
            <span className="ml-2.5 inline-block text-[13px] font-normal tracking-normal text-muted">
              Analytics
            </span>
          </p>
          {!isLogin && (
            <HeaderUser />
          )}
        </div>
      </header>

      {!isLogin && (
        <nav className="bg-white border-b border-line">
          <div className={`${wrapClass} flex`}>
            {NAV_ITEMS.map((item, index) => {
              const active = isActivePath(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'relative flex-1 min-w-[5.75rem] px-3 pt-3.5 pb-[11px] text-sm text-center',
                    active ? 'text-accent border-b-[3px] border-accent' : 'text-ink border-b-[3px] border-transparent hover:text-accent',
                  ].join(' ')}
                >
                  {index > 0 && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 font-normal text-[#ccc]"
                    >
                      ｜
                    </span>
                  )}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}

      <main className={`${wrapClass} flex-1 py-8 pb-12`}>{children}</main>

      <footer className="mt-auto border-t border-line bg-white">
        <div className={wrapClass}>
          <p className="m-0 py-6 text-center text-xs text-muted">
            Developed by LIKEPASS Inc.
          </p>
        </div>
      </footer>
    </div>
  )
}
