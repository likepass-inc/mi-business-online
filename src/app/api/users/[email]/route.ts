import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { AdminUserError, getAdminUserStore } from '@/lib/db/adminUserStore'
import { recordAdminAction } from '@/lib/db/adminActivityStore'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const email = decodeURIComponent((await params).email)
    const body = await req.json()
    const updated = await getAdminUserStore().updateUser(email, {
      role: body.role,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
    })
    await recordAdminAction(user.email, 'user_update')
    return NextResponse.json({ user: updated })
  } catch (e) {
    if (e instanceof AdminUserError) {
      const status = e.message === 'ユーザーが見つかりません' ? 404 : 400
      return NextResponse.json({ error: e.message }, { status })
    }
    console.error('Users update API error:', e)
    return NextResponse.json({ error: 'ユーザーの更新に失敗しました' }, { status: 500 })
  }
}
