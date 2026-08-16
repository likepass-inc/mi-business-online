'use client'

import { useEffect, useState } from 'react'
import type { DateRange } from '@/lib/types'
import { getYearOverYearPeriod } from '@/lib/dateUtils'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { linkClass, tableClass, tdClass, thClass } from '@/components/ui/styles'

interface KeywordAnalysisProps {
  dateRange: DateRange
}

interface PageData {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface KeywordData {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevClicks?: number
  prevImpressions?: number
  prevCtr?: number
  prevPosition?: number
  pages?: PageData[]
}

interface KeywordInsight {
  type: 'improvement' | 'ctr' | 'growth'
  keywords: KeywordData[]
}

// 前期間の日付範囲を計算
function getPreviousDateRange(dateRange: DateRange): DateRange {
  const startDate = new Date(dateRange.startDate)
  const endDate = new Date(dateRange.endDate)
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  const prevEndDate = new Date(startDate)
  prevEndDate.setDate(prevEndDate.getDate() - 1)
  
  const prevStartDate = new Date(prevEndDate)
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff)
  
  return {
    startDate: prevStartDate.toISOString().split('T')[0],
    endDate: prevEndDate.toISOString().split('T')[0],
  }
}

type ComparisonMode = 'previous-period' | 'year-over-year'

// 前期間対比を計算
function calculateComparison(current: number, previous: number): { diff: number; percent: number | null } {
  const diff = current - previous
  const percent = previous !== 0 ? ((diff / previous) * 100) : null
  return { diff, percent }
}

// 前期間対比表示コンポーネント
function ComparisonCell({ current, previous, isLowerBetter = false, isPercentage = false, decimalPlaces = 0 }: { current: number; previous?: number; isLowerBetter?: boolean; isPercentage?: boolean; decimalPlaces?: number }) {
  if (previous === undefined) {
    const formatCurrent = () => {
      if (isPercentage) return `${current.toFixed(2)}%`
      if (decimalPlaces > 0) return current.toFixed(decimalPlaces)
      return current.toLocaleString()
    }
    return (
      <div className="text-xs">
        <div className="text-gray-900">{formatCurrent()}</div>
        <div className="text-gray-400">-</div>
      </div>
    )
  }
  
  const { diff, percent } = calculateComparison(current, previous)
  const isPositive = isLowerBetter ? diff < 0 : diff > 0
  const isNegative = isLowerBetter ? diff > 0 : diff < 0
  const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
  const sign = diff > 0 ? '+' : ''
  
  const formatValue = (val: number) => {
    if (isPercentage) return `${val.toFixed(2)}%`
    if (decimalPlaces > 0) return val.toFixed(decimalPlaces)
    return val.toLocaleString()
  }
  const formatDiff = (val: number) => {
    if (isPercentage) return `${sign}${val.toFixed(2)}%`
    if (decimalPlaces > 0) return `${sign}${val.toFixed(decimalPlaces)}`
    return `${sign}${val.toLocaleString()}`
  }
  
  return (
    <div className="text-xs">
      <div className="text-gray-900">{formatValue(current)}</div>
      <div className={colorClass}>
        {formatDiff(diff)} ({percent !== null ? `${sign}${percent.toFixed(1)}%` : '-'})
      </div>
    </div>
  )
}

// 季節性キーワードの定義（月ベース）- 法人向けギフトサービス向け
function getSeasonalKeywords(month: number): string[] {
  const seasonalMap: Record<number, string[]> = {
    1: ['新年', '年始', '初売り', '福袋', 'バーゲン', 'セール', 'お年玉', '新年の挨拶'],
    2: ['バレンタイン', '節分', '冬物', 'セール', 'バレンタインギフト'],
    3: ['春', '卒業', '入学', '桜', '新生活', '送別', '卒業祝い', '入学祝い', '送別ギフト'],
    4: ['新生活', '入学', '春物', '新入社員', '入社祝い', '新入社員歓迎', '入社ギフト'],
    5: ['ゴールデンウィーク', '母の日', '春物', '母の日ギフト', '感謝'],
    6: ['お中元', '父の日', '夏物', '準備', '父の日ギフト', '贈答', '贈答品'],
    7: ['お中元', '夏', '夏休み', '贈答', '贈答品', 'ギフト', '法人ギフト'],
    8: ['お中元', '夏休み', 'お盆', '夏物', 'バーゲン', '贈答', '贈答品'],
    9: ['秋', '敬老の日', '秋物', '準備', '敬老の日ギフト', '感謝'],
    10: ['秋', 'ハロウィン', '秋物', 'コスチューム', '贈答', '贈答品'],
    11: ['お歳暮', 'クリスマス', '冬物', '準備', 'プレゼント', '贈答', '贈答品', '法人ギフト', '企業ギフト'],
    12: ['お歳暮', 'クリスマス', '年末', '大掃除', '年賀状', '冬物', '贈答', '贈答品', '法人ギフト', '企業ギフト', '年末ギフト'],
  }
  return seasonalMap[month] || []
}

export default function KeywordAnalysis({ dateRange }: KeywordAnalysisProps) {
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [insights, setInsights] = useState<KeywordInsight[]>([])
  const [recommendedKeywords, setRecommendedKeywords] = useState<KeywordData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('year-over-year')

  useEffect(() => {
    async function fetchKeywords() {
      try {
        setLoading(true)
        setError(null)

        const prevDateRange = comparisonMode === 'year-over-year'
          ? getYearOverYearPeriod(dateRange.startDate, dateRange.endDate)
          : getPreviousDateRange(dateRange)

        // 現在期間のキーワードデータ取得
        const response = await fetch('/api/gsc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: ['query'],
            rowLimit: 1000,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch keyword data')
        }

        const data = await response.json()
        const currentKeywords: KeywordData[] = (data.rows || [])
          .filter((row: any) => row.query)
          .map((row: any) => ({
            query: row.query || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
          }))
          .sort((a: KeywordData, b: KeywordData) => b.clicks - a.clicks)
          .slice(0, 30)

        // 比較期間（前年同時期または前期間）のキーワードデータ取得
        let prevKeywords: KeywordData[] = []
        try {
          const prevResponse = await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: prevDateRange.startDate,
              endDate: prevDateRange.endDate,
              dimensions: ['query'],
              rowLimit: 1000,
            }),
          })

          if (prevResponse.ok) {
            const prevData = await prevResponse.json()
            prevKeywords = (prevData.rows || [])
              .filter((row: any) => row.query)
              .map((row: any) => ({
                query: row.query || '',
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0,
              }))
          }
        } catch (prevErr) {
          console.error('Comparison period keyword data fetch error:', prevErr)
        }

        // キーワードをマッチングして比較期間データを結合
        const prevKeywordMap = new Map<string, KeywordData>()
        prevKeywords.forEach((k) => {
          prevKeywordMap.set(k.query, k)
        })

        const keywordData: KeywordData[] = currentKeywords.map((current) => {
          const prev = prevKeywordMap.get(current.query)
          return {
            ...current,
            prevClicks: prev?.clicks,
            prevImpressions: prev?.impressions,
            prevCtr: prev?.ctr,
            prevPosition: prev?.position,
          }
        })

        setKeywords(keywordData)

        // 分析とインサイトの生成
        const avgCtr = keywordData.reduce((sum, k) => sum + k.ctr, 0) / keywordData.length
        const avgPosition = keywordData.reduce((sum, k) => sum + k.position, 0) / keywordData.length

        // 改善機会: インプレッションが多いがポジションが低い（10位以下）
        const improvementKeywords = keywordData
          .filter((k) => k.impressions > 100 && k.position > 10)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 5)

        // CTR改善: CTRが低いがインプレッションが多い
        const ctrKeywords = keywordData
          .filter((k) => k.ctr < avgCtr && k.impressions > 100)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 5)

        // 成長ポテンシャル: インプレッションは多いがクリックが少ない
        const growthKeywords = keywordData
          .filter((k) => k.impressions > 200 && k.clicks < 10)
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 5)

        // キーワードとページの組み合わせデータを取得
        const insightKeywords = [...improvementKeywords, ...ctrKeywords, ...growthKeywords]
        const uniqueKeywords = Array.from(new Set(insightKeywords.map(k => k.query)))

        try {
          const pageResponse = await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
              dimensions: ['query', 'page'],
              rowLimit: 5000,
            }),
          })

          if (pageResponse.ok) {
            const pageData = await pageResponse.json()
            const keywordPageMap = new Map<string, PageData[]>()

            // キーワードごとにページデータをグループ化
            pageData.rows?.forEach((row: any) => {
              if (row.query && row.page && uniqueKeywords.includes(row.query)) {
                if (!keywordPageMap.has(row.query)) {
                  keywordPageMap.set(row.query, [])
                }
                keywordPageMap.get(row.query)?.push({
                  page: row.page || '',
                  clicks: row.clicks || 0,
                  impressions: row.impressions || 0,
                  ctr: row.ctr || 0,
                  position: row.position || 0,
                })
              }
            })

            // 各キーワードのページをクリック数順にソート（上位3件まで）
            keywordPageMap.forEach((pages, query) => {
              pages.sort((a, b) => b.clicks - a.clicks)
              keywordPageMap.set(query, pages.slice(0, 3))
            })

            // インサイトキーワードにページデータを追加
            const keywordsWithPages = insightKeywords.map(k => ({
              ...k,
              pages: keywordPageMap.get(k.query) || [],
            }))

            const improvementWithPages = keywordsWithPages
              .filter((k) => k.impressions > 100 && k.position > 10)
              .sort((a, b) => b.impressions - a.impressions)
              .slice(0, 5)

            const ctrWithPages = keywordsWithPages
              .filter((k) => k.ctr < avgCtr && k.impressions > 100)
              .sort((a, b) => b.impressions - a.impressions)
              .slice(0, 5)

            const growthWithPages = keywordsWithPages
              .filter((k) => k.impressions > 200 && k.clicks < 10)
              .sort((a, b) => b.impressions - a.impressions)
              .slice(0, 5)

            setInsights([
              { type: 'improvement', keywords: improvementWithPages },
              { type: 'ctr', keywords: ctrWithPages },
              { type: 'growth', keywords: growthWithPages },
            ])
          } else {
            // ページデータ取得に失敗した場合は、ページなしで設定
            setInsights([
              { type: 'improvement', keywords: improvementKeywords },
              { type: 'ctr', keywords: ctrKeywords },
              { type: 'growth', keywords: growthKeywords },
            ])
          }
        } catch (pageErr) {
          console.error('Page data fetch error:', pageErr)
          // エラー時もページなしで設定
          setInsights([
            { type: 'improvement', keywords: improvementKeywords },
            { type: 'ctr', keywords: ctrKeywords },
            { type: 'growth', keywords: growthKeywords },
          ])
        }

        // 推奨キーワード: 季節性 + パフォーマンス + 法人向けキーワード
        const currentMonth = new Date().getMonth() + 1
        const seasonalKeywords = getSeasonalKeywords(currentMonth)
        const businessKeywords = ['法人', '企業', '贈答', 'ギフト', 'for business', 'ビジネス']
        
        const recommended = keywordData
          .filter((k) => {
            const queryLower = k.query.toLowerCase()
            return seasonalKeywords.some((sk) => queryLower.includes(sk.toLowerCase()))
          })
          .sort((a, b) => {
            const aQueryLower = a.query.toLowerCase()
            const bQueryLower = b.query.toLowerCase()
            
            // 法人向けキーワードを含むものを優先
            const aHasBusiness = businessKeywords.some((bk) => aQueryLower.includes(bk.toLowerCase()))
            const bHasBusiness = businessKeywords.some((bk) => bQueryLower.includes(bk.toLowerCase()))
            
            if (aHasBusiness && !bHasBusiness) return -1
            if (!aHasBusiness && bHasBusiness) return 1
            
            // インプレッションが多い順、次にクリックが多い順
            if (b.impressions !== a.impressions) return b.impressions - a.impressions
            return b.clicks - a.clicks
          })
          .slice(0, 10)

        setRecommendedKeywords(recommended)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchKeywords()
  }, [dateRange, comparisonMode])

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center border-y border-line">
        <p className="m-0 text-muted">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center border-y border-line">
        <p className="m-0 text-danger">エラー: {error}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-8">
      <div className="flex justify-end">
        <SegmentedControl
          ariaLabel="比較対象"
          value={comparisonMode}
          onChange={setComparisonMode}
          options={[
            { value: 'year-over-year', label: '前年同時期対比' },
            { value: 'previous-period', label: '前期間対比' },
          ]}
        />
      </div>
      {/*
      {recommendedKeywords.length > 0 && (
        <div>
          <h3 className="m-0 mb-3 text-[15px] font-semibold text-accent">
            今月の推奨キーワード（季節性 + パフォーマンス）
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recommendedKeywords.map((keyword, index) => (
              <div key={index} className="border-t border-line pt-3">
                <div className="font-semibold text-ink mb-2">{keyword.query}</div>
                <div className="text-sm text-muted space-y-1">
                  <div>クリック: {keyword.clicks.toLocaleString()}</div>
                  <div>インプレッション: {keyword.impressions.toLocaleString()}</div>
                  <div>CTR: {keyword.ctr.toFixed(2)}%</div>
                  <div>ポジション: {keyword.position.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, index) => {
            if (insight.keywords.length === 0) return null

            const titles = {
              improvement: '改善機会（ポジション向上）',
              ctr: 'CTR改善',
              growth: '成長ポテンシャル',
            }

            const descriptions = {
              improvement: 'インプレッションが多いがポジションが低いキーワード',
              ctr: 'CTRが低いがインプレッションが多いキーワード',
              growth: 'インプレッションは多いがクリックが少ないキーワード',
            }

            const shortenUrl = (url: string) => {
              try {
                const urlObj = new URL(url)
                return urlObj.pathname + urlObj.search
              } catch {
                return url
              }
            }

            return (
              <div key={index} className="border-t border-line pt-4">
                <h3 className="m-0 mb-2 text-[15px] font-semibold">{titles[insight.type]}</h3>
                <p className="text-sm text-muted mb-4">{descriptions[insight.type]}</p>
                <div className="space-y-4">
                  {insight.keywords.map((keyword, idx) => (
                    <div key={idx} className="border-l-2 border-accent pl-3">
                      <div className="font-semibold text-ink mb-1">{keyword.query}</div>
                      <div className="text-xs text-muted mb-2">
                        クリック: {keyword.clicks} | インプレ: {keyword.impressions.toLocaleString()} | 
                        ポジション: {keyword.position.toFixed(1)} | CTR: {keyword.ctr.toFixed(2)}%
                      </div>
                      {keyword.pages && keyword.pages.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-medium text-ink">対象ページ:</div>
                          {keyword.pages.map((page, pageIdx) => (
                            <div key={pageIdx} className="text-xs ml-2">
                              <a
                                href={page.page}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={linkClass}
                              >
                                {shortenUrl(page.page)}
                              </a>
                              <span className="text-muted ml-2">
                                (クリック: {page.clicks.toLocaleString()}, インプレ: {page.impressions.toLocaleString()})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      */}

      {/* キーワードテーブル */}
      <div>
        <h3 className="m-0 mb-3 text-[15px] font-semibold">キーワードランキング（上位30件）</h3>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>順位</th>
                <th className={thClass}>キーワード</th>
                <th className={`${thClass} text-right`}>クリック</th>
                <th className={`${thClass} text-right`}>インプレッション</th>
                <th className={`${thClass} text-right`}>CTR</th>
                <th className={`${thClass} text-right`}>ポジション</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((keyword, index) => (
                <tr key={index} className="hover:bg-[#fafafa]">
                  <td className={`${tdClass} whitespace-nowrap`}>{index + 1}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{keyword.query}</td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <ComparisonCell 
                      current={keyword.clicks} 
                      previous={keyword.prevClicks} 
                    />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <ComparisonCell 
                      current={keyword.impressions} 
                      previous={keyword.prevImpressions} 
                    />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <ComparisonCell 
                      current={keyword.ctr} 
                      previous={keyword.prevCtr}
                      isPercentage={true}
                    />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <ComparisonCell 
                      current={keyword.position} 
                      previous={keyword.prevPosition} 
                      isLowerBetter={true}
                      decimalPlaces={1}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

