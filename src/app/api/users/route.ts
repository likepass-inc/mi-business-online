import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { AdminUserError, getAdminUserStore } from '@/lib/db/adminUserStore'
import { getAdminActivityStore, recordAdminAction, type UserActivitySummary } from '@/lib/db/adminActivityStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const rows = await getAdminUserStore().listUsers()
    let summaries: UserActivitySummary[] = []
    try {
      summaries = await getAdminActivityStore().userSessionSummaries()
    } catch (err) {
      console.warn('[users] activity summaries', err instanceof Error ? err.message : err)
    }
    const byEmail = Object.fromEntries(summaries.map((row) => [row.email, row]))
    return NextResponse.json({
      rows: rows.map((row) => {
        const summary = byEmail[row.email]
        return {
          ...row,
          last_seen_at: summary?.last_seen_at || null,
          sessions_7d: summary?.sessions_7d || 0,
          last_action: summary?.last_action || null,
          last_action_label: summary?.last_action_label || null,
        }
      }),
    })
  } catch (e) {
    console.error('Users list API error:', e)
    return NextResponse.json({ error: 'ユーザー一覧の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await req.json()
    const created = await getAdminUserStore().createUser({
      email: body.email,
      password: body.password,
      role: body.role,
    })
    await recordAdminAction(user.email, 'user_create')
    return NextResponse.json({ user: created })
  } catch (e) {
    if (e instanceof AdminUserError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error('Users create API error:', e)
    return NextResponse.json({ error: 'ユーザーの追加に失敗しました' }, { status: 500 })
  }
}
