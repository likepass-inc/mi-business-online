'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
    >
      {isLoading ? 'ログアウト中...' : 'ログアウト'}
    </button>
  )
}

