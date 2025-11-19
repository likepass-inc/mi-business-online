'use client'

import { useState } from 'react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import type { ChatResponse } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [landingPage, setLandingPage] = useState('')

  const handleSend = async (message: string) => {
    // ユーザーメッセージを追加
    const userMessage: Message = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          keyword: keyword.trim() || undefined,
          landingPage: landingPage.trim() || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data: ChatResponse = await response.json()
      const assistantMessage: Message = { role: 'assistant', content: data.analysis }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow flex flex-col" style={{ minHeight: '500px', maxHeight: '800px', height: '600px' }}>
      <div className="border-b p-3 space-y-2 bg-gray-50 flex-shrink-0">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            分析対象キーワード（オプション）
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="例: お中元 法人ギフト"
            disabled={isLoading}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            分析対象ランディングページ（オプション）
          </label>
          <input
            type="text"
            value={landingPage}
            onChange={(e) => setLandingPage(e.target.value)}
            placeholder="例: https://business.mistore.jp/gift/ochugen/"
            disabled={isLoading}
            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
      <MessageList messages={messages} />
      </div>
      {isLoading && (
        <div className="px-4 py-2 text-sm text-gray-500 flex-shrink-0">分析中...</div>
      )}
      <div className="flex-shrink-0">
      <MessageInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  )
}

