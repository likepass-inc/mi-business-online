import { NextRequest, NextResponse } from 'next/server'
import { buildLegacyConversionPath } from '@/lib/buildMonthlyFunnel'
import type { DateRange } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dateRange }: { dateRange: DateRange } = body

    if (!dateRange) {
      return NextResponse.json({ error: 'dateRange is required' }, { status: 400 })
    }

    const pathData = await buildLegacyConversionPath(dateRange)
    return NextResponse.json(pathData)
  } catch (error) {
    console.error('Error fetching conversion path:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversion path data' },
      { status: 500 }
    )
  }
}
