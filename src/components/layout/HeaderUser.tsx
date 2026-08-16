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
