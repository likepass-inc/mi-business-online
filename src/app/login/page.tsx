'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import { inputClass } from '@/components/ui/styles'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password }),
      })

      const data = await response.json()

      if (response.ok) {
        const redirect = searchParams.get('redirect')
        router.push(redirect || '/')
        router.refresh()
      } else {
        setError(data.error || 'ログインに失敗しました')
      }
    } catch (err) {
      setError('ログインに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <label htmlFor="id" className="grid gap-1.5 text-[13px] text-[#333]">
        ID
        <input
          id="id"
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
          disabled={isLoading}
          className={inputClass}
          placeholder="IDを入力"
        />
      </label>
      <label htmlFor="password" className="grid gap-1.5 text-[13px] text-[#333]">
        パスワード
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          className={inputClass}
          placeholder="パスワードを入力"
        />
      </label>
      {error && <p className="m-0 text-danger text-sm">{error}</p>}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'ログイン中...' : 'ログイン'}
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <AppLayout>
      <div className="grid content-start gap-3 w-[min(400px,100%)] pt-8">
        <h1 className="m-0 text-[22px] font-semibold text-ink">ログイン</h1>
        <p className="m-0 text-muted">管理画面にログインしてください。</p>
        <Suspense fallback={<p className="m-0 text-muted">読み込み中...</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </AppLayout>
  )
}
