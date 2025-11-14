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

