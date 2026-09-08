import assert from 'node:assert/strict'
import {
  isDiscontinuedStubPage,
  isSiteChromeProductName,
  parseProductPage,
} from './productParser'
import * as cheerio from 'cheerio'

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
    <p class="price">2,999円（税込）</p>
    <img class="photoMain" src="https://example.com/chrome.png">
  </body>
</html>
`

const realHtml = `
<html>
  <head><title>とらや 羊羹｜三越伊勢丹法人オンライン｜請求書払い</title></head>
  <body>
    <h1>とらや 羊羹</h1>
    <p class="price">5,400円（税込）</p>
    <p class="stock">在庫あり</p>
    <img src="https://example.com/img/goods/yokan.jpg">
  </body>
</html>
`

test('isSiteChromeProductName detects site-only titles', () => {
  assert.equal(isSiteChromeProductName('三越伊勢丹法人オンライン｜請求書払い'), true)
  assert.equal(isSiteChromeProductName('とらや 羊羹｜三越伊勢丹法人オンライン｜請求書払い'), false)
  assert.equal(isSiteChromeProductName(''), false)
})

test('isDiscontinuedStubPage detects handling-ended copy', () => {
  const $ = cheerio.load(stubHtml)
  assert.equal(isDiscontinuedStubPage($), true)
  const $real = cheerio.load(realHtml)
  assert.equal(isDiscontinuedStubPage($real), false)
})

test('parseProductPage skips stub name, price, and images', () => {
  const parsed = parseProductPage(stubHtml, 'https://www.mistore.jp.e.em.hp.transer.com/shop/g/gE080-823/')
  assert.ok(parsed)
  assert.equal(parsed?.product_code, 'gE080-823')
  assert.equal(parsed?.product_name, '')
  assert.equal(parsed?.price_incl_tax, undefined)
  assert.equal(parsed?.image_urls, undefined)
  assert.match(parsed?.availability || '', /販売終了/)
})

test('parseProductPage still extracts a real product', () => {
  const parsed = parseProductPage(realHtml, 'https://www.mistore.jp.e.em.hp.transer.com/shop/g/gXXXX-001/')
  assert.ok(parsed)
  assert.equal(parsed?.product_code, 'gXXXX-001')
  assert.match(parsed?.product_name || '', /とらや/)
  assert.equal(parsed?.price_incl_tax, 5400)
  assert.ok(parsed?.image_urls && parsed.image_urls.length > 0)
})

console.log('\nAll productParser tests passed.')
