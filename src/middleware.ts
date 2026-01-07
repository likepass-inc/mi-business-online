import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 認証が不要なパス
const publicPaths = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  // 商品API（WordPress/SWELLからアクセス）
  '/api/products',
  '/api/magazine',
  '/api/crawl',
  '/api/cron'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 公開パスの場合は認証チェックをスキップ
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // セッションCookieを確認
  const session = request.cookies.get('auth_session')

  // セッションがない場合
  if (!session) {
    // APIルートの場合は401エラーを返す
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }
    // ページの場合はログインページにリダイレクト
    const loginUrl = new URL('/login', request.url)
    // 元のURLをクエリパラメータに保存（ログイン後に戻れるように）
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// ミドルウェアを適用するパス
export const config = {
  matcher: [
    /*
     * 以下のパスを除くすべてのリクエストパスにマッチ:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.svg (icon file)
     * 注意: APIルートも含まれるが、/api/auth/*は公開パスとして処理される
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}

