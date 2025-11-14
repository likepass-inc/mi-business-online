import { NextRequest, NextResponse } from 'next/server'
import { fetchGA4Data } from '@/lib/ga4Client'
import type { GA4Request } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body: GA4Request = await req.json()
    const { dateRange, metrics, dimensions, filters } = body

    if (!dateRange || !metrics || metrics.length === 0) {
      return NextResponse.json(
        { error: 'dateRange and metrics are required' },
        { status: 400 }
      )
    }

    const result = await fetchGA4Data({
      dateRange,
      metrics,
      dimensions,
      filters,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('GA4 API error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'GA4 request failed' },
      { status: 500 }
    )
  }
}

