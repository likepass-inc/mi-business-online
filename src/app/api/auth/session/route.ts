import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, getSessionUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    const userId = await getSessionUserId()

    return NextResponse.json({
      authenticated,
      userId: authenticated ? userId : null,
    })
  } catch (e) {
    console.error('Session API error:', e)
    return NextResponse.json(
      { authenticated: false, userId: null },
      { status: 500 }
    )
  }
}

