import { createCrawlLog } from '../src/lib/db/productRepository'
import { runSeasonMapCrawl } from '../src/lib/seasonCrawl'

async function main() {
  const seedOnly = process.argv.includes('--seed-only')
  const logId = createCrawlLog('season-map')
  console.log(`[crawl-season-map] starting log_id=${logId} seedOnly=${seedOnly}`)
  const result = await runSeasonMapCrawl(logId, { seedOnly })
  console.log('[crawl-season-map] done', result)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
