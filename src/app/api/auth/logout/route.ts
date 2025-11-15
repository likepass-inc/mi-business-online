import { NextRequest, NextResponse } from 'next/server'
import { deleteSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    // セッションCookieを削除
    await deleteSessionCookie()

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Logout API error:', e)
    return NextResponse.json(
      { error: 'ログアウトに失敗しました' },
      { status: 500 }
    )
  }
}

