import assert from 'node:assert/strict'
import {
  crawlTargetForCode,
  indexedProductNeedsShopRefresh,
  productLacksCatalog,
} from './crawlSingleProduct'
import type { Product } from './types'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}`)
    throw e
  }
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    product_code: 'gR672-753F26',
    product_name: '焼菓子アソート',
    brand_name: '',
    category: '',
    sub_category: '',
    price_excl_tax: 0,
    price_incl_tax: 0,
    description: '',
    product_url: 'https://business.mistore.jp/shop/g/gR672-753F26',
    tags: [],
    ...overrides,
  }
}

test('name-only seasonal stubs lack catalog and need refresh', () => {
  const stub = product()
  assert.equal(productLacksCatalog(stub), true)
  assert.equal(indexedProductNeedsShopRefresh(stub), true)
})

test('complete catalog products skip refresh', () => {
  const live = product({
    price_incl_tax: 5400,
    image_url: 'https://business.mistore.jp/img/goods/L/020W-480_2506_1.jpg',
  })
  assert.equal(productLacksCatalog(live), false)
  assert.equal(indexedProductNeedsShopRefresh(live), false)
})

test('discontinued stubs without catalog are not recrawled', () => {
  const ended = product({ availability: '販売終了' })
  assert.equal(indexedProductNeedsShopRefresh(ended), false)
})

test('season codes crawl the current FW shop URL', () => {
  const fromSs = crawlTargetForCode('R672-753S26')
  assert.equal(fromSs.productCode, 'gR672-753F26')
  assert.match(fromSs.productUrl || '', /gR672-753F26/)

  const fromFw = crawlTargetForCode('gR672-753F26')
  assert.equal(fromFw.productCode, 'gR672-753F26')
  assert.match(fromFw.productUrl || '', /gR672-753F26/)
})

console.log('\nAll crawlSingleProduct tests passed.')
