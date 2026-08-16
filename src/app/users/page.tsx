'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import {
  errorBoxClass,
  inputClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
} from '@/components/ui/styles'

type AdminRole = 'admin' | 'editor'

type AdminUser = {
  email: string
  role: AdminRole
  is_active: boolean
  created_at: string
  last_seen_at?: string | null
  sessions_7d?: number
  last_action_label?: string | null
}

function formatSessionAt(value?: string | null) {
  if (!value) return '未利用'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function UsersPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AdminRole>('editor')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    const response = await fetch('/api/users')
    if (response.status === 403) {
      router.replace('/')
      return false
    }
    if (response.status === 401) {
      router.replace('/login')
      return false
    }
    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'ユーザー一覧の取得に失敗しました')
      return false
    }
    setUsers(data.rows || [])
    return true
  }, [router])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()
      if (cancelled) return
      if (!session.authenticated) {
        router.replace('/login')
        return
      }
      if (session.role !== 'admin') {
        router.replace('/')
        return
      }
      const ok = await loadUsers()
      if (!cancelled && ok) setReady(true)
    })().catch(() => {
      if (!cancelled) router.replace('/')
    })
    return () => {
      cancelled = true
    }
  }, [loadUsers, router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'ユーザーの追加に失敗しました')
        return
      }
      setEmail('')
      setPassword('')
      setRole('editor')
      await loadUsers()
    } catch {
      setError('ユーザーの追加に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const patchUser = async (targetEmail: string, body: { role?: AdminRole; is_active?: boolean }) => {
    setError('')
    setUpdating(targetEmail)
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(targetEmail)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'ユーザーの更新に失敗しました')
        return
      }
      await loadUsers()
    } catch {
      setError('ユーザーの更新に失敗しました')
    } finally {
      setUpdating(null)
    }
  }

  if (!ready) {
    return (
      <AppLayout>
        <p className="m-0 text-muted">読み込み中...</p>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="grid gap-10">
        <PageHeader
          title="ユーザー"
          description="管理者と編集者のアカウントを管理します。最終セッションと直近の操作で利用状況が分かります。"
        />

        <section className="grid gap-3 pt-4 border-t border-line">
          <h2 className="m-0 text-[22px] font-semibold text-ink">ユーザー一覧</h2>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>メール</th>
                  <th className={thClass}>ロール</th>
                  <th className={thClass}>状態</th>
                  <th className={thClass}>最終セッション</th>
                  <th className={thClass}>7日セッション</th>
                  <th className={thClass}>直近の操作</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email}>
                    <td className={tdClass}>{user.email}</td>
                    <td className={tdClass}>
                      <select
                        className={selectClass}
                        value={user.role}
                        disabled={updating === user.email}
                        onChange={(e) => patchUser(user.email, { role: e.target.value as AdminRole })}
                      >
                        <option value="editor">編集者</option>
                        <option value="admin">管理者</option>
                      </select>
                    </td>
                    <td className={tdClass}>{user.is_active ? '有効' : '無効'}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatSessionAt(user.last_seen_at)}</td>
                    <td className={tdClass}>{user.sessions_7d ?? 0}</td>
                    <td className={tdClass}>{user.last_action_label || '-'}</td>
                    <td className={tdClass}>
                      <Button
                        variant="secondary"
                        disabled={updating === user.email}
                        onClick={() => patchUser(user.email, { is_active: !user.is_active })}
                      >
                        {user.is_active ? '無効化' : '有効化'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-3 pt-4 border-t border-line max-w-xl">
          <h2 className="m-0 text-[22px] font-semibold text-ink">ユーザーを追加</h2>
          <form onSubmit={handleCreate} className="grid gap-3">
            <label className="grid gap-1.5 text-[13px] text-[#333]">
              メールアドレス
              <input
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={saving}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1.5 text-[13px] text-[#333]">
              パスワード
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
            <label className="grid gap-1.5 text-[13px] text-[#333]">
              ロール
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
                disabled={saving}
                className={selectClass}
              >
                <option value="editor">編集者</option>
                <option value="admin">管理者</option>
              </select>
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? '追加中...' : '追加'}
            </Button>
          </form>
          {error && <p className={`m-0 ${errorBoxClass}`}>{error}</p>}
        </section>
      </div>
    </AppLayout>
  )
}
