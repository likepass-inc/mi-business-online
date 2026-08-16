'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface MessageListProps {
  messages: Message[]
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="text-center text-muted mt-8">
          メッセージを入力してAIアナリストに質問してください
        </div>
      ) : (
        messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-admin p-4 ${
                message.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-[#f5f5f5] text-ink'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0" {...props} />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4 className="text-base font-semibold mb-2 mt-3 first:mt-0" {...props} />
                      ),
                      h5: ({ node, ...props }) => (
                        <h5 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props} />
                      ),
                      h6: ({ node, ...props }) => (
                        <h6 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="mb-3 last:mb-0" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc list-inside mb-3 space-y-1 ml-4" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal list-inside mb-3 space-y-1 ml-4" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="mb-1" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong className="font-bold" {...props} />
                      ),
                      em: ({ node, ...props }) => (
                        <em className="italic" {...props} />
                      ),
                      code: ({ node, inline, ...props }: any) =>
                        inline ? (
                          <code
                            className="bg-gray-200 px-1.5 py-0.5 rounded text-sm font-mono"
                            {...props}
                          />
                        ) : (
                          <code
                            className="block bg-gray-200 p-3 rounded text-sm font-mono overflow-x-auto mb-3"
                            {...props}
                          />
                        ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className="border-l-4 border-gray-300 pl-4 italic my-3"
                          {...props}
                        />
                      ),
                      a: ({ node, ...props }: any) => (
                        <a
                          className="text-accent hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-3">
                          <table className="min-w-full border border-gray-300" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-gray-200" {...props} />
                      ),
                      tbody: ({ node, ...props }) => (
                        <tbody {...props} />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr className="border-b border-gray-300" {...props} />
                      ),
                      th: ({ node, ...props }) => (
                        <th className="px-4 py-2 text-left font-semibold" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-2" {...props} />
                      ),
                      hr: ({ node, ...props }) => (
                        <hr className="my-4 border-gray-300" {...props} />
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

