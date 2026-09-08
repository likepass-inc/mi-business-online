import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dbPath = path.join(os.tmpdir(), `mi-products-stub-test-${process.pid}.db`)
process.env.DB_PATH = dbPath
process.env.DB_DIR = os.tmpdir()

async function main() {
  const { saveProduct, getProductByCode } = await import('./db/productRepository')
  const { closeDatabase } = await import('./db/schema')

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
    product_code: 'gE080-823',
    product_name: 'とらや 羊羹',
    price_incl_tax: 5400,
    product_url: 'https://example.com/shop/g/gE080-823/',
    image_urls: ['https://example.com/img/goods/yokan.jpg'],
    availability: '在庫あり',
    description: '本物の説明',
  })

  test('saveProduct keeps name, price, and images when stub payload is empty', () => {
    saveProduct({
      product_code: 'gE080-823',
      product_name: '',
      product_url: 'https://example.com/shop/g/gE080-823/',
      availability: '販売終了',
    })
    const saved = getProductByCode('gE080-823')
    assert.equal(saved?.product_name, 'とらや 羊羹')
    assert.equal(saved?.price_incl_tax, 5400)
    assert.deepEqual(saved?.image_urls, ['https://example.com/img/goods/yokan.jpg'])
    assert.equal(saved?.description, '本物の説明')
    assert.equal(saved?.availability, '販売終了')
  })

  test('saveProduct still overwrites when a real name and price arrive', () => {
    saveProduct({
      product_code: 'gE080-823',
      product_name: 'とらや 羊羹 詰合せ',
      price_incl_tax: 6480,
      product_url: 'https://example.com/shop/g/gE080-823/',
      image_urls: ['https://example.com/img/goods/yokan2.jpg'],
      availability: '在庫あり',
    })
    const saved = getProductByCode('gE080-823')
    assert.equal(saved?.product_name, 'とらや 羊羹 詰合せ')
    assert.equal(saved?.price_incl_tax, 6480)
    assert.deepEqual(saved?.image_urls, ['https://example.com/img/goods/yokan2.jpg'])
    assert.equal(saved?.availability, '在庫あり')
  })

  closeDatabase()
  try {
    fs.unlinkSync(dbPath)
    fs.unlinkSync(dbPath + '-wal')
    fs.unlinkSync(dbPath + '-shm')
  } catch {
    // ignore missing sidecar files
  }

  console.log('\nAll productRepository stub tests passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
