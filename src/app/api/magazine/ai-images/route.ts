import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  createMagazineAiJob,
  getMagazineAiJob,
  processMagazineAiJob,
  publicMagazineAiJob,
  type MagazineAiRole,
} from '@/lib/magazineAiImages'

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

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!secretOk(req)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 401 })
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'OPENAI_API_KEY が設定されていません' },
      { status: 503 }
    )
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
    return NextResponse.json({ success: false, error: 'JSON が必要です' }, { status: 400 })
  }
  const role: MagazineAiRole = body.role === 'inline' ? 'inline' : 'featured'
  const categories = Array.isArray(body.categories)
    ? body.categories.map((c) => String(c))
    : []
  const job = createMagazineAiJob({
    title: String(body.title || ''),
    categories,
    excerpt: String(body.excerpt || ''),
    heading: String(body.heading || ''),
    note: String(body.note || ''),
    role,
  })
  processMagazineAiJob(job.id).catch((e) => {
    console.error('[magazine ai-images] background process error:', e)
  })
  return NextResponse.json({ success: true, job_id: job.id, status: job.status })
}

export async function GET(req: NextRequest) {
  if (!secretOk(req)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) {
    return NextResponse.json({ success: false, error: 'id が必要です' }, { status: 400 })
  }
  const job = getMagazineAiJob(id)
  if (!job) {
    return NextResponse.json({ success: false, error: 'ジョブが見つかりません' }, { status: 404 })
  }
  return NextResponse.json(publicMagazineAiJob(job))
}
