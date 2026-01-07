import type { Product, ArticleCategory } from './types'
import fs from 'fs'
import path from 'path'

// 商品データのキャッシュ
let productsCache: Product[] = []
let lastLoadTime: number | null = null
const CACHE_DURATION = 3600000 // 1時間

// カテゴリマッピング（記事IDまたはカテゴリ名から設定を取得）
export const CATEGORY_MAPPING: Record<string, ArticleCategory> = {
  "315": { // お詫び・謝罪記事
    name: "お詫び・謝罪",
    tags: ["法人向けお詫びギフト・謝罪の品"],
    keywords: ["お詫び", "謝罪", "菓子折り", "手土産"],
    typical_budget_min: 3000,
    typical_budget_max: 10000
  },
  "2638": { // 退職記事
    name: "退職",
    tags: ["退職記念品・退職祝いギフト"],
    keywords: ["退職", "お礼", "お菓子", "個包装"],
    typical_budget_min: 1000,
    typical_budget_max: 5000
  },
  "3033": { // 差し入れ記事
    name: "差し入れ・手土産",
    tags: ["法人向け手土産・差し入れギフト"],
    keywords: ["差し入れ", "手土産", "個包装", "お菓子"],
    typical_budget_min: 1000,
    typical_budget_max: 5000
  },
  "お詫び・謝罪": {
    name: "お詫び・謝罪",
    tags: ["法人向けお詫びギフト・謝罪の品"],
    keywords: ["お詫び", "謝罪", "菓子折り", "手土産"],
    typical_budget_min: 3000,
    typical_budget_max: 10000
  },
  "退職": {
    name: "退職",
    tags: ["退職記念品・退職祝いギフト"],
    keywords: ["退職", "お礼", "お菓子", "個包装"],
    typical_budget_min: 1000,
    typical_budget_max: 5000
  },
  "差し入れ・手土産": {
    name: "差し入れ・手土産",
    tags: ["法人向け手土産・差し入れギフト"],
    keywords: ["差し入れ", "手土産", "個包装", "お菓子"],
    typical_budget_min: 1000,
    typical_budget_max: 5000
  },
  "お祝い": {
    name: "お祝い",
    tags: ["法人向けお祝い・記念品ギフト", "胡蝶蘭"],
    keywords: ["お祝い", "就任", "昇進"],
    typical_budget_min: 5000,
    typical_budget_max: 20000
  }
}

// タグを抽出
function extractTags(row: Record<string, string>): string[] {
  const tags: string[] = []
  const tagColumns = [
    '周年記念ギフト・記念品',
    '法人向けお詫びギフト・謝罪の品',
    '退職記念品・退職祝いギフト',
    '法人向け手土産・差し入れギフト',
    '法人向けお祝い・記念品ギフト',
    '胡蝶蘭'
  ]
  
  tagColumns.forEach(col => {
    if (row[col] === '○' || row[col] === 'true' || row[col] === '1') {
      tags.push(col)
    }
  })
  
  return tags
}

// 商品画像URLを生成
function generateImageUrl(productCode: string): string {
  // 実際の画像URLロジックに応じて調整
  return `https://business.mistore.jp/images/products/${productCode}.jpg`
}

// CSVから商品データを読み込み
export async function loadProducts(force = false): Promise<Product[]> {
  if (!force && productsCache.length > 0 && 
      lastLoadTime && Date.now() - lastLoadTime < CACHE_DURATION) {
    return productsCache
  }
  
  // CSVファイルのパスを環境変数から取得、またはデフォルトパスを使用
  const csvPath = process.env.PRODUCT_CSV_PATH || 
    path.join(process.cwd(), 'data', 'AIチャットボット用商品情報_UTF8.csv')
  
  // ファイルが存在しない場合は空配列を返す
  if (!fs.existsSync(csvPath)) {
    console.warn(`Product CSV file not found at: ${csvPath}`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const products: Product[] = []
    const fileContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = fileContent.split('\n')
    
    if (lines.length === 0) {
      resolve([])
      return
    }
    
    // ヘッダー行を取得
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    
    // データ行を処理
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // CSVの値をパース（カンマ区切り、ダブルクォート対応）
      const values: string[] = []
      let currentValue = ''
      let inQuotes = false
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim())
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      values.push(currentValue.trim())
      
      // ヘッダーと値をマッピング
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      
      // 商品データを作成
      const product: Product = {
        product_code: row['商品コード'] || '',
        product_name: row['商品名'] || '',
        brand_name: row['ブランド名'] || '',
        category: row['大カテゴリ'] || '',
        sub_category: row['中カテゴリ'] || '',
        price_excl_tax: parseInt(row['税抜価格']) || 0,
        price_incl_tax: parseInt(row['税込価格']) || 0,
        description: row['商品説明'] || '',
        product_url: row['ＵＲＬ'] || row['URL'] || '',
        tags: extractTags(row),
        image_url: generateImageUrl(row['商品コード'] || '')
      }
      
      // 必須フィールドがある場合のみ追加
      if (product.product_code && product.product_name) {
        products.push(product)
      }
    }
    
    productsCache = products
    lastLoadTime = Date.now()
    console.log(`Loaded ${products.length} products from CSV`)
    resolve(products)
  })
}

// スコア計算
export function calculateMatchScore(
  articleCategory: ArticleCategory,
  product: Product
): number {
  let score = 0
  
  // タグマッチング（50点）
  if (product.tags.some(tag => articleCategory.tags.includes(tag))) {
    score += 50
  }
  
  // キーワードマッチング（30点）
  const searchText = (product.product_name + ' ' + product.description).toLowerCase()
  const keywordMatches = articleCategory.keywords.filter(keyword => {
    return searchText.includes(keyword.toLowerCase())
  })
  score += Math.min(keywordMatches.length * 10, 30)
  
  // 価格帯適合性（10点）
  if (product.price_incl_tax >= articleCategory.typical_budget_min &&
      product.price_incl_tax <= articleCategory.typical_budget_max) {
    score += 10
  }
  
  // 商品説明の充実度（10点）
  if (product.description && product.description.length > 50) {
    score += 10
  }
  
  return score
}

// 記事カテゴリを取得
export function getArticleCategory(
  articleId?: string,
  category?: string
): ArticleCategory | null {
  if (articleId && CATEGORY_MAPPING[articleId]) {
    return CATEGORY_MAPPING[articleId]
  }
  if (category && CATEGORY_MAPPING[category]) {
    return CATEGORY_MAPPING[category]
  }
  return null
}

