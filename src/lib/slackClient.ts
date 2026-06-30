export interface SlackMessagePayload {
  text?: string
  blocks?: Array<Record<string, unknown>>
}

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
