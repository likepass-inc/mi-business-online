import { NextRequest, NextResponse } from 'next/server'
import { fetchGSCData } from '@/lib/gscClient'
import type { GSCRequest } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body: GSCRequest = await req.json()
    const { startDate, endDate, dimensions, rowLimit } = body

    console.log('[GSC API] Request received:', {
      startDate,
      endDate,
      dimensions,
      rowLimit,
    })

    if (!startDate || !endDate) {
      console.error('[GSC API] Validation error: startDate and endDate are required')
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const result = await fetchGSCData({
      startDate,
      endDate,
      dimensions,
      rowLimit,
    })

    console.log(`[GSC API] Successfully fetched ${result.rows.length} rows`)
    return NextResponse.json(result)
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'GSC request failed'
    const errorStack = e instanceof Error ? e.stack : undefined
    console.error('[GSC API] Error:', errorMessage)
    if (errorStack) {
      console.error('[GSC API] Error stack:', errorStack)
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

