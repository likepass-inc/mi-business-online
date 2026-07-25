/**
 * ローカル手動テスト: Slack へ週次 SEO レポートを投稿
 * 実行: npm run seo:weekly
 */
import { existsSync } from 'fs'

import { buildWeeklySeoReport } from '../src/lib/buildWeeklySeoReport'
import {
  formatSeoWeeklyMessage,
  formatSeoWeeklyParentMessage,
  formatSeoWeeklyThreadMessages,
} from '../src/lib/slackSeoMessage'
import { isSlackBotConfigured, postSlackMessage, postToSlack } from '../src/lib/slackClient'

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}

async function main() {
  console.log('Building weekly SEO report...')
  const report = await buildWeeklySeoReport()
  console.log('Week:', report.weekStart, '〜', report.weekEnd)

  if (isSlackBotConfigured()) {
    console.log('\n--- Posting to Slack (threaded via Bot Token) ---\n')
    const parent = formatSeoWeeklyParentMessage(report)
    const threads = formatSeoWeeklyThreadMessages(report)
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
    const payload = formatSeoWeeklyMessage(report)
    console.log(payload.text)
    await postToSlack(payload)
    console.log('\nPosted successfully.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
