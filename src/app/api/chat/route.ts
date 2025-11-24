import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openaiClient'
import { parseQuery } from '@/lib/queryParser'
import { fetchAnalyticsData } from '@/lib/analyticsService'
import type { ChatRequest, ChatResponse } from '@/lib/types'
import { scrapePage } from '@/lib/scraper'

const systemPrompt = `
あなたはWebマーケティングとSEOの専門アナリストです。ユーザーは「https://business.mistore.jp/」の担当者です。
法人向けギフト・お中元・お歳暮を扱うECサイトのSEO改善を専門としています。

【分析の基本方針】
- データドリブンな分析：数値を正確に引用し、根拠を示す
- 実装可能な提案：具体的な手順、文字数、配置場所まで明記
- 優先順位の明確化：影響度と実装難易度を考慮した優先順位付け
- ベンチマークとの比較：業界標準や競合との比較を含める

【SEOベストプラクティス基準】
- タイトルタグ：30-60文字（推奨：32文字以内でクリック率が高い）、キーワードを前半に配置
- メタディスクリプション：120-160文字、行動喚起（CTA）を含める
- H1タグ：1ページに1つ、キーワードを含める、30-70文字
- H2/H3タグ：階層構造を明確に、キーワードバリエーションを含める
- 画像alt属性：具体的で説明的、キーワードを自然に含める
- 内部リンク：関連性の高いページへ、アンカーテキストにキーワードを含める
- 構造化データ：JSON-LD形式、適切なスキーマタイプ（Article, Product, BreadcrumbList等）
- OGタグ：タイトル・説明・画像を設定、SNSでのシェア最適化

【GSC指標の解釈】
- CTR（クリック率）：1-2%が平均、3%以上が良好、0.5%以下は改善必要
- 平均ポジション：1-3位が理想、4-10位は改善余地あり、11位以下は大幅改善必要
- インプレッション：検索需要の指標、クリック数との比率でCTRを評価
- クリック数：実際のトラフィック、インプレッションに対する比率が重要

【質問の意図理解と柔軟な回答形式】
ユーザーの質問の意図を正確に理解し、質問タイプに応じて最適な形式で回答してください。

質問タイプの例：
- **分析・現状把握**: 「現状は？」「どうなっている？」「数値を教えて」→ データの要約と現状説明を、質問に最も適した形式で（箇条書き、表、段落など）
- **原因調査**: 「なぜ？」「理由は？」「原因は？」→ 原因分析と仮説提示を、論理的な構造で説明
- **改善提案**: 「どうすれば？」「改善方法は？」「対策は？」→ 具体的な改善提案を、優先順位や実装難易度とともに提示（必要に応じてBefore/After形式を使用）
- **比較**: 「比較して」「違いは？」「対比して」→ 比較表や対比形式で明確に提示
- **予測・予測**: 「今後は？」「予測は？」「トレンドは？」→ トレンド分析と予測を、根拠とともに説明
- **簡易質問**: 「数値だけ教えて」「クリック数は？」→ 簡潔な数値回答

【回答形式の柔軟性】
- 質問の意図に応じて最適な形式を選択してください（箇条書き、表、段落、リスト、セクション分けなど）
- データが存在しない場合は、その旨を明記しつつ一般的なアドバイスを提供してください
- スクレイピング結果がある場合は、HTML分析を含めてくださいが、形式は質問の意図に応じて柔軟に選択してください
- 数値データは正確に引用し、文字数は実際の文字列を1文字ずつ数えて正確にカウントしてください（改行、スペース、全角/半角の違いも含める）
- 提案は実装可能なレベルまで具体化してください（必要に応じてBefore/After形式を使用）
- データが取得できなかった場合でも、その旨を明記し、一般的なSEO改善提案を提示してください
`

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json()
    const { message, keyword, landingPage } = body

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // クエリを解析
    const parsedQuery = parseQuery(message)
    console.log(`[Chat API] Parsed query:`, {
      source: parsedQuery.source,
      dateRange: parsedQuery.dateRange,
      metrics: parsedQuery.metrics,
      dimensions: parsedQuery.dimensions,
      keyword,
      landingPage,
    })

    // キーワードまたはランディングページに基づいてデータを取得
    let data: { rows: Record<string, string | number>[] } = { rows: [] }
    let scrapedData = null
    let scrapingError: string | null = null
    let analyticsError: string | null = null

    try {
      if (keyword) {
        // キーワード指定時はGSCから該当キーワードのデータを取得
        console.log(`[Chat API] Fetching GSC data for keyword: ${keyword}`)
        const gscData = await fetchAnalyticsData({
          source: 'GSC',
          dateRange: parsedQuery.dateRange,
          metrics: ['clicks', 'impressions', 'ctr', 'position'],
          dimensions: ['query', 'page'],
        })
        // キーワードでフィルタリング
        const filteredRows = gscData.rows.filter((row: any) =>
          row.query?.toLowerCase().includes(keyword.toLowerCase())
        )
        console.log(`[Chat API] Filtered ${filteredRows.length} rows for keyword "${keyword}" from ${gscData.rows.length} total rows`)
        data = { rows: filteredRows }
        
        if (filteredRows.length === 0) {
          console.warn(`[Chat API] No data found for keyword "${keyword}"`)
          analyticsError = `キーワード「${keyword}」に関するGSCデータが見つかりませんでした。`
        }
      } else if (landingPage) {
        // ランディングページ指定時は該当ページのデータを取得
        console.log(`[Chat API] Fetching GSC data for landing page: ${landingPage}`)
        const gscData = await fetchAnalyticsData({
          source: 'GSC',
          dateRange: parsedQuery.dateRange,
          metrics: ['clicks', 'impressions', 'ctr', 'position'],
          dimensions: ['query', 'page'],
        })
        // ページでフィルタリング（URLの正規化を考慮）
        const normalizedLandingPage = landingPage.replace(/^https?:\/\//, '').replace(/\/$/, '')
        const filteredRows = gscData.rows.filter((row: any) => {
          if (!row.page) return false
          const normalizedRowPage = row.page.replace(/^https?:\/\//, '').replace(/\/$/, '')
          return normalizedRowPage === normalizedLandingPage || row.page === landingPage
        })
        console.log(`[Chat API] Filtered ${filteredRows.length} rows for landing page "${landingPage}" from ${gscData.rows.length} total rows`)
        data = { rows: filteredRows }
        
        if (filteredRows.length === 0) {
          console.warn(`[Chat API] No data found for landing page "${landingPage}"`)
          analyticsError = `ランディングページ「${landingPage}」に関するGSCデータが見つかりませんでした。`
        }

        // ランディングページのスクレイピングを実行（直接呼び出し）
        scrapingError = null
        try {
          console.log(`[Chat API] Attempting to scrape ${landingPage} directly`)
          // タイムアウトを実装するため、Promise.raceを使用
          const scrapePromise = scrapePage(landingPage, true)
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Scraping timeout after 30 seconds')), 30000)
          })
          
          scrapedData = await Promise.race([scrapePromise, timeoutPromise])
          console.log(`[Chat API] Successfully scraped ${landingPage}`)
        } catch (scrapeErr) {
          console.error('[Chat API] Scraping error:', scrapeErr)
          scrapingError = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)
          if (scrapeErr instanceof Error && scrapeErr.cause) {
            console.error('[Chat API] Scraping error cause:', scrapeErr.cause)
          }
          // スクレイピングエラーは記録するが、GSCデータベースの分析は続行
        }
      } else {
        // 通常のデータ取得（GA4またはGSC）
        console.log(`[Chat API] Fetching ${parsedQuery.source} data with query:`, {
          source: parsedQuery.source,
          dateRange: parsedQuery.dateRange,
          metrics: parsedQuery.metrics,
          dimensions: parsedQuery.dimensions,
          filters: parsedQuery.filters,
        })
        data = await fetchAnalyticsData(parsedQuery)
        console.log(`[Chat API] Successfully fetched ${data.rows.length} rows from ${parsedQuery.source}`)
        
        if (data.rows.length === 0) {
          console.warn(`[Chat API] No data returned from ${parsedQuery.source}`)
          analyticsError = `${parsedQuery.source}からデータが取得できませんでした。期間: ${parsedQuery.dateRange.startDate} 〜 ${parsedQuery.dateRange.endDate}`
        } else {
          // データ取得成功時のサマリーをログに記録
          if (parsedQuery.source === 'GSC') {
            const totalClicks = data.rows.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0)
            const totalImpressions = data.rows.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0)
            const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
            const avgPosition = data.rows.reduce((sum: number, row: any) => sum + (row.position || 0), 0) / data.rows.length
            console.log(`[Chat API] GSC data summary:`, {
              totalClicks,
              totalImpressions,
              avgCtr: avgCtr.toFixed(2) + '%',
              avgPosition: avgPosition.toFixed(2),
            })
          } else if (parsedQuery.source === 'GA4') {
            const metricsSummary: Record<string, number> = {}
            parsedQuery.metrics.forEach(metric => {
              const sum = data.rows.reduce((s: number, row: any) => s + (row[metric] || 0), 0)
              metricsSummary[metric] = sum
            })
            console.log(`[Chat API] GA4 data summary:`, metricsSummary)
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Chat API] Analytics data fetch error:`, errorMessage)
      analyticsError = `データ取得エラー: ${errorMessage}`
      // エラーが発生した場合でも空のデータを設定（分析は続行）
      data = { rows: [] }
    }

    // システムプロンプトを拡張
    let enhancedSystemPrompt = systemPrompt
    if (keyword) {
      enhancedSystemPrompt += `\n\n【重要】ユーザーが指定したキーワード「${keyword}」に特に注力した分析を行ってください。
- このキーワードのGSCデータ（クリック数、インプレッション、CTR、ポジション）を詳細に分析
- このキーワードで表示されているページのパフォーマンスを比較
- このキーワードに対する最適化提案を具体的に提示
- キーワードの検索意図を考慮したコンテンツ改善提案を含める`
    }
    if (landingPage) {
      enhancedSystemPrompt += `\n\n【重要】ユーザーが指定したランディングページ「${landingPage}」に特に注力した分析を行ってください。
- このページのGSCデータ（クリック数、インプレッション、CTR、ポジション）を詳細に分析
- このページで獲得しているキーワードのパフォーマンスを評価
- スクレイピング結果とGSCデータを組み合わせた総合的なSEO分析を実施`
    }

    // OpenAIに送信
    let userPrompt = `
ユーザーの質問:
${message}

【質問の意図理解】
上記の質問の意図を分析し、以下の質問タイプのいずれかに該当するか判断してください：
- 分析・現状把握: 現状を知りたい、数値を知りたい
- 原因調査: なぜそうなっているのか理由を知りたい
- 改善提案: どうすれば改善できるか知りたい
- 比較: 複数のものを比較したい
- 予測: 今後どうなるか知りたい
- 簡易質問: シンプルな数値や情報だけ知りたい

質問の意図に応じて、最も適切な形式で回答してください（箇条書き、表、段落、リストなど）。

${analyticsError ? `【注意】データ取得に関する注意:\n${analyticsError}\n\n` : ''}取得したデータ(JSON):
${JSON.stringify(data, null, 2)}

データソース: ${parsedQuery.source}
期間: ${parsedQuery.dateRange.startDate} 〜 ${parsedQuery.dateRange.endDate}
メトリクス: ${parsedQuery.metrics.join(', ')}
データ件数: ${data.rows.length}件

${data.rows.length === 0 ? 'データが0件の場合でも、質問の意図に応じて適切な回答を提供してください。' : ''}
`

    // キーワードまたはランディングページ指定時の追加分析指示
    if (keyword || landingPage) {
      const rows = data.rows || []
      if (rows.length > 0) {
        // データの集計
        const totalClicks = rows.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0)
        const totalImpressions = rows.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0)
        const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
        const avgPosition = rows.reduce((sum: number, row: any) => sum + (row.position || 0), 0) / rows.length
        const topPages = rows
          .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
          .slice(0, 5)
          .map((row: any) => ({
            page: row.page,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          }))

        userPrompt += `\n\n${keyword ? `キーワード「${keyword}」` : `ランディングページ「${landingPage}」`}に関するGSCデータサマリー:
- 総クリック数: ${totalClicks.toLocaleString()}
- 総インプレッション数: ${totalImpressions.toLocaleString()}
- 平均CTR: ${avgCtr.toFixed(2)}% ${avgCtr < 1 ? '(改善必要: 1-2%が平均、3%以上が良好)' : avgCtr < 3 ? '(改善余地あり: 3%以上を目指す)' : '(良好)'}
- 平均ポジション: ${avgPosition.toFixed(2)}位 ${avgPosition <= 3 ? '(理想)' : avgPosition <= 10 ? '(改善余地あり: 1-3位を目指す)' : '(大幅改善必要: 1-10位を目指す)'}
- データ件数: ${rows.length}件

上位5ページのパフォーマンス:
${topPages.map((p: any, i: number) => `${i + 1}. ${p.page || p.query || 'N/A'}
   - クリック: ${p.clicks}, インプレ: ${p.impressions.toLocaleString()}, CTR: ${(p.ctr * 100).toFixed(2)}%, ポジション: ${p.position.toFixed(2)}位`).join('\n')}

上記のデータを質問の意図に応じて適切に活用してください。
`
      } else {
        userPrompt += `\n\n${keyword ? `キーワード「${keyword}」` : `ランディングページ「${landingPage}」`}に関するGSCデータが取得できませんでした（データ件数: 0件）。
期間: ${parsedQuery.dateRange.startDate} 〜 ${parsedQuery.dateRange.endDate}

スクレイピング結果がある場合はHTML分析を行い、質問の意図に応じて適切な回答を提供してください。
`
      }
    }

    // スクレイピング失敗時のメッセージを追加
    if (landingPage && !scrapedData && scrapingError) {
      userPrompt += `\n\nスクレイピング失敗の通知:
ランディングページ「${landingPage}」のスクレイピングに失敗しました。
エラー: ${scrapingError}

スクレイピングが失敗したため、実際のHTML（タイトル、メタディスクリプション、見出し構造など）を確認できませんでした。
GSCデータのみに基づいて、質問の意図に応じた分析を行ってください。
`
    }

    if (scrapedData) {
      // スクレイピング結果の詳細分析を指示
      const titleLength = scrapedData.title?.length || 0
      const metaLength = scrapedData.metaDescription?.length || 0
      const h1Count = scrapedData.h1?.length || 0
      const h2Count = scrapedData.h2?.length || 0
      const h3Count = scrapedData.h3?.length || 0
      const imageCount = scrapedData.images?.length || 0
      const imagesWithAlt = scrapedData.images?.filter((img: { src: string; alt: string }) => img.alt && img.alt.trim()).length || 0
      const internalLinksCount = scrapedData.internalLinks?.length || 0
      const structuredDataCount = scrapedData.structuredData?.length || 0

      userPrompt += `\n\nランディングページのスクレイピング結果:
URL: ${scrapedData.url}

現在の状態:
- タイトルタグ: "${scrapedData.title || '未設定'}" (${titleLength}文字)
- メタディスクリプション: "${scrapedData.metaDescription || '未設定'}" (${metaLength}文字)
- H1タグ: ${h1Count}個 ${h1Count > 0 ? `(${scrapedData.h1?.join(', ')})` : '(未設定)'}
- H2タグ: ${h2Count}個 ${h2Count > 0 ? `(例: ${scrapedData.h2?.slice(0, 3).join(', ')})` : '(未設定)'}
- H3タグ: ${h3Count}個
- 画像: ${imageCount}個（alt属性あり: ${imagesWithAlt}個、alt属性なし: ${imageCount - imagesWithAlt}個）
- 内部リンク: ${internalLinksCount}個
- 構造化データ: ${structuredDataCount}個 ${structuredDataCount > 0 ? `(${scrapedData.structuredData?.map((s: any) => s['@type'] || 'unknown').join(', ')})` : '(未設定)'}
- カノニカルURL: ${scrapedData.hasCanonical ? scrapedData.canonicalUrl || '設定済み' : '未設定'}
- OGタイトル: ${scrapedData.ogTitle || '未設定'}
- OG説明: ${scrapedData.ogDescription || '未設定'}
- OG画像: ${scrapedData.ogImage || '未設定'}

完全なスクレイピングデータ（JSON）:
${JSON.stringify(scrapedData, null, 2)}

上記のスクレイピング結果を質問の意図に応じて適切に分析し、必要な情報を提供してください。
改善提案を行う場合は、必要に応じてBefore/After形式を使用してください。文字数を記載する際は、実際の文字列を1文字ずつ数えて正確にカウントしてください。
`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    })

    const analysis = completion.choices[0]?.message?.content || '分析を生成できませんでした。'

    const response: ChatResponse = {
      analysis,
      rawData: {
        source: parsedQuery.source,
        metrics: parsedQuery.metrics,
        rows: data.rows,
      },
    }

    return NextResponse.json(response)
  } catch (e) {
    console.error('Chat API error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chat request failed' },
      { status: 500 }
    )
  }
}

