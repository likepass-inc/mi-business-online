import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  createMagazineAiJob,
  getMagazineAiJob,
  processMagazineAiJob,
  publicMagazineAiJob,
  type MagazineAiRole,
} from '@/lib/magazineAiImages'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function secretOk(req: NextRequest): boolean {
  const expected = process.env.MAGAZINE_AI_SECRET || ''
  const got = req.headers.get('x-magazine-secret') || ''
  if (!expected || !got) {
    return false
  }
  const a = createHash('sha256').update(expected).digest()
  const b = createHash('sha256').update(got).digest()
  return timingSafeEqual(a, b)
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      Connection: 'close',
      'Cache-Control': 'no-store',
    },
  })
}

function runInBackground(id: string) {
  setTimeout(() => {
    void processMagazineAiJob(id).catch((e) => {
      console.error('[magazine ai-images] background process error:', e)
    })
  }, 0)
}

function headerExcerpt(req: NextRequest) {
  const raw = req.headers.get('x-magazine-excerpt') || ''
  if (!raw) {
    return ''
  }
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8')
    if (decoded) {
      return decoded
    }
  } catch {
    // fall through
  }
  return raw
}

function startJob(input: {
  title: string
  categories: string[]
  excerpt: string
  heading: string
  note: string
  role: MagazineAiRole
}) {
  if (!process.env.OPENAI_API_KEY) {
    return json({ success: false, error: 'OPENAI_API_KEY が設定されていません' }, 503)
  }
  const job = createMagazineAiJob(input)
  runInBackground(job.id)
  return json({ success: true, job_id: job.id, status: 'pending' })
}

export async function POST(req: NextRequest) {
  if (!secretOk(req)) {
    return json({ success: false, error: 'forbidden' }, 401)
  }
  let body: {
    title?: string
    categories?: unknown
    excerpt?: string
    heading?: string
    note?: string
    role?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'JSON が必要です' }, 400)
  }
  const role: MagazineAiRole = body.role === 'inline' ? 'inline' : 'featured'
  const categories = Array.isArray(body.categories)
    ? body.categories.map((c) => String(c))
    : []
  return startJob({
    title: String(body.title || ''),
    categories,
    excerpt: String(body.excerpt || ''),
    heading: String(body.heading || ''),
    note: String(body.note || ''),
    role,
  })
}

export async function GET(req: NextRequest) {
  if (!secretOk(req)) {
    return json({ success: false, error: 'forbidden' }, 401)
  }
  const ping = req.nextUrl.searchParams.get('ping') || ''
  if (ping === '1') {
    return json({ success: true, ok: true })
  }
  const start = req.nextUrl.searchParams.get('start') || ''
  if (start === '1') {
    const role: MagazineAiRole =
      req.nextUrl.searchParams.get('role') === 'inline' ? 'inline' : 'featured'
    const categories = String(req.nextUrl.searchParams.get('categories') || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    return startJob({
      title: String(req.nextUrl.searchParams.get('title') || ''),
      categories,
      excerpt: headerExcerpt(req) || String(req.nextUrl.searchParams.get('excerpt') || ''),
      heading: String(req.nextUrl.searchParams.get('heading') || ''),
      note: String(req.nextUrl.searchParams.get('note') || ''),
      role,
    })
  }
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) {
    return json({ success: false, error: 'id が必要です' }, 400)
  }
  const job = getMagazineAiJob(id)
  if (!job) {
    return json({ success: false, error: 'ジョブが見つかりません' }, 404)
  }
  return json(publicMagazineAiJob(job))
}
