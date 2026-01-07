import { getDatabase } from './schema'
import type { Product } from '../types'

export interface ProductData {
  product_code: string
  product_name: string
  price_incl_tax?: number
  price_excl_tax?: number
  description?: string
  category?: string
  sub_category?: string
  product_url: string
  image_urls?: string[]
  availability?: string
}

export interface ProductQuery {
  category?: string
  limit?: number
  offset?: number
  sort?: 'name' | 'price_asc' | 'price_desc' | 'updated_desc'
}

export function saveProduct(productData: ProductData): void {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    INSERT INTO products (
      product_code, product_name, price_incl_tax, price_excl_tax,
      description, category, sub_category, product_url,
      image_urls, availability, last_crawled_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_code) DO UPDATE SET
      product_name = excluded.product_name,
      price_incl_tax = excluded.price_incl_tax,
      price_excl_tax = excluded.price_excl_tax,
      description = excluded.description,
      category = excluded.category,
      sub_category = excluded.sub_category,
      product_url = excluded.product_url,
      image_urls = excluded.image_urls,
      availability = excluded.availability,
      last_crawled_at = CURRENT_TIMESTAMP
  `)

  stmt.run(
    productData.product_code,
    productData.product_name,
    productData.price_incl_tax || null,
    productData.price_excl_tax || null,
    productData.description || null,
    productData.category || null,
    productData.sub_category || null,
    productData.product_url,
    productData.image_urls ? JSON.stringify(productData.image_urls) : null,
    productData.availability || null
  )
}

export function batchSaveProducts(products: ProductData[]): void {
  const db = getDatabase()
  const transaction = db.transaction((products: ProductData[]) => {
    for (const product of products) {
      saveProduct(product)
    }
  })

  transaction(products)
}

export function getProductByCode(productCode: string): Product | null {
  const db = getDatabase()
  
  const row = db.prepare(`
    SELECT * FROM products WHERE product_code = ?
  `).get(productCode) as any

  if (!row) {
    return null
  }

  return {
    product_code: row.product_code,
    product_name: row.product_name,
    brand_name: '', // データベースに保存されていない場合は空文字
    category: row.category || '',
    sub_category: row.sub_category || '',
    price_excl_tax: row.price_excl_tax || 0,
    price_incl_tax: row.price_incl_tax || 0,
    description: row.description || '',
    product_url: row.product_url,
    image_url: row.image_urls ? JSON.parse(row.image_urls)[0] : undefined,
    tags: [],
    ...(row.image_urls && { image_urls: JSON.parse(row.image_urls) }),
    ...(row.availability && { availability: row.availability })
  }
}

export function getAllProducts(query: ProductQuery = {}): {
  products: Product[]
  total: number
} {
  const db = getDatabase()
  
  const { category, limit = 100, offset = 0, sort = 'updated_desc' } = query
  
  let whereClause = ''
  const params: any[] = []
  
  if (category) {
    whereClause = 'WHERE category = ?'
    params.push(category)
  }
  
  let orderClause = 'ORDER BY updated_at DESC'
  switch (sort) {
    case 'name':
      orderClause = 'ORDER BY product_name ASC'
      break
    case 'price_asc':
      orderClause = 'ORDER BY price_incl_tax ASC'
      break
    case 'price_desc':
      orderClause = 'ORDER BY price_incl_tax DESC'
      break
    case 'updated_desc':
      orderClause = 'ORDER BY updated_at DESC'
      break
  }
  
  // 総数を取得
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM products ${whereClause}`)
  const total = (countStmt.get(...params) as any).count
  
  // 商品を取得
  const stmt = db.prepare(`
    SELECT * FROM products
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `)
  
  const rows = stmt.all(...params, limit, offset) as any[]
  
  const products: Product[] = rows.map(row => ({
    product_code: row.product_code,
    product_name: row.product_name,
    brand_name: '',
    category: row.category || '',
    sub_category: row.sub_category || '',
    price_excl_tax: row.price_excl_tax || 0,
    price_incl_tax: row.price_incl_tax || 0,
    description: row.description || '',
    product_url: row.product_url,
    image_url: row.image_urls ? JSON.parse(row.image_urls)[0] : undefined,
    tags: [],
    ...(row.image_urls && { image_urls: JSON.parse(row.image_urls) }),
    ...(row.availability && { availability: row.availability })
  }))
  
  return { products, total }
}

export function getProductsByCategory(category: string, limit = 100, offset = 0): {
  products: Product[]
  total: number
} {
  return getAllProducts({ category, limit, offset })
}

export function searchProducts(keyword: string, limit = 100, offset = 0): {
  products: Product[]
  total: number
} {
  const db = getDatabase()
  
  const searchTerm = `%${keyword}%`
  
  // 総数を取得
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM products
    WHERE product_name LIKE ? OR description LIKE ?
  `)
  const total = (countStmt.get(searchTerm, searchTerm) as any).count
  
  // 商品を取得
  const stmt = db.prepare(`
    SELECT * FROM products
    WHERE product_name LIKE ? OR description LIKE ?
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `)
  
  const rows = stmt.all(searchTerm, searchTerm, limit, offset) as any[]
  
  const products: Product[] = rows.map(row => ({
    product_code: row.product_code,
    product_name: row.product_name,
    brand_name: '',
    category: row.category || '',
    sub_category: row.sub_category || '',
    price_excl_tax: row.price_excl_tax || 0,
    price_incl_tax: row.price_incl_tax || 0,
    description: row.description || '',
    product_url: row.product_url,
    image_url: row.image_urls ? JSON.parse(row.image_urls)[0] : undefined,
    tags: [],
    ...(row.image_urls && { image_urls: JSON.parse(row.image_urls) }),
    ...(row.availability && { availability: row.availability })
  }))
  
  return { products, total }
}

export function deleteStaleProducts(thresholdDate: Date): number {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    DELETE FROM products
    WHERE last_crawled_at < ? OR last_crawled_at IS NULL
  `)
  
  const result = stmt.run(thresholdDate.toISOString())
  return result.changes
}

export function getProductsNeedingUpdate(daysSinceLastCrawl = 7): ProductData[] {
  const db = getDatabase()
  
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - daysSinceLastCrawl)
  
  const stmt = db.prepare(`
    SELECT product_url FROM products
    WHERE last_crawled_at < ? OR last_crawled_at IS NULL
  `)
  
  const rows = stmt.all(thresholdDate.toISOString()) as any[]
  return rows.map(row => ({ product_url: row.product_url } as ProductData))
}

// クロールログ関連
export interface CrawlLog {
  id: number
  crawl_type: 'full' | 'incremental'
  started_at: string
  completed_at: string | null
  total_urls: number
  success_count: number
  error_count: number
  status: 'running' | 'completed' | 'failed'
  error_message: string | null
}

export function createCrawlLog(crawlType: 'full' | 'incremental'): number {
  const db = getDatabase()
  
  const stmt = db.prepare(`
    INSERT INTO crawl_logs (crawl_type, status)
    VALUES (?, 'running')
  `)
  
  const result = stmt.run(crawlType)
  return Number(result.lastInsertRowid)
}

export function updateCrawlLog(
  logId: number,
  updates: {
    completed_at?: Date
    total_urls?: number
    success_count?: number
    error_count?: number
    status?: 'running' | 'completed' | 'failed'
    error_message?: string
  }
): void {
  const db = getDatabase()
  
  const fields: string[] = []
  const values: any[] = []
  
  if (updates.completed_at !== undefined) {
    fields.push('completed_at = ?')
    values.push(updates.completed_at.toISOString())
  }
  if (updates.total_urls !== undefined) {
    fields.push('total_urls = ?')
    values.push(updates.total_urls)
  }
  if (updates.success_count !== undefined) {
    fields.push('success_count = ?')
    values.push(updates.success_count)
  }
  if (updates.error_count !== undefined) {
    fields.push('error_count = ?')
    values.push(updates.error_count)
  }
  if (updates.status !== undefined) {
    fields.push('status = ?')
    values.push(updates.status)
  }
  if (updates.error_message !== undefined) {
    fields.push('error_message = ?')
    values.push(updates.error_message)
  }
  
  if (fields.length === 0) {
    return
  }
  
  values.push(logId)
  
  const stmt = db.prepare(`
    UPDATE crawl_logs
    SET ${fields.join(', ')}
    WHERE id = ?
  `)
  
  stmt.run(...values)
}

export function getLatestCrawlLog(): CrawlLog | null {
  const db = getDatabase()
  
  const row = db.prepare(`
    SELECT * FROM crawl_logs
    ORDER BY started_at DESC
    LIMIT 1
  `).get() as any
  
  if (!row) {
    return null
  }
  
  return {
    id: row.id,
    crawl_type: row.crawl_type,
    started_at: row.started_at,
    completed_at: row.completed_at,
    total_urls: row.total_urls,
    success_count: row.success_count,
    error_count: row.error_count,
    status: row.status,
    error_message: row.error_message
  }
}

