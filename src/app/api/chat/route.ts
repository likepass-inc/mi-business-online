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

【出力フォーマット】
以下の3セクションで構成し、各セクションは具体的で実装可能な内容にしてください：

1. 現状の要約（数値と傾向）
   - 【重要】GSCデータがある場合、必ず最初に「GSCデータ分析」サブセクションを追加し、総クリック数、総インプレッション数、平均CTR、平均ポジションを明記してください
   - 主要指標の数値を正確に記載
   - 前期間との比較（増減率）
   - 業界平均や競合との比較（可能な場合）
   - 数値の意味することを簡潔に説明
   - 【重要】スクレイピング結果がある場合、必ず「HTML分析（コンテンツSEO）」のサブセクションを追加してください：
     * 現在のタイトルタグの内容と文字数、基準との比較
     * 現在のメタディスクリプションの内容と文字数、基準との比較
     * 見出し構造（H1/H2/H3）の評価：数、内容、キーワード含有状況
     * 画像alt属性の設定状況（設定率、内容の質）
     * 内部リンクの状況（数、関連性、アンカーテキスト）
     * 構造化データの有無と種類
     * OGタグの設定状況
     * その他の技術的SEO要素（カノニカルURL等）

2. 気づき・インサイト（増減の背景仮説など）
   - 数値から読み取れる課題や機会
   - なぜその数値になっているかの仮説（複数提示）
   - スクレイピング結果がある場合、技術的な問題点の指摘
   - 競合分析や市場トレンドとの関連性

3. 改善提案（実装可能な具体的アクション）
   - 各提案に「優先度（高/中/低）」「期待効果」「実装難易度」を明記
   - 具体的な文字数、配置場所、修正内容を記載
   - 【重要】スクレイピング結果がある場合、各提案に必ずBefore/After形式で現在の状態と改善案を明示してください：
     * Before: 現在のHTML要素の状態（タイトル、メタディスクリプション、見出しなど）を具体的に記載
     * After: 改善後のHTML要素の状態を具体的に記載（文字数も含める）
     * 変更理由：なぜその変更が必要かの説明
   - 実装手順をステップバイステップで説明
   - 測定方法（改善後のKPI）を明記

【重要】
- 【必須】GSC/GA4データがある場合、必ず「現状の要約」セクションの最初に数値データ（クリック数、インプレッション数、CTR、ポジションなど）を含めてください
- データが0件の場合でも、一般的なSEO改善提案を提示してください
- スクレイピング結果がある場合、必ずそれを詳細に分析し、具体的な改善点を指摘してください
- タイトルやメタディスクリプションの文字数を正確にカウントし、基準と比較してください
- 見出し構造、画像alt属性、内部リンクなど、技術的なSEO要素を漏れなく評価してください
- 提案は必ず実装可能なレベルまで具体化してください（「タイトルを改善する」ではなく「タイトルを『[キーワード]の選び方｜法人ギフト専門サイト』（32文字）に変更する」など）
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

    // キーワードまたはランディングページに基づいてデータを取得
    let data
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
        // 通常のデータ取得
        console.log(`[Chat API] Fetching ${parsedQuery.source} data`)
        data = await fetchAnalyticsData(parsedQuery)
        console.log(`[Chat API] Fetched ${data.rows.length} rows from ${parsedQuery.source}`)
        
        if (data.rows.length === 0) {
          console.warn(`[Chat API] No data returned from ${parsedQuery.source}`)
          analyticsError = `${parsedQuery.source}からデータが取得できませんでした。`
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

${analyticsError ? `【重要】データ取得に関する注意:\n${analyticsError}\n\n` : ''}取得したデータ(JSON):
${JSON.stringify(data, null, 2)}

データソース: ${parsedQuery.source}
期間: ${parsedQuery.dateRange.startDate} 〜 ${parsedQuery.dateRange.endDate}
メトリクス: ${parsedQuery.metrics.join(', ')}
データ件数: ${data.rows.length}件

${data.rows.length === 0 ? '【重要】データが0件の場合でも、一般的なSEO改善提案を提示してください。' : ''}
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

        userPrompt += `\n\n【重要】GSCデータ分析（必ず「現状の要約」セクションに含めてください）:
${keyword ? `キーワード「${keyword}」` : `ランディングページ「${landingPage}」`}に関するデータサマリー:
- 総クリック数: ${totalClicks.toLocaleString()}
- 総インプレッション数: ${totalImpressions.toLocaleString()}
- 平均CTR: ${avgCtr.toFixed(2)}% ${avgCtr < 1 ? '(改善必要: 1-2%が平均、3%以上が良好)' : avgCtr < 3 ? '(改善余地あり: 3%以上を目指す)' : '(良好)'}
- 平均ポジション: ${avgPosition.toFixed(2)}位 ${avgPosition <= 3 ? '(理想)' : avgPosition <= 10 ? '(改善余地あり: 1-3位を目指す)' : '(大幅改善必要: 1-10位を目指す)'}
- データ件数: ${rows.length}件

上位5ページのパフォーマンス:
${topPages.map((p: any, i: number) => `${i + 1}. ${p.page || p.query || 'N/A'}
   - クリック: ${p.clicks}, インプレ: ${p.impressions.toLocaleString()}, CTR: ${(p.ctr * 100).toFixed(2)}%, ポジション: ${p.position.toFixed(2)}位`).join('\n')}

【分析指示】
- CTRが低い場合（1%未満）、タイトルやメタディスクリプションの改善が必要です
- ポジションが10位以下の場合、コンテンツの質や内部リンクの強化が必要です
- インプレッションが多いのにクリックが少ない場合、スニペット最適化が重要です
- 複数ページで同じキーワードを獲得している場合、カノニカルURLや内部リンク戦略の見直しが必要です

【重要】「現状の要約」セクションの最初に、上記のGSCデータサマリー（総クリック数、総インプレッション数、平均CTR、平均ポジション）を必ず含めてください。
`
      } else {
        userPrompt += `\n\n【重要】GSCデータについて:
${keyword ? `キーワード「${keyword}」` : `ランディングページ「${landingPage}」`}に関するGSCデータが取得できませんでした（データ件数: 0件）。
期間: ${parsedQuery.dateRange.startDate} 〜 ${parsedQuery.dateRange.endDate}

この場合でも、スクレイピング結果がある場合はHTML分析を行い、一般的なSEO改善提案を提示してください。
`
      }
    }

    // スクレイピング失敗時のメッセージを追加
    if (landingPage && !scrapedData && scrapingError) {
      userPrompt += `\n\n【重要】スクレイピング失敗の通知:
ランディングページ「${landingPage}」のスクレイピングに失敗しました。
エラー: ${scrapingError}

スクレイピングが失敗したため、実際のHTML（タイトル、メタディスクリプション、見出し構造など）を確認できませんでした。
「現状の要約」セクションに「HTML分析（コンテンツSEO）」のサブセクションを追加しないでください。
GSCデータのみに基づいた分析を行ってください。
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

      userPrompt += `\n\n【重要】ランディングページのスクレイピング結果（詳細分析必須）:
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

【重要：出力フォーマットの指示】
スクレイピング結果があるため、以下の形式で必ず分析結果を出力してください：

1. 「現状の要約」セクションに「HTML分析（コンテンツSEO）」のサブセクションを必ず追加してください：
   - 現在のタイトルタグ: "${scrapedData.title || '未設定'}" (${titleLength}文字) - 基準との比較（30-60文字、推奨32文字以内）
   - 現在のメタディスクリプション: "${scrapedData.metaDescription || '未設定'}" (${metaLength}文字) - 基準との比較（120-160文字）
   - 見出し構造: H1が${h1Count}個、H2が${h2Count}個、H3が${h3Count}個 - キーワード含有状況の評価
   - 画像alt属性: ${imageCount}個中${imagesWithAlt}個が設定済み（設定率${imageCount > 0 ? Math.round((imagesWithAlt / imageCount) * 100) : 0}%）
   - 内部リンク: ${internalLinksCount}個 - 関連性とアンカーテキストの評価
   - 構造化データ: ${structuredDataCount}個 ${structuredDataCount > 0 ? `(${scrapedData.structuredData?.map((s: any) => s['@type'] || 'unknown').join(', ')})` : '(未設定)'}
   - OGタグ: タイトル${scrapedData.ogTitle ? '設定済み' : '未設定'}、説明${scrapedData.ogDescription ? '設定済み' : '未設定'}、画像${scrapedData.ogImage ? '設定済み' : '未設定'}
   - カノニカルURL: ${scrapedData.hasCanonical ? scrapedData.canonicalUrl || '設定済み' : '未設定'}

2. 「改善提案」セクションの各提案に、必ずBefore/After形式を含めてください：
   - Before: 現在のHTML要素の状態を具体的に記載（例：「タイトル: '現在のタイトル' (45文字)」）
   - After: 改善後のHTML要素の状態を具体的に記載（例：「タイトル: '改善後のタイトル' (32文字)」）
   - 変更理由: なぜその変更が必要かの説明

【詳細分析項目】
以下の観点で詳細なSEO分析を行ってください：

1. タイトルタグ分析
   - 現在の文字数（${titleLength}文字）が基準（30-60文字、推奨32文字以内）を満たしているか
   - 指定キーワード「${keyword || 'N/A'}」が含まれているか、どの位置にあるか
   - クリック率向上のための改善案（具体的な文字列と文字数を提示）

2. メタディスクリプション分析
   - 現在の文字数（${metaLength}文字）が基準（120-160文字）を満たしているか
   - キーワード含有率、魅力度、行動喚起（CTA）の有無
   - 改善案（具体的な文字列と文字数を提示）

3. 見出し構造分析
   - H1タグが1つだけか（${h1Count}個）、キーワードを含むか
   - H2/H3の階層構造が適切か、キーワードバリエーションを含むか
   - 改善提案（具体的な見出しテキストを提示）

4. 画像最適化分析
   - alt属性の設定率（${imagesWithAlt}/${imageCount} = ${imageCount > 0 ? Math.round((imagesWithAlt / imageCount) * 100) : 0}%）
   - alt属性の内容が具体的で説明的か、キーワードを自然に含むか
   - 改善提案（alt属性のない画像に対する具体的なaltテキストを提示）

5. 内部リンク分析
   - 内部リンク数（${internalLinksCount}個）が適切か
   - 関連性の高いページへのリンクがあるか
   - アンカーテキストにキーワードを含むか

6. 構造化データ分析
   - 構造化データの有無（${structuredDataCount}個）
   - 適切なスキーマタイプが使用されているか
   - 追加すべき構造化データの提案

7. OGタグ分析
   - SNSシェア最適化のためのOGタグ設定状況
   - 改善提案

8. 技術的SEO
   - カノニカルURLの設定状況
   - その他の技術的な問題点

【重要】各分析項目について、必ず以下を含めてください：
- 現在の状態の評価（良い点・悪い点）
- 具体的な改善案（Before/After形式で文字列を提示）
- 優先度（高/中/低）
- 期待効果（数値目標：例「CTRを1.86%から3%以上に向上」）
- 実装難易度（簡単/中程度/難しい）
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

