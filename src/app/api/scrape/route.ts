import { NextRequest, NextResponse } from 'next/server'
import { scrapePage } from '@/lib/scraper'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, useJavaScript = false } = body

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    // 自サイトのみ許可
    const urlObj = new URL(url)
    const allowedDomains = ['business.mistore.jp', 'www.business.mistore.jp']
    
    if (!allowedDomains.includes(urlObj.hostname)) {
      return NextResponse.json(
        { error: 'Only business.mistore.jp domain is allowed' },
        { status: 403 }
      )
    }

    const scrapedData = await scrapePage(url, useJavaScript)

    return NextResponse.json(scrapedData)
  } catch (e) {
    console.error('Scrape API error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Scrape request failed' },
      { status: 500 }
    )
  }
}

