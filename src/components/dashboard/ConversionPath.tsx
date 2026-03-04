'use client'

import { useEffect, useState } from 'react'
import type { DateRange } from '@/lib/types'

interface ConversionPathProps {
  dateRange: DateRange
}

interface ConversionStep {
  step: string
  users: number
  dropoffRate: number
  conversionRate: number
}

interface ConversionPathData {
  steps: ConversionStep[]
  totalConversions: number
  overallConversionRate: number
}

export default function ConversionPath({ dateRange }: ConversionPathProps) {
  const [pathData, setPathData] = useState<ConversionPathData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchConversionPath() {
      try {
        setLoading(true)
        setError(null)

        // GA4からコンバージョン経路データを取得
        // 実際の実装では、GA4 APIを使用してデータを取得
        // ここではモックデータを使用
        const response = await fetch('/api/ga4/conversion-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateRange,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch conversion path data')
        }

        const data = await response.json()
        setPathData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchConversionPath()
  }, [dateRange])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">コンバージョン経路</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">コンバージョン経路</h2>
        <p className="text-red-600">エラー: {error}</p>
      </div>
    )
  }

  if (!pathData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">コンバージョン経路</h2>
        <p className="text-gray-500">データがありません</p>
      </div>
    )
  }

  const maxUsers = Math.max(...pathData.steps.map(step => step.users))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">コンバージョン経路</h2>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">総コンバージョン数</span>
          <span className="text-lg font-bold">{pathData.totalConversions.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">全体コンバージョン率</span>
          <span className="text-lg font-bold">{pathData.overallConversionRate.toFixed(2)}%</span>
        </div>
      </div>

      <div className="space-y-4">
        {pathData.steps.map((step, index) => {
          const widthPercent = (step.users / maxUsers) * 100
          const isLastStep = index === pathData.steps.length - 1

          return (
            <div key={step.step}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{step.step}</span>
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-600">
                    ユーザー: {step.users.toLocaleString()}
                  </span>
                  {!isLastStep && (
                    <span className="text-red-600">
                      離脱率: {step.dropoffRate.toFixed(2)}%
                    </span>
                  )}
                  {isLastStep && (
                    <span className="text-green-600">
                      コンバージョン率: {step.conversionRate.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-6">
                <div
                  className={`h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isLastStep ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                  }`}
                  style={{ width: `${widthPercent}%` }}
                >
                  {step.users.toLocaleString()}
                </div>
              </div>
              {!isLastStep && (
                <div className="flex justify-center mt-2">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h3 className="text-sm font-bold mb-2">改善提案</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          {pathData.steps
            .filter(step => step.dropoffRate > 50)
            .map(step => (
              <li key={step.step}>
                • {step.step}の離脱率が{step.dropoffRate.toFixed(2)}%と高いため、改善が必要です
              </li>
            ))}
        </ul>
      </div>
    </div>
  )
}
