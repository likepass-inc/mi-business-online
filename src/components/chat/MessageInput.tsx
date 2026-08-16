'use client'

import { useState, FormEvent } from 'react'

interface MessageInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-line p-4">
      <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="質問を入力..."
          disabled={disabled}
          className="w-full px-3 py-2.5 border border-[#ccc] rounded-admin bg-white focus:outline-none focus:border-accent disabled:bg-[#f5f5f5]"
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="px-4 py-2.5 bg-accent text-white rounded-admin hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          送信
        </button>
      </div>
    </form>
  )
}

