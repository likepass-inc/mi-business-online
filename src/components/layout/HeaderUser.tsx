'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

type Session = {
  authenticated: boolean
  userId: string | null
  role: 'admin' | 'editor' | null
}

export default function HeaderUser() {
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data: Session) => {
        if (!cancelled) setSession(data)
      })
      .catch(() => {
        if (!cancelled) setSession(null)
      })
    return () => {
      cancelled = true
    }
  }, [pathname])

  const email = session?.authenticated ? session.userId : null
  const onAccount = pathname === '/account' || pathname === '/users'

  return (
    <div className="flex items-center gap-3 text-[13px] text-muted">
      <details className="relative shrink-0 group">
        <summary className="list-none cursor-pointer select-none whitespace-nowrap text-[13px] text-muted hover:text-ink group-open:text-ink [&::-webkit-details-marker]:hidden after:ml-1 after:text-[10px] after:content-['▾']">
          関連ツール
        </summary>
        <div className="absolute right-0 top-[calc(100%+8px)] z-[60] min-w-[160px] border border-line bg-white py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <a
            href="https://ai-chatbot-mi-business.onrender.com/site-search-admin/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block whitespace-nowrap px-3.5 py-2 text-[13px] text-ink no-underline hover:bg-[#f5f5f5]"
          >
            AIサイト内検索
          </a>
          <a
            href="https://mi-business-magazine-contents-studio.onrender.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block whitespace-nowrap px-3.5 py-2 text-[13px] text-ink no-underline hover:bg-[#f5f5f5]"
          >
            Contents Studio
          </a>
        </div>
      </details>
      {email && (
        <Link
          href="/account"
          className={`text-right whitespace-normal hover:text-accent ${onAccount ? 'text-accent' : 'text-muted'}`}
        >
          {email}
        </Link>
      )}
      <LogoutButton />
    </div>
  )
}
