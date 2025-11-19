import { NextRequest, NextResponse } from 'next/server'
import { fetchGA4Data } from '@/lib/ga4Client'
import type { GA4Request } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body: GA4Request = await req.json()
    const { dateRange, metrics, dimensions, filters } = body

    console.log('[GA4 API] Request received:', {
      dateRange,
      metrics,
      dimensions,
      filters: filters ? 'present' : 'none',
    })

    if (!dateRange || !metrics || metrics.length === 0) {
      console.error('[GA4 API] Validation error: dateRange and metrics are required')
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

    console.log(`[GA4 API] Successfully fetched ${result.rows.length} rows`)
    return NextResponse.json(result)
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'GA4 request failed'
    const errorStack = e instanceof Error ? e.stack : undefined
    console.error('[GA4 API] Error:', errorMessage)
    if (errorStack) {
      console.error('[GA4 API] Error stack:', errorStack)
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

