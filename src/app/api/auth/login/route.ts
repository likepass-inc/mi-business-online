import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, setSessionCookie } from '@/lib/auth'
import { recordAdminSessionStart } from '@/lib/db/adminActivityStore'
import { turnstileRequired, verifyTurnstileToken } from '@/lib/turnstile'
import { webshieldConfigured, webshieldGate } from '@/lib/webshield-auth'

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, password, turnstileToken } = body

    if (!id || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードを入力してください' },
        { status: 400 }
      )
    }

    const ip = clientIp(req)

    // Turnstile before auth-gate so failed captchas do not count toward lockout.
    const captcha = await verifyTurnstileToken(turnstileToken, ip)
    if (!captcha.ok) {
      const message =
        captcha.error === 'turnstile_not_configured' && turnstileRequired()
          ? 'ボット対策が未設定です。管理者に連絡してください。'
          : 'ボット確認に失敗しました。ページを再読み込みして再試行してください。'
      return NextResponse.json({ error: message }, { status: 403 })
    }

    const useGate = webshieldConfigured()

    if (useGate) {
      const pre = await webshieldGate({ action: 'check', ip, path: '/api/auth/login' })
      if (!pre.allow) {
        return NextResponse.json(
          {
            error: 'ログイン試行が一時的にロックされています。しばらくしてから再試行してください。',
            lockedUntil: pre.lockedUntil,
          },
          { status: 429 }
        )
      }
    }

    const user = await authenticateUser(id, password)

    if (!user) {
      if (useGate) {
        const failed = await webshieldGate({ action: 'failed', ip, path: '/api/auth/login' })
        if (!failed.allow) {
          return NextResponse.json(
            {
              error: 'ログイン試行が一時的にロックされています。しばらくしてから再試行してください。',
              lockedUntil: failed.lockedUntil,
            },
            { status: 429 }
          )
        }
      }
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      )
    }

    if (useGate) {
      await webshieldGate({ action: 'success', ip, path: '/api/auth/login' })
    }

    await setSessionCookie(user.id)
    await recordAdminSessionStart(user.id)

    return NextResponse.json({ success: true, userId: user.id, role: user.role })
  } catch (e) {
    console.error('Login API error:', e)
    return NextResponse.json(
      { error: 'ログインに失敗しました' },
      { status: 500 }
    )
  }
}
