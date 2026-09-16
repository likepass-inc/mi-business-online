import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dbPath = path.join(os.tmpdir(), `mi-products-season-test-${process.pid}.db`)
process.env.DB_PATH = dbPath
process.env.DB_DIR = os.tmpdir()
process.env.SEASON_MAP_ACTIVE_AT = '2099-01-01T00:00:00.000Z'

async function main() {
  const {
    saveProduct,
    getProductByCode,
    getProductsByCodes,
    searchProducts,
    seedSeasonMapProducts,
    clearSeasonMapPlaceholderAvailability,
  } = await import('./productRepository')
  const { closeDatabase } = await import('./schema')

  function test(name: string, fn: () => void) {
    try {
      fn()
      console.log(`✓ ${name}`)
    } catch (e) {
      console.error(`✗ ${name}`)
      throw e
    }
  }

  saveProduct({
    product_code: 'gR600-303S26',
    product_name: 'スヌーピー ウォッシュタオルセット *',
    price_incl_tax: 3240,
    product_url: 'https://business.mistore.jp/shop/g/gR600-303S26',
    image_urls: ['https://example.com/ss.jpg'],
    availability: '在庫あり',
  })
  saveProduct({
    product_code: 'gR600-303F26',
    product_name: 'スヌーピー ウォッシュタオルセット',
    price_incl_tax: 3510,
    product_url: 'https://business.mistore.jp/shop/g/gR600-303F26',
    image_urls: ['https://example.com/fw.jpg'],
    availability: '在庫あり',
  })
  saveProduct({
    product_code: 'gM674-413S26',
    product_name: '【お香典返し】栗鹿ノ子ミニ６個入',
    price_incl_tax: 2160,
    product_url: 'https://business.mistore.jp/shop/g/gM674-413S26',
    availability: '販売を終了いたしました',
  })

  test('before switch, SS codes still resolve to SS', () => {
    process.env.SEASON_MAP_ACTIVE_AT = '2099-01-01T00:00:00.000Z'
    const product = getProductByCode('gR600-303S26')
    assert.equal(product?.product_code, 'gR600-303S26')
    assert.equal(product?.price_incl_tax, 3240)
    const batch = getProductsByCodes(['R600-303S26'])
    assert.equal(batch[0]?.product_code, 'R600-303S26')
    assert.match(batch[0]?.product_url || '', /S26/)
  })

  test('before switch, FW direct lookup still works', () => {
    process.env.SEASON_MAP_ACTIVE_AT = '2099-01-01T00:00:00.000Z'
    const product = getProductByCode('R600-303F26')
    assert.equal(normalizeLater(product?.product_code), 'r600-303f26')
    assert.equal(product?.price_incl_tax, 3510)
  })

  test('after switch, SS lookup returns FW data and URL', () => {
    process.env.SEASON_MAP_ACTIVE_AT = '2020-01-01T00:00:00.000Z'
    const canonical = getProductByCode('gR600-303S26')
    assert.equal(normalizeLater(canonical?.product_code), 'r600-303f26')
    assert.equal(canonical?.price_incl_tax, 3510)
    assert.match(canonical?.product_url || '', /F26/)
    assert.equal(canonical?.requested_product_code, 'gR600-303S26')

    const batch = getProductsByCodes(['R600-303S26', 'gR600-303S26'])
    assert.equal(batch.length, 2)
    assert.equal(batch[0]?.product_code, 'R600-303S26')
    assert.equal(batch[0]?.price_incl_tax, 3510)
    assert.match(batch[0]?.product_url || '', /F26/)
    assert.equal(normalizeLater(batch[0]?.canonical_product_code), 'r600-303f26')
  })

  test('after switch, M→R exception maps without suffix-only rewrite', () => {
    process.env.SEASON_MAP_ACTIVE_AT = '2020-01-01T00:00:00.000Z'
    const product = getProductsByCodes(['M674-413S26'])[0]
    assert.ok(product)
    assert.equal(product.product_code, 'M674-413S26')
    assert.match(product.product_url, /gR674-413F26/)
    assert.equal(product.product_name, '栗鹿ノ子ミニ６個入')
    assert.equal(product.availability, undefined)
  })

  test('after switch, missing FW falls back to SS snapshot with FW URL', () => {
    process.env.SEASON_MAP_ACTIVE_AT = '2020-01-01T00:00:00.000Z'
    const product = getProductByCode('R698-103S26')
    assert.ok(product)
    assert.match(product.product_url, /R698-103F26/)
    assert.equal(product.product_name, 'タオルセット')
    assert.equal(normalizeLater(product.canonical_product_code), 'r698-103f26')
  })

  test('search includes product codes and hides superseded SS after switch', () => {
    process.env.SEASON_MAP_ACTIVE_AT = '2020-01-01T00:00:00.000Z'
    const byCode = searchProducts('R600-303S26', 10, 0)
    assert.ok(byCode.products.length >= 1)
    assert.equal(normalizeLater(byCode.products[0]?.canonical_product_code || byCode.products[0]?.product_code), 'r600-303f26')
    assert.equal(
      byCode.products.some((product) => normalizeLater(product.product_code) === 'r600-303s26'),
      false
    )
  })

  test('seed inserts missing FW rows from the map', () => {
    process.env.SEASON_MAP_ACTIVE_AT = '2020-01-01T00:00:00.000Z'
    const result = seedSeasonMapProducts()
    assert.ok(result.inserted > 400)
    const seeded = getProductByCode('gR698-573F26')
    assert.equal(seeded?.product_name, 'ＨＡＲＵＫＡ バスタオルセット')
  })

  test('placeholder FW rows do not keep stub discontinued flags', () => {
    saveProduct({
      product_code: 'gR698-113F26',
      product_name: 'タオルセット',
      product_url: 'https://business.mistore.jp/shop/g/gR698-113F26',
      availability: '販売終了',
    })
    const cleared = clearSeasonMapPlaceholderAvailability()
    assert.ok(cleared >= 1)
    const product = getProductByCode('gR698-113F26')
    assert.equal(product?.product_name, 'タオルセット')
    assert.equal(product?.availability, undefined)
  })

  closeDatabase()
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(dbPath + suffix)
    } catch {
      // ignore
    }
  }

  console.log('\nAll productRepository season tests passed.')
}

function normalizeLater(code: string | undefined): string {
  return String(code || '').replace(/^[gG]+/, '').toLowerCase()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
