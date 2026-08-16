'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function LogoutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      setIsLoading(true)
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
        })

        if (response.ok) {
          router.push('/login')
          router.refresh()
        } else {
          alert('ログアウトに失敗しました')
        }
      } catch (error) {
        alert('ログアウトに失敗しました')
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <Button onClick={handleLogout} disabled={isLoading}>
      {isLoading ? 'ログアウト中...' : 'ログアウト'}
    </Button>
  )
}
