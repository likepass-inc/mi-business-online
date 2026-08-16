import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, password } = body

    if (!id || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードを入力してください' },
        { status: 400 }
      )
    }

    const user = await authenticateUser(id, password)

    if (!user) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      )
    }

    await setSessionCookie(user.id)

    return NextResponse.json({ success: true, userId: user.id, role: user.role })
  } catch (e) {
    console.error('Login API error:', e)
    return NextResponse.json(
      { error: 'ログインに失敗しました' },
      { status: 500 }
    )
  }
}
