import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()

    return NextResponse.json({
      authenticated: Boolean(user),
      userId: user ? user.email : null,
      role: user ? user.role : null,
    })
  } catch (e) {
    console.error('Session API error:', e)
    return NextResponse.json(
      { authenticated: false, userId: null, role: null },
      { status: 500 }
    )
  }
}
