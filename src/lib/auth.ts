import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// ユーザー情報（将来はDBに移行可能）
export interface User {
  id: string
  password: string // 本番環境ではハッシュ化推奨
}

// 現在のユーザー（将来はDBから取得）
const USERS: User[] = [
  {
    id: 'tk',
    password: 'nakamura', // 本番環境では環境変数から取得し、ハッシュ化推奨
  },
]

// セッションキー
const SESSION_COOKIE_NAME = 'auth_session'
const SESSION_MAX_AGE = 24 * 60 * 60 // 24時間（秒）

/**
 * ユーザー認証
 */
export function authenticateUser(id: string, password: string): User | null {
  const user = USERS.find((u) => u.id === id && u.password === password)
  return user || null
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
 * セッションからユーザーIDを取得
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE_NAME)
  return session?.value || null
}

/**
 * 認証状態を確認
 */
export async function isAuthenticated(): Promise<boolean> {
  const userId = await getSessionUserId()
  if (!userId) {
    return false
  }
  // ユーザーが存在するか確認
  return USERS.some((u) => u.id === userId)
}

/**
 * 認証が必要なAPIリクエストのチェック
 */
export function checkAuth(request: NextRequest): { authenticated: boolean; userId: string | null } {
  const session = request.cookies.get(SESSION_COOKIE_NAME)
  const userId = session?.value || null
  
  if (!userId) {
    return { authenticated: false, userId: null }
  }
  
  // ユーザーが存在するか確認
  const userExists = USERS.some((u) => u.id === userId)
  return { authenticated: userExists, userId: userExists ? userId : null }
}

