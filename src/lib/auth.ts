import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { authenticateAdmin, getAdminUserStore, type AdminRole, type AdminUser } from '@/lib/db/adminUserStore'

export type { AdminRole, AdminUser }

export interface User {
  id: string
  role: AdminRole
}

const SESSION_COOKIE_NAME = 'auth_session'
const SESSION_MAX_AGE = 24 * 60 * 60 // 24時間（秒）

/**
 * ユーザー認証（メールアドレス + パスワードを DB 照合）
 */
export async function authenticateUser(id: string, password: string): Promise<User | null> {
  const user = await authenticateAdmin(id, password)
  if (!user) return null
  return { id: user.email, role: user.role }
}

/**
 * セッションCookieを設定
 */
export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

/**
 * セッションCookieを削除
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * セッションからユーザーID（メール）を取得
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)
  return session?.value || null
}

/**
 * セッションの有効なユーザーを取得
 */
export async function getSessionUser(): Promise<AdminUser | null> {
  const userId = await getSessionUserId()
  if (!userId) return null
  return getAdminUserStore().findActiveByEmail(userId)
}

/**
 * 認証状態を確認
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getSessionUser()
  return Boolean(user)
}

/**
 * 認証が必要なAPIリクエストのチェック（Cookie の有無）
 */
export function checkAuth(request: NextRequest): { authenticated: boolean; userId: string | null } {
  const session = request.cookies.get(SESSION_COOKIE_NAME)
  const userId = session?.value || null
  return { authenticated: Boolean(userId), userId }
}
