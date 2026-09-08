import { parseProductPage } from './productParser'

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

const url = 'https://business.mistore.jp/shop/g/gTEST-001/'

function page(inner: string) {
  return parseProductPage(
    `<html><head><title>テスト商品 | 三越伊勢丹法人オンライン</title></head><body>${inner}</body></html>`,
    url
  )
}

console.log('productParser')

let p = page(`
  <section class="selectSKU"><p class="stock">販売を終了いたしました</p></section>
`)
assert(p?.stock_kind === 'not_available' && p?.in_stock === false, 'p.stock の販売終了 → not_available')

p = page(`
  <p>おすすめ</p>
  <footer>こちらの関連商品は販売終了しました</footer>
  <div class="related">売り切れの商品もあります</div>
`)
assert(p?.stock_kind === 'unknown' && p?.in_stock === true, 'p.stock なし＋本文の販売終了 → unknown')
assert(!p?.availability, '本文フォールバックでは availability を埋めない')

p = page(`
  <script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    offers: { availability: 'https://schema.org/Discontinued' },
  })}</script>
`)
assert(p?.stock_kind === 'not_available', 'JSON-LD Discontinued → not_available')

p = page(`
  <script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    offers: { availability: 'https://schema.org/OutOfStock' },
  })}</script>
`)
assert(p?.stock_kind !== 'not_available', 'JSON-LD OutOfStock は終売にしない')

console.log(`\nDone: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
