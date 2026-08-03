/**
 * ローカル手動テスト: Slack へ月次 SEO レポートを投稿
 * 実行: npm run seo:monthly
 */
import { existsSync } from 'fs'

import { buildMonthlySeoReport } from '../src/lib/buildMonthlySeoReport'
import {
  formatSeoMonthlyMessage,
  formatSeoMonthlyParentMessage,
  formatSeoMonthlyThreadMessages,
} from '../src/lib/slackMonthlyMessage'
import { isSlackBotConfigured, postSlackMessage, postToSlack } from '../src/lib/slackClient'

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}

async function main() {
  console.log('Building monthly SEO report...')
  const report = await buildMonthlySeoReport()
  console.log('Month:', report.monthKey, `(${report.monthStart} 〜 ${report.monthEnd})`)

  if (isSlackBotConfigured()) {
    console.log('\n--- Posting to Slack (threaded via Bot Token) ---\n')
    const parent = formatSeoMonthlyParentMessage(report)
    const threads = formatSeoMonthlyThreadMessages(report)
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
    const payload = formatSeoMonthlyMessage(report)
    console.log(payload.text)
    await postToSlack(payload)
    console.log('\nPosted successfully.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
