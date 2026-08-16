'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { errorBoxClass, inputClass, mutedClass } from '@/components/ui/styles'

type Session = {
  authenticated: boolean
  userId: string | null
  role: 'admin' | 'editor' | null
}

function roleLabel(role: string | null) {
  return role === 'admin' ? '管理者' : '編集者'
}

export default function AccountPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data: Session) => setSession(data))
      .catch(() => setSession(null))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'パスワードの変更に失敗しました')
        return
      }
      setPassword('')
      setMessage('パスワードを変更しました')
    } catch {
      setError('パスワードの変更に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="grid gap-10">
        <PageHeader title="マイページ" description="ログイン中のアカウントです。" />

        <div className="grid gap-10 md:grid-cols-2">
          <section className="grid gap-3 pt-4 border-t border-line">
            <h2 className="m-0 text-[22px] font-semibold text-ink">アカウント</h2>
            <p className={`m-0 ${mutedClass}`}>
              {session?.userId
                ? `${session.userId}（${roleLabel(session.role)}）`
                : '読み込み中...'}
            </p>
          </section>

          <section className="grid gap-3 pt-4 border-t border-line">
            <h2 className="m-0 text-[22px] font-semibold text-ink">自分のパスワードを変更</h2>
            <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="grid gap-1.5 text-[13px] text-[#333]">
                新しいパスワード
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={saving}
                  className={inputClass}
                />
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? '変更中...' : '変更'}
              </Button>
            </form>
            {error && <p className={`m-0 ${errorBoxClass}`}>{error}</p>}
            {message && <p className="m-0 text-sm text-ink">{message}</p>}
          </section>
        </div>

        {session?.role === 'admin' && (
          <section className="grid gap-3 pt-4 border-t border-line">
            <h2 className="m-0 text-[22px] font-semibold text-ink">管理者メニュー</h2>
            <Link
              href="/users"
              className="grid gap-2 p-4 text-left border border-line hover:border-accent no-underline"
            >
              <span className="text-[15px] font-bold text-accent">ユーザー</span>
              <span className="text-[13px] text-muted">管理者と編集者のアカウント管理です。</span>
            </Link>
          </section>
        )}
      </div>
    </AppLayout>
  )
}
