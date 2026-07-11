import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface LastPostRecord {
  targetDate: string
  postedAt: string
}

function getDedupeFilePath(): string {
  const dir = process.env.DB_DIR || join(process.cwd(), 'data')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'seo-daily-last-post.json')
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

export function saveLastPostRecord(targetDate: string): void {
  const path = getDedupeFilePath()
  const record: LastPostRecord = { targetDate, postedAt: new Date().toISOString() }
  writeFileSync(path, JSON.stringify(record), 'utf-8')
}

/** 同一 targetDate は1日1回のみ Slack 投稿（cron 再実行・手動 curl の連投防止） */
export function shouldSkipDuplicatePost(targetDate: string): boolean {
  const last = getLastPostRecord()
  return last?.targetDate === targetDate
}

/** Render 等で `SEO_DAILY_POSTING_ENABLED=false` にすると Slack 投稿を停止 */
export function isSeoDailyPostingEnabled(): boolean {
  const v = process.env.SEO_DAILY_POSTING_ENABLED?.trim().toLowerCase()
  if (!v) return true
  return v === '1' || v === 'true' || v === 'yes'
}
