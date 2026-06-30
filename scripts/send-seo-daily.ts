/**
 * ローカル手動テスト: Slack へデイリー SEO レポートを投稿
 * 実行: npm run seo:daily
 */
import { existsSync } from 'fs'

import { buildDailySeoReport } from '../src/lib/buildDailySeoReport'
import { formatSeoDailyMessage } from '../src/lib/slackSeoMessage'
import { postToSlack } from '../src/lib/slackClient'

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

  const payload = formatSeoDailyMessage(report)
  console.log('\n--- Message preview ---\n')
  console.log(payload.text)
  console.log('\n--- Posting to Slack ---\n')

  await postToSlack(payload)
  console.log('Posted successfully.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
