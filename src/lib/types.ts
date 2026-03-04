export interface DateRange {
  startDate: string
  endDate: string
}

export interface GA4Request {
  dateRange: DateRange
  metrics: string[]
  dimensions?: string[]
  filters?: GA4Filter[]
}

export interface GA4Filter {
  field: string
  operator: 'EXACT' | 'CONTAINS' | 'REGEXP' | 'PARTIAL'
  value: string
}

export interface GA4Response {
  rows: Record<string, string | number>[]
}

export interface GSCRequest {
  startDate: string
  endDate: string
  dimensions?: string[]
  rowLimit?: number
}

export interface GSCRow {
  query?: string
  page?: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCResponse {
  rows: GSCRow[]
}

export interface ChatRequest {
  message: string
  keyword?: string
  landingPage?: string
}

export interface ChatResponse {
  analysis: string
  rawData?: {
    source: 'GA4' | 'GSC'
    metrics: string[]
    rows: Record<string, string | number>[]
  }
}

export interface ParsedQuery {
  source: 'GA4' | 'GSC'
  dateRange: DateRange
  metrics: string[]
  dimensions?: string[]
  filters?: GA4Filter[]
}

// マガジン記事-商品連携API用の型定義
export interface Product {
  product_code: string
  product_name: string
  brand_name: string
  category: string
  sub_category: string
  price_excl_tax: number
  price_incl_tax: number
  description: string
  product_url: string
  image_url?: string
  image_urls?: string[]
  match_score?: number
  tags: string[]
  availability?: string
  created_at?: string
  updated_at?: string
}

export interface RelatedProductsRequest {
  article_id: string
  category?: string
  tags?: string[]
  keywords?: string[]
  limit?: number
  min_price?: number
  max_price?: number
}

export interface RelatedProductsResponse {
  success: boolean
  article_id: string
  total_products: number
  products: Product[]
  metadata: {
    category: string
    match_score_threshold: number
    execution_time_ms: number
  }
}

export interface CategoryProductsRequest {
  category: string
  limit?: number
  sort?: 'price_asc' | 'price_desc' | 'popular' | 'new'
  page?: number
}

export interface CategoryProductsResponse {
  success: boolean
  category: string
  total_products: number
  page: number
  limit: number
  products: Product[]
}

export interface ArticleCategory {
  name: string
  tags: string[]
  keywords: string[]
  typical_budget_min: number
  typical_budget_max: number
}

