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

  const handleSend = async (message: string) => {
    // ユーザーメッセージを追加
    const userMessage: Message = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
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
    <div className="bg-white rounded-lg shadow flex flex-col" style={{ height: '500px' }}>
      <MessageList messages={messages} />
      {isLoading && (
        <div className="px-4 pb-2 text-sm text-gray-500">分析中...</div>
      )}
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}

