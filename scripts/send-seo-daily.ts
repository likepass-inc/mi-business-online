/**
 * ローカル手動テスト: Slack へデイリー SEO レポートを投稿
 * 実行: npm run seo:daily
 */
import { existsSync } from 'fs'

import { buildDailySeoReport } from '../src/lib/buildDailySeoReport'
import {
  formatSeoDailyDetailMessage,
  formatSeoDailyMessage,
  formatSeoDailyParentMessage,
} from '../src/lib/slackSeoMessage'
import { isSlackBotConfigured, postSlackMessage, postToSlack } from '../src/lib/slackClient'

// tsx 単体実行では Next.js のように .env.local を自動読み込みしないため明示的にロード
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}

async function main() {
  console.log('Building daily SEO report...')
  const report = await buildDailySeoReport()
  console.log('Target date:', report.targetDate)

  if (isSlackBotConfigured()) {
    console.log('\n--- Posting to Slack (threaded via Bot Token) ---\n')
    const parent = formatSeoDailyParentMessage(report)
    const detail = formatSeoDailyDetailMessage(report)
    console.log(parent.text)
    console.log('---（スレッド内）---')
    console.log(detail.text)
    const parentTs = await postSlackMessage(parent)
    await postSlackMessage(detail, { threadTs: parentTs })
    console.log('\nPosted successfully (parent + thread reply).')
  } else {
    console.log('\n--- Posting to Slack (single message via Webhook) ---\n')
    const payload = formatSeoDailyMessage(report)
    console.log(payload.text)
    await postToSlack(payload)
    console.log('\nPosted successfully.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
