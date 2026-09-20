import { randomUUID } from 'crypto'
import { getOpenAIClient } from '@/lib/openaiClient'

const JOB_TTL_MS = 15 * 60 * 1000
const IMAGE_MODELS = ['gpt-image-2.5-sunburst', 'gpt-image-2'] as const

export type MagazineAiRole = 'featured' | 'inline'

export type MagazineAiJobInput = {
  title: string
  categories: string[]
  excerpt: string
  heading: string
  note: string
  role: MagazineAiRole
}

export type MagazineAiJob = {
  id: string
  status: 'pending' | 'running' | 'done' | 'error'
  createdAt: number
  input: MagazineAiJobInput
  result?: {
    image_base64: string
    alt: string
    model: string
  }
  message?: string
}

const jobs = new Map<string, MagazineAiJob>()

function pruneJobs() {
  const cutoff = Date.now() - JOB_TTL_MS
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      jobs.delete(id)
    }
  }
}

function truncate(text: string, len: number) {
  const t = text.trim()
  return t.length <= len ? t : t.slice(0, len)
}

function buildPromptMessages(input: MagazineAiJobInput) {
  const scene =
    input.role === 'inline' && input.heading
      ? `Section heading to illustrate: ${input.heading}`
      : 'Hero / listing thumbnail for the whole article.'
  const parts = [
    `Article title: ${input.title}`,
    `Categories: ${input.categories.join('、')}`,
    `Excerpt: ${input.excerpt}`,
    `Body summary: ${truncate(input.excerpt, 1500)}`,
    scene,
  ]
  if (input.note) {
    parts.push(`Editor atmosphere note: ${input.note}`)
  }
  const system = `You write image-generation prompts for a luxury Japanese department-store gift magazine (Mitsukoshi Isetan corporate gifts).
Return a JSON object with keys:
- "prompt": a detailed English image prompt
- "alt": a concise Japanese alt text (60-120 characters) describing the image for accessibility and SEO

Style lock for "prompt":
- Photoreal editorial still-life or lifestyle photography, magazine quality
- Palette: warm cream #F5F1EC, soft gold #B5894A, charcoal, natural wood, washi/wrapping paper, noshi paper, seasonal botanicals
- Soft natural window light, shallow depth of field, tactile materials
- Horizontal 16:9 composition, generous negative space, no heavy retouching
- No logos, trademarks, watermarks, or readable text (Japanese or Latin)
- Do not depict identifiable branded products or department-store storefronts with names
- Tasteful and restrained even for mourning, apology, or condolence gifts (not gloomy, no religious icons)
- Avoid close-up faces; anonymous hands wrapping a gift are acceptable
- Do not mention Mitsukoshi, Isetan, or any real brand name in the image prompt`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: parts.join('\n') },
  ]
}

async function writePrompt(input: MagazineAiJobInput) {
  const client = getOpenAIClient()
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: buildPromptMessages(input),
  })
  const text = completion.choices[0]?.message?.content || ''
  let parsed: { prompt?: string; alt?: string } = {}
  try {
    parsed = JSON.parse(text) as { prompt?: string; alt?: string }
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      parsed = JSON.parse(match[0]) as { prompt?: string; alt?: string }
    }
  }
  const prompt = (parsed.prompt || '').trim()
  if (!prompt) {
    throw new Error('画像プロンプトを作れませんでした。')
  }
  const alt = truncate((parsed.alt || input.title || '').trim(), 120)
  return { prompt, alt }
}

async function generateJpeg(prompt: string) {
  const client = getOpenAIClient()
  let lastError: unknown
  for (const model of IMAGE_MODELS) {
    try {
      const image = await client.images.generate({
        model: model as 'gpt-image-1',
        prompt,
        n: 1,
        size: '1536x1024',
        quality: 'high',
        output_format: 'jpeg',
        output_compression: 82,
      })
      const b64 = image.data?.[0]?.b64_json
      if (b64) {
        return { image_base64: b64, model }
      }
      lastError = new Error('生成画像が返りませんでした。')
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!/does not exist|not found|invalid_model|model_not_found/i.test(msg)) {
        throw err
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('画像を生成できませんでした。')
}

export function createMagazineAiJob(input: MagazineAiJobInput): MagazineAiJob {
  pruneJobs()
  const job: MagazineAiJob = {
    id: randomUUID(),
    status: 'pending',
    createdAt: Date.now(),
    input: {
      title: truncate(input.title || '', 200),
      categories: (input.categories || []).map((c) => truncate(String(c), 80)).slice(0, 8),
      excerpt: truncate(input.excerpt || '', 1500),
      heading: truncate(input.heading || '', 200),
      note: truncate(input.note || '', 200),
      role: input.role === 'inline' ? 'inline' : 'featured',
    },
  }
  jobs.set(job.id, job)
  return job
}

export function getMagazineAiJob(id: string): MagazineAiJob | undefined {
  pruneJobs()
  return jobs.get(id)
}

export async function processMagazineAiJob(id: string): Promise<void> {
  const job = jobs.get(id)
  if (!job || job.status === 'done' || job.status === 'error') {
    return
  }
  job.status = 'running'
  jobs.set(id, job)
  try {
    const written = await writePrompt(job.input)
    const generated = await generateJpeg(written.prompt)
    job.status = 'done'
    job.result = {
      image_base64: generated.image_base64,
      alt: written.alt,
      model: generated.model,
    }
    jobs.set(id, job)
  } catch (err) {
    job.status = 'error'
    job.message = err instanceof Error ? err.message : '生成に失敗しました。'
    jobs.set(id, job)
    console.error('[magazine ai-images] job failed:', id, err)
  }
}

export function publicMagazineAiJob(job: MagazineAiJob) {
  return {
    success: true,
    job_id: job.id,
    status: job.status,
    message: job.message || undefined,
    result: job.result
      ? {
          image_base64: job.result.image_base64,
          alt: job.result.alt,
          model: job.result.model,
        }
      : undefined,
  }
}
