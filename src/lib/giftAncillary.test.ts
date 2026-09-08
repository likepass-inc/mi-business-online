import { createRequire } from 'module'
import { parseEcStock, expandProductCodeVariants } from './giftAncillary'

const require = createRequire(import.meta.url)
const cheerio = require('cheerio') as typeof import('cheerio')

let passed = 0
let failed = 0

function assert(cond: unknown, msg: string) {
  if (cond) {
    passed++
    console.log('  OK:', msg)
  } else {
    failed++
    console.error('  FAIL:', msg)
  }
}

function parseStock(stockText: string) {
  const $ = cheerio.load(
    `<html><body><section class="selectSKU"><p class="stock">${stockText}</p></section></body></html>`
  )
  return parseEcStock($)
}

console.log('giftAncillary')

assert(expandProductCodeVariants('g020W-053').includes('020W-053'), 'strip leading g')
assert(expandProductCodeVariants('020W-053').includes('g020W-053'), 'add leading g')

let r = parseStock('残り10点')
assert(r.in_stock && r.stock_kind === 'in_stock', '残り10点 → in_stock')

r = parseStock('残り１５点')
assert(r.in_stock && r.stock_kind === 'in_stock', '残り１５点 → in_stock')

r = parseStock('残り0点')
assert(!r.in_stock && r.stock_kind === 'not_available', '残り0点 → not_available')

r = parseStock('一時欠品中')
assert(!r.in_stock && r.stock_kind === 'temp_out', '一時欠品中 → temp_out')

r = parseStock('販売を終了いたしました')
assert(!r.in_stock && r.stock_kind === 'not_available', '販売終了 → not_available')

r = parseStock('在庫あり')
assert(r.in_stock && r.stock_kind === 'in_stock', '在庫あり → in_stock')

r = parseEcStock(cheerio.load('<html><body><footer>関連商品は販売終了</footer></body></html>'))
assert(r.in_stock && r.stock_kind === 'unknown' && r.stock_label === null, 'p.stock なし＋本文の販売終了 → unknown')

console.log(`\nDone: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
