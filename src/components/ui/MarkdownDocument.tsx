'use client'

import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownDocumentProps {
  markdown: string
  className?: string
}

type CodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean
  node?: unknown
}

export default function MarkdownDocument({ markdown, className }: MarkdownDocumentProps) {
  return (
    <div className={['prose prose-sm max-w-none text-ink', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h4>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 ml-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 ml-4">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ inline, children, className: codeClassName }: CodeProps) =>
            inline ? (
              <code
                className={`bg-[#f0f0f0] px-1.5 py-0.5 rounded text-sm font-mono ${codeClassName ?? ''}`}
              >
                {children}
              </code>
            ) : (
              <code
                className={`block bg-[#f0f0f0] p-3 rounded text-sm font-mono overflow-x-auto mb-3 ${codeClassName ?? ''}`}
              >
                {children}
              </code>
            ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-line pl-4 italic my-3 text-muted">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-accent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-line text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#f5f5f5]">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-line">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-6 border-line" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
