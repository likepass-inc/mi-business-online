import assert from 'node:assert/strict'
import { parseProductPage } from './productParser'
import { isSeasonMapStubProduct, prepareSeasonMapProduct } from './seasonCrawl'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}`)
    throw e
  }
}

const stubHtml = `
<html>
  <head><title>三越伊勢丹法人オンライン｜請求書払い</title></head>
  <body>
    <p>ご指定の商品は販売終了か、ただ今お取扱いできない商品です。</p>
  </body>
</html>
`

const liveHtml = `
<html>
  <head><title>スヌーピー ウォッシュタオルセット｜三越伊勢丹法人オンライン｜請求書払い</title></head>
  <body>
    <h1>スヌーピー ウォッシュタオルセット</h1>
    <p class="price">3,510円（税込）</p>
    <img src="https://example.com/img/goods/fw.jpg">
  </body>
</html>
`

test('stub FW pages keep map names and drop discontinued availability', () => {
  const parsed = parseProductPage(stubHtml, 'https://business.mistore.jp/shop/g/gR600-303F26')
  assert.ok(parsed)
  assert.equal(isSeasonMapStubProduct(parsed), true)
  const prepared = prepareSeasonMapProduct(parsed, 'https://business.mistore.jp/shop/g/gR600-303F26')
  assert.equal(prepared.product_code, 'gR600-303F26')
  assert.equal(prepared.product_name, 'スヌーピー ウォッシュタオルセット')
  assert.equal(prepared.availability, undefined)
  assert.equal(prepared.price_incl_tax, undefined)
  assert.equal(prepared.image_urls, undefined)
})

test('real FW catalog pages keep price and availability', () => {
  const parsed = parseProductPage(liveHtml, 'https://business.mistore.jp/shop/g/gR600-303F26')
  assert.ok(parsed)
  assert.equal(isSeasonMapStubProduct(parsed), false)
  const prepared = prepareSeasonMapProduct(parsed, 'https://business.mistore.jp/shop/g/gR600-303F26')
  assert.equal(prepared.product_name?.includes('スヌーピー'), true)
  assert.equal(prepared.price_incl_tax, 3510)
  assert.ok(prepared.image_urls && prepared.image_urls.length > 0)
})

console.log('\nAll seasonCrawl tests passed.')
