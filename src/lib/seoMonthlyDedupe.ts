import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface LastPostRecord {
  monthKey: string
  postedAt: string
}

function getDedupeFilePath(): string {
  const dir = process.env.DB_DIR || join(process.cwd(), 'data')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'seo-monthly-last-post.json')
}

export function getLastPostRecord(): LastPostRecord | null {
  const path = getDedupeFilePath()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as LastPostRecord
  } catch {
    return null
  }
}

export function saveLastPostRecord(monthKey: string): void {
  const path = getDedupeFilePath()
  const record: LastPostRecord = { monthKey, postedAt: new Date().toISOString() }
  writeFileSync(path, JSON.stringify(record), 'utf-8')
}

/** 同一 monthKey は1ヶ月1回のみ Slack 投稿 */
export function shouldSkipDuplicatePost(monthKey: string): boolean {
  const last = getLastPostRecord()
  return last?.monthKey === monthKey
}

/** `SEO_MONTHLY_POSTING_ENABLED=false` にすると Slack 投稿を停止 */
export function isSeoMonthlyPostingEnabled(): boolean {
  const v = process.env.SEO_MONTHLY_POSTING_ENABLED?.trim().toLowerCase()
  if (!v) return true
  return v === '1' || v === 'true' || v === 'yes'
}
