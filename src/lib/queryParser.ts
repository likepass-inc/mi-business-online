import type { ParsedQuery } from './types'
import { getDateRange } from './dateUtils'

export function parseQuery(message: string): ParsedQuery {
  const lowerMessage = message.toLowerCase()

  // 期間の抽出
  let days = 30 // デフォルト
  if (lowerMessage.includes('直近7日') || lowerMessage.includes('最近7日')) {
    days = 7
  } else if (lowerMessage.includes('直近30日') || lowerMessage.includes('最近30日')) {
    days = 30
  } else if (lowerMessage.includes('直近90日') || lowerMessage.includes('最近90日')) {
    days = 90
  } else if (lowerMessage.includes('直近14日') || lowerMessage.includes('最近14日')) {
    days = 14
  }

  const dateRange = getDateRange(days)

  // データソースの判定
  let source: 'GA4' | 'GSC' = 'GA4'
  if (
    lowerMessage.includes('検索クエリ') ||
    lowerMessage.includes('検索キーワード') ||
    lowerMessage.includes('検索順位') ||
    lowerMessage.includes('ctr') ||
    lowerMessage.includes('インプレッション') ||
    lowerMessage.includes('クリック数')
  ) {
    source = 'GSC'
  }

  // GA4の場合のメトリクスとフィルタ
  const metrics: string[] = []
  const filters: Array<{ field: string; operator: 'EXACT' | 'CONTAINS' | 'REGEXP' | 'PARTIAL'; value: string }> = []

  if (lowerMessage.includes('セッション') || lowerMessage.includes('session')) {
    metrics.push('sessions')
  }
  if (lowerMessage.includes('cv') || lowerMessage.includes('コンバージョン') || lowerMessage.includes('転換')) {
    metrics.push('conversions')
  }
  if (lowerMessage.includes('cvr') || lowerMessage.includes('転換率')) {
    metrics.push('conversions')
    metrics.push('sessions')
  }
  if (lowerMessage.includes('ユーザー') || lowerMessage.includes('user')) {
    metrics.push('activeUsers')
  }
  if (lowerMessage.includes('ページビュー') || lowerMessage.includes('pv')) {
    metrics.push('screenPageViews')
  }

  // デフォルトのメトリクス
  if (metrics.length === 0) {
    metrics.push('sessions', 'conversions')
  }

  // チャネルフィルタ
  if (lowerMessage.includes('自然検索') || lowerMessage.includes('オーガニック')) {
    filters.push({
      field: 'sessionDefaultChannelGroup',
      operator: 'EXACT',
      value: 'Organic Search',
    })
  }

  // ディメンション
  const dimensions: string[] = []
  if (lowerMessage.includes('推移') || lowerMessage.includes('日別') || lowerMessage.includes('時系列')) {
    dimensions.push('date')
  }

  return {
    source,
    dateRange,
    metrics,
    dimensions: dimensions.length > 0 ? dimensions : undefined,
    filters: filters.length > 0 ? filters : undefined,
  }
}

