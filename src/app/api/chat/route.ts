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
    const { message } = body

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

    // クエリを解析
    const parsedQuery = parseQuery(message)

    // データを取得
    const data = await fetchAnalyticsData(parsedQuery)

    // OpenAIに送信
    const userPrompt = `
ユーザーの質問:
${message}

取得したデータ(JSON):
${JSON.stringify(data, null, 2)}

データソース: ${parsedQuery.source}
期間: ${parsedQuery.dateRange.startDate} 〜 ${parsedQuery.dateRange.endDate}
メトリクス: ${parsedQuery.metrics.join(', ')}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
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

