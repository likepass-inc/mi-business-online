/**
 * 三越伊勢丹法人オンラインサイト レポート生成スクリプト
 * 
 * 使用方法:
 * 1. 環境変数を設定 (.env.local または環境変数)
 * 2. 開発サーバーを起動: npm run dev
 * 3. 別のターミナルで実行: npx tsx generate-report.ts
 */

interface ReportResponse {
  period: {
    startDate: string
    endDate: string
  }
  gsc: {
    summary: {
      totalClicks: number
      totalImpressions: number
      averageCtr: number
      averagePosition: number
    }
    topQueries: Array<{
      query: string
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
    allQueries?: Array<{
      query: string
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
    topPages: Array<{
      page: string
      clicks: number
      impressions: number
      ctr: number
      position: number
    }>
  }
  ga4: {
    summary: {
      sessions: number
      users: number
      pageViews: number
      transactions: number
      revenue: number
      conversionRate: number
    }
    byChannel: Array<{
      channel: string
      sessions: number
      users: number
      transactions: number
      revenue: number
    }>
    byDevice: Array<{
      device: string
      sessions: number
      users: number
      transactions: number
      revenue: number
    }>
  }
}

// お中元関連キーワードをフィルタリングする関数
function filterOchuugenQueries(queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>) {
  return queries.filter(item => 
    item.query.includes('お中元') || 
    item.query.includes('おちゅうげん') ||
    item.query.includes('中元') ||
    item.query.includes('ちゅうげん')
  )
}

// お中元関連ページをフィルタリングする関数
function filterOchuugenPages(pages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>) {
  return pages.filter(item => 
    item.page.includes('ochugen') || 
    item.page.includes('お中元') ||
    item.page.includes('おちゅうげん')
  )
}

// お歳暮関連キーワードをフィルタリングする関数（後方互換性のため残す）
function filterOseiboQueries(queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>) {
  return queries.filter(item => 
    item.query.includes('お歳暮') || 
    item.query.includes('おせいぼ') ||
    item.query.includes('歳暮') ||
    item.query.includes('せいぼ')
  )
}

// お歳暮関連ページをフィルタリングする関数（後方互換性のため残す）
function filterOseiboPages(pages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>) {
  return pages.filter(item => 
    item.page.includes('oseibo') || 
    item.page.includes('お歳暮') ||
    item.page.includes('おせいぼ')
  )
}

async function fetchReport(baseUrl: string, cookies: string | null, startDate: string, endDate: string): Promise<ReportResponse> {
  const response = await fetch(`${baseUrl}/api/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: JSON.stringify({
      startDate,
      endDate,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'API request failed')
  }

  return await response.json()
}

async function generateReport() {
  // お中元レポート用の期間設定
  const currentStartDate = '2025-06-01'
  const currentEndDate = '2025-07-31'
  const previousStartDate = '2024-06-01'
  const previousEndDate = '2024-07-31'
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  
  try {
    console.log(`\n📊 三越伊勢丹法人オンラインサイト レポート`)
    console.log(`期間: ${currentStartDate} 〜 ${currentEndDate}`)
    console.log(`比較期間: ${previousStartDate} 〜 ${previousEndDate}\n`)
    console.log('データを取得中...\n')
    
    // まずログイン
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'tk',
        password: 'nakamura',
      }),
    })

    if (!loginResponse.ok) {
      throw new Error('ログインに失敗しました')
    }

    // Cookieを取得
    const cookies = loginResponse.headers.get('set-cookie')
    
    // 現在期間と前年期間のデータを並行取得
    console.log('現在期間のデータを取得中...')
    const currentReport = await fetchReport(baseUrl, cookies, currentStartDate, currentEndDate)
    
    console.log('前年期間のデータを取得中...')
    const previousReport = await fetchReport(baseUrl, cookies, previousStartDate, previousEndDate)

    // Markdownレポートを生成
    const markdown = generateComparisonReport(currentReport, previousReport)
    
    // コンソールに表示
    console.log(markdown)
    
    // ファイルに保存
    const fs = await import('fs/promises')
    const filename = `report-${currentStartDate}-${currentEndDate}-comparison.md`
    await fs.writeFile(filename, markdown, 'utf-8')
    console.log(`\n✅ レポートを ${filename} に保存しました\n`)
    
    // JSONデータも保存（分析用）
    const jsonFilename = `report-${currentStartDate}-${currentEndDate}-comparison.json`
    await fs.writeFile(jsonFilename, JSON.stringify({ current, previous }, null, 2), 'utf-8')
    console.log(`✅ JSONデータを ${jsonFilename} に保存しました\n`)

  } catch (error) {
    console.error('❌ エラー:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.message.includes('GOOGLE_CLIENT_EMAIL')) {
      console.error('\n⚠️  環境変数が設定されていません。以下の環境変数を設定してください:')
      console.error('  - GOOGLE_CLIENT_EMAIL')
      console.error('  - GOOGLE_PRIVATE_KEY')
      console.error('  - GSC_SITE_URL')
      console.error('  - GA4_PROPERTY_ID')
    }
    process.exit(1)
  }
}

function calculateChange(current: number, previous: number): { value: number; percent: number } {
  const change = current - previous
  const percent = previous > 0 ? (change / previous) * 100 : 0
  return { value: change, percent }
}

function formatChange(change: { value: number; percent: number }): string {
  const sign = change.value >= 0 ? '+' : ''
  return `${sign}${change.value.toLocaleString()} (${sign}${change.percent.toFixed(1)}%)`
}

function generateComparisonReport(current: ReportResponse, previous: ReportResponse): string {
  const { period: currentPeriod, gsc: currentGsc, ga4: currentGa4 } = current
  const { period: previousPeriod, gsc: previousGsc, ga4: previousGa4 } = previous
  
  // 期間に応じてタイトルとフィルター関数を決定
  const isOchuugen = currentPeriod.startDate.includes('-06-') || currentPeriod.startDate.includes('-07-')
  const reportTitle = isOchuugen ? 'お中元比較' : '11月比較'
  const filterQueries = isOchuugen ? filterOchuugenQueries : filterOseiboQueries
  const keywordLabel = isOchuugen ? 'お中元' : 'お歳暮'
  const currentYear = currentPeriod.startDate.substring(0, 4)
  const previousYear = previousPeriod.startDate.substring(0, 4)
  
  let md = `# 三越伊勢丹法人オンラインサイト レポート（${reportTitle}）\n\n`
  md += `**現在期間**: ${currentPeriod.startDate} 〜 ${currentPeriod.endDate}\n`
  md += `**比較期間**: ${previousPeriod.startDate} 〜 ${previousPeriod.endDate}\n`
  md += `**生成日時**: ${new Date().toLocaleString('ja-JP')}\n\n`
  
  md += `---\n\n`
  
  // お中元/お歳暮関連キーワードの抽出
  const currentQueries = currentGsc.allQueries || currentGsc.topQueries
  const previousQueries = previousGsc.allQueries || previousGsc.topQueries
  const currentTargetQueries = filterQueries(currentQueries)
  const previousTargetQueries = filterQueries(previousQueries)
  
  // お中元/お歳暮関連のサマリー計算
  const currentTargetClicks = currentTargetQueries.reduce((sum, q) => sum + q.clicks, 0)
  const currentTargetImpressions = currentTargetQueries.reduce((sum, q) => sum + q.impressions, 0)
  const previousTargetClicks = previousTargetQueries.reduce((sum, q) => sum + q.clicks, 0)
  const previousTargetImpressions = previousTargetQueries.reduce((sum, q) => sum + q.impressions, 0)
  
  // お中元/お歳暮関連キーワードセクション
  md += `## 🎁 ${keywordLabel}関連キーワード分析\n\n`
  md += `### サマリー\n\n`
  
  md += `| 指標 | ${currentYear}年 | ${previousYear}年 | 変化 |\n`
  md += `|------|--------|--------|------|\n`
  
  const targetClicksChange = calculateChange(currentTargetClicks, previousTargetClicks)
  const targetImpressionsChange = calculateChange(currentTargetImpressions, previousTargetImpressions)
  
  md += `| ${keywordLabel}関連クリック数 | ${currentTargetClicks.toLocaleString()} | ${previousTargetClicks.toLocaleString()} | ${formatChange(targetClicksChange)} |\n`
  md += `| ${keywordLabel}関連インプレッション数 | ${currentTargetImpressions.toLocaleString()} | ${previousTargetImpressions.toLocaleString()} | ${formatChange(targetImpressionsChange)} |\n`
  md += `\n`
  
  md += `### ${currentYear}年 ${keywordLabel}関連トップキーワード\n\n`
  md += `| 順位 | クエリ | クリック | インプレッション | CTR | ポジション |\n`
  md += `|------|--------|----------|------------------|-----|-----------|\n`
  currentTargetQueries.slice(0, 20).forEach((item, index) => {
    md += `| ${index + 1} | ${item.query} | ${item.clicks.toLocaleString()} | ${item.impressions.toLocaleString()} | ${item.ctr.toFixed(2)}% | ${item.position.toFixed(1)} |\n`
  })
  md += `\n`
  
  if (previousTargetQueries.length > 0) {
    md += `### ${previousYear}年 ${keywordLabel}関連トップキーワード\n\n`
    md += `| 順位 | クエリ | クリック | インプレッション | CTR | ポジション |\n`
    md += `|------|--------|----------|------------------|-----|-----------|\n`
    previousTargetQueries.slice(0, 20).forEach((item, index) => {
      md += `| ${index + 1} | ${item.query} | ${item.clicks.toLocaleString()} | ${item.impressions.toLocaleString()} | ${item.ctr.toFixed(2)}% | ${item.position.toFixed(1)} |\n`
    })
    md += `\n`
  }
  
  md += `---\n\n`
  
  // GSCセクション（全体）
  md += `## 📈 Google Search Console (GSC) データ（全体）\n\n`
  md += `### サマリー比較\n\n`
  md += `| 指標 | ${currentYear}年 | ${previousYear}年 | 変化 |\n`
  md += `|------|--------|--------|------|\n`
  
  const clicksChange = calculateChange(currentGsc.summary.totalClicks, previousGsc.summary.totalClicks)
  const impressionsChange = calculateChange(currentGsc.summary.totalImpressions, previousGsc.summary.totalImpressions)
  const ctrChange = calculateChange(currentGsc.summary.averageCtr, previousGsc.summary.averageCtr)
  const positionChange = calculateChange(currentGsc.summary.averagePosition, previousGsc.summary.averagePosition)
  
  md += `| 総クリック数 | ${currentGsc.summary.totalClicks.toLocaleString()} | ${previousGsc.summary.totalClicks.toLocaleString()} | ${formatChange(clicksChange)} |\n`
  md += `| 総インプレッション数 | ${currentGsc.summary.totalImpressions.toLocaleString()} | ${previousGsc.summary.totalImpressions.toLocaleString()} | ${formatChange(impressionsChange)} |\n`
  md += `| 平均CTR | ${currentGsc.summary.averageCtr.toFixed(2)}% | ${previousGsc.summary.averageCtr.toFixed(2)}% | ${formatChange(ctrChange)} |\n`
  md += `| 平均ポジション | ${currentGsc.summary.averagePosition.toFixed(2)} | ${previousGsc.summary.averagePosition.toFixed(2)} | ${formatChange(positionChange)} |\n\n`
  
  md += `### ${currentYear}年 トップ10検索クエリ\n\n`
  md += `| 順位 | クエリ | クリック | インプレッション | CTR | ポジション |\n`
  md += `|------|--------|----------|------------------|-----|-----------|\n`
  currentGsc.topQueries.forEach((item, index) => {
    md += `| ${index + 1} | ${item.query} | ${item.clicks.toLocaleString()} | ${item.impressions.toLocaleString()} | ${item.ctr.toFixed(2)}% | ${item.position.toFixed(1)} |\n`
  })
  md += `\n`
  
  md += `---\n\n`
  
  // GA4セクション
  md += `## 📊 Google Analytics 4 (GA4) データ\n\n`
  md += `### サマリー比較\n\n`
  md += `| 指標 | ${currentYear}年 | ${previousYear}年 | 変化 |\n`
  md += `|------|--------|--------|------|\n`
  
  const sessionsChange = calculateChange(currentGa4.summary.sessions, previousGa4.summary.sessions)
  const usersChange = calculateChange(currentGa4.summary.users, previousGa4.summary.users)
  const pageViewsChange = calculateChange(currentGa4.summary.pageViews, previousGa4.summary.pageViews)
  const transactionsChange = calculateChange(currentGa4.summary.transactions, previousGa4.summary.transactions)
  const revenueChange = calculateChange(currentGa4.summary.revenue, previousGa4.summary.revenue)
  const conversionRateChange = calculateChange(currentGa4.summary.conversionRate, previousGa4.summary.conversionRate)
  
  md += `| セッション数 | ${currentGa4.summary.sessions.toLocaleString()} | ${previousGa4.summary.sessions.toLocaleString()} | ${formatChange(sessionsChange)} |\n`
  md += `| ユーザー数 | ${currentGa4.summary.users.toLocaleString()} | ${previousGa4.summary.users.toLocaleString()} | ${formatChange(usersChange)} |\n`
  md += `| ページビュー数 | ${currentGa4.summary.pageViews.toLocaleString()} | ${previousGa4.summary.pageViews.toLocaleString()} | ${formatChange(pageViewsChange)} |\n`
  md += `| トランザクション数 | ${currentGa4.summary.transactions.toLocaleString()} | ${previousGa4.summary.transactions.toLocaleString()} | ${formatChange(transactionsChange)} |\n`
  md += `| 売上 | ¥${currentGa4.summary.revenue.toLocaleString()} | ¥${previousGa4.summary.revenue.toLocaleString()} | ${formatChange(revenueChange)} |\n`
  md += `| コンバージョン率 | ${currentGa4.summary.conversionRate.toFixed(2)}% | ${previousGa4.summary.conversionRate.toFixed(2)}% | ${formatChange(conversionRateChange)} |\n\n`
  
  md += `### ${currentYear}年 チャネル別データ\n\n`
  md += `| チャネル | セッション | ユーザー | トランザクション | 売上 |\n`
  md += `|----------|-----------|----------|-----------------|------|\n`
  currentGa4.byChannel.forEach((item) => {
    md += `| ${item.channel} | ${item.sessions.toLocaleString()} | ${item.users.toLocaleString()} | ${item.transactions.toLocaleString()} | ¥${item.revenue.toLocaleString()} |\n`
  })
  md += `\n`
  
  md += `### ${currentYear}年 デバイス別データ\n\n`
  md += `| デバイス | セッション | ユーザー | トランザクション | 売上 |\n`
  md += `|----------|-----------|----------|-----------------|------|\n`
  currentGa4.byDevice.forEach((item) => {
    md += `| ${item.device} | ${item.sessions.toLocaleString()} | ${item.users.toLocaleString()} | ${item.transactions.toLocaleString()} | ¥${item.revenue.toLocaleString()} |\n`
  })
  md += `\n`
  
  md += `---\n\n`
  md += `*このレポートは自動生成されました。*\n`
  
  return md
}

generateReport()








