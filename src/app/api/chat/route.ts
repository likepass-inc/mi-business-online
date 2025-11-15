import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openaiClient'
import { parseQuery } from '@/lib/queryParser'
import { fetchAnalyticsData } from '@/lib/analyticsService'
import type { ChatRequest, ChatResponse } from '@/lib/types'

const systemPrompt = `
あなたはWebマーケティングとSEOの専門アナリストです。
ユーザーは「https://business.mistore.jp/」の担当者です。
これからGA4やGSCの数値データがJSON形式で渡されます。
数値を正確に解釈し、日本語で簡潔かつ具体的に以下を出力してください。

1. 現状の要約（数値と傾向）
2. 気づき・インサイト（増減の背景仮説など）
3. 改善提案（どのページに何を、どのように行うかまで具体的に）

数値は正確に引用し、グラフや表がある場合はそれを参照してください。
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

    // キーワードまたはランディングページに基づいてデータを取得
    let data
    let scrapedData = null

    if (keyword) {
      // キーワード指定時はGSCから該当キーワードのデータを取得
      const gscData = await fetchAnalyticsData({
        source: 'GSC',
        dateRange: parsedQuery.dateRange,
        metrics: ['clicks', 'impressions', 'ctr', 'position'],
        dimensions: ['query', 'page'],
      })
      // キーワードでフィルタリング
      data = {
        rows: gscData.rows.filter((row: any) =>
          row.query?.toLowerCase().includes(keyword.toLowerCase())
        ),
      }
    } else if (landingPage) {
      // ランディングページ指定時は該当ページのデータを取得
      const gscData = await fetchAnalyticsData({
        source: 'GSC',
        dateRange: parsedQuery.dateRange,
        metrics: ['clicks', 'impressions', 'ctr', 'position'],
        dimensions: ['query', 'page'],
      })
      // ページでフィルタリング
      data = {
        rows: gscData.rows.filter((row: any) => row.page === landingPage),
      }

      // ランディングページのスクレイピングを実行
      try {
        const scrapeResponse = await fetch(`${req.nextUrl.origin}/api/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: landingPage, useJavaScript: true }),
        })
        if (scrapeResponse.ok) {
          scrapedData = await scrapeResponse.json()
        }
      } catch (scrapeErr) {
        console.error('Scraping error:', scrapeErr)
        // スクレイピングエラーは無視して続行
      }
    } else {
      // 通常のデータ取得
      data = await fetchAnalyticsData(parsedQuery)
    }

    // システムプロンプトを拡張
    let enhancedSystemPrompt = systemPrompt
    if (keyword) {
      enhancedSystemPrompt += `\n\n重要: ユーザーが指定したキーワード「${keyword}」に特に注力した分析を行ってください。`
    }
    if (landingPage) {
      enhancedSystemPrompt += `\n\n重要: ユーザーが指定したランディングページ「${landingPage}」に特に注力した分析を行ってください。`
    }

    // OpenAIに送信
    let userPrompt = `
ユーザーの質問:
${message}

取得したデータ(JSON):
${JSON.stringify(data, null, 2)}

データソース: ${parsedQuery.source}
期間: ${parsedQuery.dateRange.startDate} 〜 ${parsedQuery.dateRange.endDate}
メトリクス: ${parsedQuery.metrics.join(', ')}
`

    if (scrapedData) {
      userPrompt += `\n\nランディングページのスクレイピング結果:
${JSON.stringify(scrapedData, null, 2)}

このスクレイピング結果を基に、以下の観点でSEO分析を行ってください:
- タイトルタグとメタディスクリプションの最適化（文字数、キーワード含有率、魅力度）
- 見出し構造（H1-H3）の評価と改善提案
- 画像のalt属性の最適化状況
- 内部リンク構造の評価
- 構造化データの有無と最適化提案
- OGタグの設定状況
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

