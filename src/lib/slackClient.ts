export interface SlackMessagePayload {
  text?: string
  blocks?: Array<Record<string, unknown>>
}

/**
 * Incoming Webhook で投稿（スレッド非対応）。
 * SLACK_BOT_TOKEN が無い場合のフォールバック用。
 */
export async function postToSlack(payload: SlackMessagePayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    throw new Error('SLACK_WEBHOOK_URL must be set')
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`)
  }
}

interface PostMessageOptions {
  /** スレッド返信先の親メッセージ ts */
  threadTs?: string
}

/**
 * Bot Token (chat.postMessage) で投稿し、投稿した message の ts を返す。
 * threadTs を渡すとスレッド返信になる。
 */
export async function postSlackMessage(
  payload: SlackMessagePayload,
  options?: PostMessageOptions
): Promise<string> {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL_ID

  if (!token) {
    throw new Error('SLACK_BOT_TOKEN must be set')
  }
  if (!channel) {
    throw new Error('SLACK_CHANNEL_ID must be set')
  }

  const body: Record<string, unknown> = {
    channel,
    ...payload,
  }
  if (options?.threadTs) {
    body.thread_ts = options.threadTs
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json().catch(() => null)) as
    | { ok: boolean; ts?: string; error?: string }
    | null

  if (!response.ok || !data || !data.ok) {
    const reason = data?.error || `${response.status} ${response.statusText}`
    throw new Error(`Slack chat.postMessage failed: ${reason}`)
  }

  return data.ts ?? ''
}

/** Bot Token 方式が利用可能か（未設定なら Webhook へフォールバック） */
export function isSlackBotConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID)
}
