import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { touchAdminSession } from '@/lib/db/adminActivityStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (user) {
      await touchAdminSession(user.email)
    }

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
