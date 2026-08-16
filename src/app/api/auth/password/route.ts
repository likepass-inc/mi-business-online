import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { AdminUserError, getAdminUserStore } from '@/lib/db/adminUserStore'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const password = String(body.password || body.newPassword || '')
    if (!password) {
      return NextResponse.json({ error: 'パスワードを入力してください' }, { status: 400 })
    }

    await getAdminUserStore().updatePassword(user.email, password)
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof AdminUserError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error('Password API error:', e)
    return NextResponse.json({ error: 'パスワードの変更に失敗しました' }, { status: 500 })
  }
}
