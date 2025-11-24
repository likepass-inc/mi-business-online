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

async function generateReport() {
  const startDate = '2024-11-01'
  const endDate = '2024-11-15'
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  
  try {
    console.log(`\n📊 三越伊勢丹法人オンラインサイト レポート`)
    console.log(`期間: ${startDate} 〜 ${endDate}\n`)
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
    
    // レポートAPIを呼び出し
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

    const report: ReportResponse = await response.json()

    // Markdownレポートを生成
    const markdown = generateMarkdownReport(report)
    
    // コンソールに表示
    console.log(markdown)
    
    // ファイルに保存
    const fs = await import('fs/promises')
    const filename = `report-${startDate}-${endDate}.md`
    await fs.writeFile(filename, markdown, 'utf-8')
    console.log(`\n✅ レポートを ${filename} に保存しました\n`)

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

function generateMarkdownReport(report: ReportResponse): string {
  const { period, gsc, ga4 } = report
  
  let md = `# 三越伊勢丹法人オンラインサイト レポート\n\n`
  md += `**期間**: ${period.startDate} 〜 ${period.endDate}\n\n`
  md += `**生成日時**: ${new Date().toLocaleString('ja-JP')}\n\n`
  
  md += `---\n\n`
  
  // GSCセクション
  md += `## 📈 Google Search Console (GSC) データ\n\n`
  md += `### サマリー\n\n`
  md += `| 指標 | 値 |\n`
  md += `|------|-----|\n`
  md += `| 総クリック数 | ${gsc.summary.totalClicks.toLocaleString()} |\n`
  md += `| 総インプレッション数 | ${gsc.summary.totalImpressions.toLocaleString()} |\n`
  md += `| 平均CTR | ${gsc.summary.averageCtr}% |\n`
  md += `| 平均ポジション | ${gsc.summary.averagePosition} |\n\n`
  
  md += `### トップ10検索クエリ\n\n`
  md += `| 順位 | クエリ | クリック | インプレッション | CTR | ポジション |\n`
  md += `|------|--------|----------|------------------|-----|-----------|\n`
  gsc.topQueries.forEach((item, index) => {
    md += `| ${index + 1} | ${item.query} | ${item.clicks.toLocaleString()} | ${item.impressions.toLocaleString()} | ${item.ctr}% | ${item.position} |\n`
  })
  md += `\n`
  
  md += `### トップ10ページ\n\n`
  md += `| 順位 | ページ | クリック | インプレッション | CTR | ポジション |\n`
  md += `|------|--------|----------|------------------|-----|-----------|\n`
  gsc.topPages.forEach((item, index) => {
    md += `| ${index + 1} | ${item.page} | ${item.clicks.toLocaleString()} | ${item.impressions.toLocaleString()} | ${item.ctr}% | ${item.position} |\n`
  })
  md += `\n`
  
  md += `---\n\n`
  
  // GA4セクション
  md += `## 📊 Google Analytics 4 (GA4) データ\n\n`
  md += `### サマリー\n\n`
  md += `| 指標 | 値 |\n`
  md += `|------|-----|\n`
  md += `| セッション数 | ${ga4.summary.sessions.toLocaleString()} |\n`
  md += `| ユーザー数 | ${ga4.summary.users.toLocaleString()} |\n`
  md += `| ページビュー数 | ${ga4.summary.pageViews.toLocaleString()} |\n`
  md += `| トランザクション数 | ${ga4.summary.transactions.toLocaleString()} |\n`
  md += `| 売上 | ¥${ga4.summary.revenue.toLocaleString()} |\n`
  md += `| コンバージョン率 | ${ga4.summary.conversionRate}% |\n\n`
  
  md += `### チャネル別データ\n\n`
  md += `| チャネル | セッション | ユーザー | トランザクション | 売上 |\n`
  md += `|----------|-----------|----------|-----------------|------|\n`
  ga4.byChannel.forEach((item) => {
    md += `| ${item.channel} | ${item.sessions.toLocaleString()} | ${item.users.toLocaleString()} | ${item.transactions.toLocaleString()} | ¥${item.revenue.toLocaleString()} |\n`
  })
  md += `\n`
  
  md += `### デバイス別データ\n\n`
  md += `| デバイス | セッション | ユーザー | トランザクション | 売上 |\n`
  md += `|----------|-----------|----------|-----------------|------|\n`
  ga4.byDevice.forEach((item) => {
    md += `| ${item.device} | ${item.sessions.toLocaleString()} | ${item.users.toLocaleString()} | ${item.transactions.toLocaleString()} | ¥${item.revenue.toLocaleString()} |\n`
  })
  md += `\n`
  
  md += `---\n\n`
  md += `*このレポートは自動生成されました。*\n`
  
  return md
}

generateReport()






