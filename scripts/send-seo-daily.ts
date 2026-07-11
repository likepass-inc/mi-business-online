/**
 * ローカル手動テスト: Slack へデイリー SEO レポートを投稿
 * 実行: npm run seo:daily
 */
import { existsSync } from 'fs'

import { buildDailySeoReport } from '../src/lib/buildDailySeoReport'
import {
  formatSeoDailyMessage,
  formatSeoDailyParentMessage,
  formatSeoDailyThreadMessages,
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
    const threads = formatSeoDailyThreadMessages(report)
    console.log(parent.text)
    threads.forEach((thread, i) => {
      console.log(`---（スレッド ${i + 1}）---`)
      console.log(thread.text)
    })
    const parentTs = await postSlackMessage(parent)
    for (const thread of threads) {
      await postSlackMessage(thread, { threadTs: parentTs })
    }
    console.log(`\nPosted successfully (parent + ${threads.length} thread replies).`)
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
