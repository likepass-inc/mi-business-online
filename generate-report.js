async function generateReport() {
  const startDate = '2024-11-01'
  const endDate = '2024-11-15'
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  
  try {
    console.log(`\n📊 三越伊勢丹法人オンラインサイト レポート`)
    console.log(`期間: ${startDate} 〜 ${endDate}\n`)
    console.log('データを取得中...\n')
    
    const response = await fetch(`${baseUrl}/api/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    const report = await response.json()

    // レポートの表示
    console.log('='.repeat(80))
    console.log('📈 Google Search Console (GSC) データ')
    console.log('='.repeat(80))
    console.log(`総クリック数: ${report.gsc.summary.totalClicks.toLocaleString()}`)
    console.log(`総インプレッション数: ${report.gsc.summary.totalImpressions.toLocaleString()}`)
    console.log(`平均CTR: ${report.gsc.summary.averageCtr}%`)
    console.log(`平均ポジション: ${report.gsc.summary.averagePosition}`)
    
    console.log('\n🔍 トップ10検索クエリ:')
    report.gsc.topQueries.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.query}`)
      console.log(`     クリック: ${item.clicks.toLocaleString()}, インプレッション: ${item.impressions.toLocaleString()}, CTR: ${item.ctr}%, ポジション: ${item.position}`)
    })

    console.log('\n📄 トップ10ページ:')
    report.gsc.topPages.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.page}`)
      console.log(`     クリック: ${item.clicks.toLocaleString()}, インプレッション: ${item.impressions.toLocaleString()}, CTR: ${item.ctr}%, ポジション: ${item.position}`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('📊 Google Analytics 4 (GA4) データ')
    console.log('='.repeat(80))
    console.log(`セッション数: ${report.ga4.summary.sessions.toLocaleString()}`)
    console.log(`ユーザー数: ${report.ga4.summary.users.toLocaleString()}`)
    console.log(`ページビュー数: ${report.ga4.summary.pageViews.toLocaleString()}`)
    console.log(`トランザクション数: ${report.ga4.summary.transactions.toLocaleString()}`)
    console.log(`売上: ¥${report.ga4.summary.revenue.toLocaleString()}`)
    console.log(`コンバージョン率: ${report.ga4.summary.conversionRate}%`)

    console.log('\n📱 チャネル別データ:')
    report.ga4.byChannel.forEach((item) => {
      console.log(`  ${item.channel}:`)
      console.log(`    セッション: ${item.sessions.toLocaleString()}, ユーザー: ${item.users.toLocaleString()}`)
      console.log(`    トランザクション: ${item.transactions.toLocaleString()}, 売上: ¥${item.revenue.toLocaleString()}`)
    })

    console.log('\n💻 デバイス別データ:')
    report.ga4.byDevice.forEach((item) => {
      console.log(`  ${item.device}:`)
      console.log(`    セッション: ${item.sessions.toLocaleString()}, ユーザー: ${item.users.toLocaleString()}`)
      console.log(`    トランザクション: ${item.transactions.toLocaleString()}, 売上: ¥${item.revenue.toLocaleString()}`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('✅ レポート生成完了')
    console.log('='.repeat(80) + '\n')

  } catch (error) {
    console.error('❌ エラー:', error.message)
    process.exit(1)
  }
}

generateReport()

