import { NextRequest, NextResponse } from 'next/server'
import { fetchGSCData } from '@/lib/gscClient'
import type { GSCRequest } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body: GSCRequest = await req.json()
    const { startDate, endDate, dimensions, rowLimit } = body

    if (!startDate || !endDate) {
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

    return NextResponse.json(result)
  } catch (e) {
    console.error('GSC API error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'GSC request failed' },
      { status: 500 }
    )
  }
}

