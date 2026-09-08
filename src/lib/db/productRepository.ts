import { getDatabase } from './schema'
import type { Product } from '../types'
import { expandProductCodeVariants } from '../giftAncillary'

/** 本番では無効。開発時または DEBUG_AGENT_LOG=1 のときのみ ingest 送信する */
const isDebugAgentLogEnabled =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_AGENT_LOG === '1'

export interface ProductData {
  product_code: string
  product_name: string
  brand_name?: string
  price_incl_tax?: number
  price_excl_tax?: number
  description?: string
  category?: string
  sub_category?: string
  product_url: string
  image_urls?: string[]
  availability?: string
  in_stock?: boolean
  stock_kind?: Product['stock_kind']
  stock_label?: string
  noshi_available?: boolean
  wrapping_paper_available?: boolean
  handbag_available?: boolean
  shelf_life?: number
  shipping_free?: boolean | null
}

export interface ProductQuery {
  category?: string
  limit?: number
  offset?: number
  sort?: 'name' | 'price_asc' | 'price_desc' | 'updated_desc'
}

/**
 * データベースの行をProduct型に安全に変換するヘルパー関数
 */
function mapRowToProduct(row: any): Product {
  if (isDebugAgentLogEnabled) {
    fetch('http://127.0.0.1:7242/ingest/1be90cd4-4da8-4d6f-8e86-bafd75a39a77', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'productRepository.ts:27',
        message: 'mapRowToProduct before conversion',
        data: {
          productCode: row.product_code,
          rawImageUrls: row.image_urls?.substring(0, 100),
          rawAvailability: row.availability,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C',
      }),
    }).catch(() => {})
  }

  let imageUrls: string[] = []
  if (row.image_urls) {
    try {
      const parsed = JSON.parse(row.image_urls)
      imageUrls = Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.warn(`[ProductRepository] Failed to parse image_urls for ${row.product_code}:`, e)
      if (isDebugAgentLogEnabled) {
        fetch('http://127.0.0.1:7242/ingest/1be90cd4-4da8-4d6f-8e86-bafd75a39a77', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'productRepository.ts:27',
            message: 'mapRowToProduct JSON parse error',
            data: {
              productCode: row.product_code,
              error: String(e),
              rawImageUrls: row.image_urls?.substring(0, 100),
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {})
      }
      imageUrls = []
    }
  }

  const result: Product = {
    product_code: row.product_code,
    product_name: row.product_name,
    brand_name: row.brand_name || '',
    category: row.category || '',
    sub_category: row.sub_category || '',
    price_excl_tax: row.price_excl_tax || 0,
    price_incl_tax: row.price_incl_tax || 0,
    description: row.description || '',
    product_url: row.product_url,
    image_url: imageUrls.length > 0 ? imageUrls[0] : undefined,
    image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    tags: [],
    availability: row.availability || row.stock_label || undefined,
    in_stock: row.in_stock == null ? undefined : Boolean(row.in_stock),
    stock_kind: row.stock_kind || undefined,
    stock_label: row.stock_label || row.availability || undefined,
    noshi_available: Boolean(row.noshi_available),
    wrapping_paper_available: Boolean(row.wrapping_paper_available),
    handbag_available: Boolean(row.handbag_available),
    shelf_life: row.shelf_life != null ? Number(row.shelf_life) : undefined,
    shipping_free: row.shipping_free == null ? null : Boolean(row.shipping_free),
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
  }

  if (isDebugAgentLogEnabled) {
    fetch('http://127.0.0.1:7242/ingest/1be90cd4-4da8-4d6f-8e86-bafd75a39a77', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'productRepository.ts:27',
        message: 'mapRowToProduct after conversion',
        data: {
          productCode: result.product_code,
          hasImageUrl: !!result.image_url,
          hasImageUrls: !!result.image_urls,
          imageUrlsCount: result.image_urls?.length || 0,
          availability: result.availability,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C',
      }),
    }).catch(() => {})
  }

  return result
}

export function saveProduct(productData: ProductData): void {
  const db = getDatabase()
  const imageUrlsJson = productData.image_urls ? JSON.stringify(productData.image_urls) : null

  if (isDebugAgentLogEnabled) {
    fetch('http://127.0.0.1:7242/ingest/1be90cd4-4da8-4d6f-8e86-bafd75a39a77', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'productRepository.ts:56',
        message: 'saveProduct before save',
        data: {
          productCode: productData.product_code,
          hasImageUrls: !!productData.image_urls,
          imageUrlsCount: productData.image_urls?.length || 0,
          imageUrlsJson: imageUrlsJson?.substring(0, 100),
          availability: productData.availability,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'B',
      }),
    }).catch(() => {})
  }

  const stmt = db.prepare(`
    INSERT INTO products (
      product_code, product_name, brand_name, price_incl_tax, price_excl_tax,
      description, category, sub_category, product_url,
      image_urls, availability, in_stock, stock_kind, stock_label,
      noshi_available, wrapping_paper_available, handbag_available,
      shelf_life, shipping_free, last_crawled_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_code) DO UPDATE SET
      product_name = excluded.product_name,
      brand_name = excluded.brand_name,
      price_incl_tax = excluded.price_incl_tax,
      price_excl_tax = excluded.price_excl_tax,
      description = excluded.description,
      category = excluded.category,
      sub_category = excluded.sub_category,
      product_url = excluded.product_url,
      image_urls = excluded.image_urls,
      availability = excluded.availability,
      in_stock = excluded.in_stock,
      stock_kind = excluded.stock_kind,
      stock_label = excluded.stock_label,
      noshi_available = excluded.noshi_available,
      wrapping_paper_available = excluded.wrapping_paper_available,
      handbag_available = excluded.handbag_available,
      shelf_life = excluded.shelf_life,
      shipping_free = excluded.shipping_free,
      last_crawled_at = CURRENT_TIMESTAMP
  `)

  const toInt = (v: boolean | undefined) => (v ? 1 : 0)
  const shipping =
    productData.shipping_free === null || productData.shipping_free === undefined
      ? null
      : productData.shipping_free
        ? 1
        : 0

  stmt.run(
    productData.product_code,
    productData.product_name,
    productData.brand_name || null,
    productData.price_incl_tax || null,
    productData.price_excl_tax || null,
    productData.description || null,
    productData.category || null,
    productData.sub_category || null,
    productData.product_url,
    imageUrlsJson,
    productData.availability || productData.stock_label || null,
    productData.in_stock == null ? null : toInt(productData.in_stock),
    productData.stock_kind || null,
    productData.stock_label || productData.availability || null,
    toInt(productData.noshi_available),
    toInt(productData.wrapping_paper_available),
    toInt(productData.handbag_available),
    productData.shelf_life ?? null,
    shipping
  )

  if (isDebugAgentLogEnabled) {
    const savedRow = db
      .prepare('SELECT image_urls, availability FROM products WHERE product_code = ?')
      .get(productData.product_code) as any
    fetch('http://127.0.0.1:7242/ingest/1be90cd4-4da8-4d6f-8e86-bafd75a39a77', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'productRepository.ts:56',
        message: 'saveProduct after save',
        data: {
          productCode: productData.product_code,
          savedImageUrls: savedRow?.image_urls?.substring(0, 100),
          savedAvailability: savedRow?.availability,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'B',
      }),
    }).catch(() => {})
  }
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
  const variants = expandProductCodeVariants(productCode)
  if (variants.length === 0) return null

  const placeholders = variants.map(() => '?').join(',')
  const row = db.prepare(`
    SELECT * FROM products WHERE product_code IN (${placeholders}) LIMIT 1
  `).get(...variants) as any

  if (!row) {
    return null
  }

  return mapRowToProduct(row)
}

export function getProductsByCodes(productCodes: string[]): Product[] {
  const db = getDatabase()

  if (productCodes.length === 0) {
    return []
  }

  const uniqueCodes = Array.from(new Set(productCodes.map((c) => c.trim()).filter(Boolean)))
  const variants = Array.from(new Set(uniqueCodes.flatMap(expandProductCodeVariants)))

  const placeholders = variants.map(() => '?').join(',')

  const stmt = db.prepare(`
    SELECT * FROM products
    WHERE product_code IN (${placeholders})
  `)

  const rows = stmt.all(...variants) as any[]

  const byNormalized = new Map<string, any>()
  for (const row of rows) {
    for (const v of expandProductCodeVariants(row.product_code)) {
      byNormalized.set(v, row)
    }
  }

  const products: Product[] = []
  const seen = new Set<string>()
  for (const code of uniqueCodes) {
    const row = expandProductCodeVariants(code)
      .map((v) => byNormalized.get(v))
      .find(Boolean)
    if (row && !seen.has(row.product_code)) {
      seen.add(row.product_code)
      products.push(mapRowToProduct(row))
    }
  }

  const notFoundCodes = uniqueCodes.filter(
    (code) => !expandProductCodeVariants(code).some((v) => byNormalized.has(v))
  )
  if (notFoundCodes.length > 0) {
    console.log(`[ProductRepository] Products not found: ${notFoundCodes.join(', ')}`)
  }

  return products
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
  
  const products: Product[] = rows.map(row => mapRowToProduct(row))
  
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
    WHERE product_name LIKE ? OR description LIKE ? OR brand_name LIKE ? OR product_code LIKE ?
  `)
  const total = (countStmt.get(searchTerm, searchTerm, searchTerm, searchTerm) as any).count
  
  // 商品を取得
  const stmt = db.prepare(`
    SELECT * FROM products
    WHERE product_name LIKE ? OR description LIKE ? OR brand_name LIKE ? OR product_code LIKE ?
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `)

  const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm, limit, offset) as any[]
  
  const products: Product[] = rows.map(row => mapRowToProduct(row))
  
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

/** 販売終了を示す availability の値（完全一致用） */
export const AVAILABILITY_DISCONTINUED = '販売を終了いたしました'
/** 販売終了の部分一致（パーサーが「販売終了」のみ保存する場合に対応） */
const AVAILABILITY_DISCONTINUED_LIKE = '%販売終了%'

export function getNewProducts(
  days: number,
  limit = 100,
  offset = 0
): { products: Product[]; total: number } {
  const db = getDatabase()
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  // created_at が直近N日以内にDBに登録された商品（初回クロールで取り込まれた商品を含む）
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM products WHERE created_at >= ?
  `)
  const total = (countStmt.get(sinceIso) as any).count

  const stmt = db.prepare(`
    SELECT * FROM products
    WHERE created_at >= ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(sinceIso, limit, offset) as any[]
  const products: Product[] = rows.map(row => mapRowToProduct(row))
  return { products, total }
}

export function getDiscontinuedProducts(
  limit = 100,
  offset = 0
): { products: Product[]; total: number } {
  const db = getDatabase()

  // 完全一致に加え、LIKE で「販売終了」を含む行も対象（パーサーが「販売終了」のみ保存する場合に対応）
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM products
    WHERE availability = ? OR (availability IS NOT NULL AND availability LIKE ?)
  `)
  const total = (countStmt.get(AVAILABILITY_DISCONTINUED, AVAILABILITY_DISCONTINUED_LIKE) as any).count

  const stmt = db.prepare(`
    SELECT * FROM products
    WHERE availability = ? OR (availability IS NOT NULL AND availability LIKE ?)
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(AVAILABILITY_DISCONTINUED, AVAILABILITY_DISCONTINUED_LIKE, limit, offset) as any[]
  const products: Product[] = rows.map(row => mapRowToProduct(row))
  return { products, total }
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

