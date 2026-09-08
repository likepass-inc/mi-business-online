import type { CheerioAPI } from 'cheerio'

export type StockKind = 'in_stock' | 'temp_out' | 'not_available' | 'unknown'

export interface ParsedStock {
  in_stock: boolean
  stock_kind: StockKind
  stock_label: string | null
}

function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
  )
}

function ancillaryFromAlt($: CheerioAPI, selector: string): boolean {
  const el = $(selector).first()
  if (!el.length) return false
  const alt = (el.attr('alt') || '').trim()
  if (alt.includes('（あり）')) return true
  if (alt.includes('（なし）')) return false
  return false
}

export function parseNoshiAvailable($: CheerioAPI): boolean {
  return ancillaryFromAlt($, 'img[alt*="のし"]')
}

export function parseWrappingAvailable($: CheerioAPI): boolean {
  return ancillaryFromAlt($, 'img[alt*="包装紙"]')
}

export function parseHandbagAvailable($: CheerioAPI): boolean {
  return ancillaryFromAlt($, 'img[alt*="手さげ袋"]')
}

/** true=送料無料, false=送料有料, null=不明 */
export function parseShippingFree($: CheerioAPI): boolean | null {
  const shipping = $('div.shipping').first()
  if (!shipping.length) return null
  const imgs = shipping.find('ul.icoBtn li img')
  for (let i = 0; i < imgs.length; i++) {
    const alt = ($(imgs[i]).attr('alt') || '').trim()
    if (alt === '送料無料') return true
    if (alt === '送料有料') return false
  }
  return null
}

export function parseShelfLifeDays($: CheerioAPI): number | null {
  const dt = $('dt')
    .filter((_, el) => {
      const t = $(el).text().replace(/\s+/g, '')
      return t.includes('賞味期間') || t.includes('賞味期限')
    })
    .first()
  if (!dt.length) return null
  const dd = dt.next('dd')
  if (!dd.length) return null
  const text = normalizeDigits(dd.text().replace(/\s+/g, ' ').trim())
  const m = text.match(/(\d+)\s*日/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

export function parseBrandName($: CheerioAPI): string | undefined {
  const fromDdBrand = $('dd.brand a').first()
  if (fromDdBrand.length) {
    const t = fromDdBrand.text().replace(/\s+/g, ' ').trim()
    if (t) return t.substring(0, 200)
  }
  const dtBrand = $('dt')
    .filter((_, el) => {
      const text = $(el).text().replace(/\s+/g, '')
      return text === 'ブランド' || text.indexOf('ブランド') === 0
    })
    .first()
  if (dtBrand.length) {
    const dd = dtBrand.next('dd')
    if (dd.length) {
      const link = dd.find('a').first()
      const raw = link.length ? link.text() : dd.text()
      const t = raw.replace(/\s+/g, ' ').trim()
      if (t) return t.substring(0, 200)
    }
  }
  return undefined
}

export function parseEcStock($: CheerioAPI, fallbackLabel?: string | null): ParsedStock {
  const selectSku = $('section.selectSKU').first()
  let stockTextRaw = selectSku.find('p.stock').first().text().replace(/\s+/g, ' ').trim()
  if (!stockTextRaw) {
    stockTextRaw = $('p.stock').first().text().replace(/\s+/g, ' ').trim()
  }
  if (!stockTextRaw && fallbackLabel) {
    stockTextRaw = fallbackLabel
  }

  const stockText = normalizeDigits(stockTextRaw)
  const stock_label = stockTextRaw.length > 0 ? stockTextRaw.substring(0, 200) : null

  if (/販売を終了|販売終了/.test(stockText)) {
    return { in_stock: false, stock_kind: 'not_available', stock_label }
  }
  if (stockText.includes('一時欠品中')) {
    return { in_stock: false, stock_kind: 'temp_out', stock_label }
  }
  if (/在庫あり|購入可能|ご購入いただけます/.test(stockText)) {
    return { in_stock: true, stock_kind: 'in_stock', stock_label }
  }

  const remainMatch = stockText.match(/残り\s*(\d+)\s*点/)
  if (remainMatch) {
    const n = parseInt(remainMatch[1], 10)
    if (n > 0) {
      return { in_stock: true, stock_kind: 'in_stock', stock_label }
    }
    return { in_stock: false, stock_kind: 'not_available', stock_label }
  }

  if (!stockText) {
    return { in_stock: true, stock_kind: 'unknown', stock_label: null }
  }

  return { in_stock: true, stock_kind: 'unknown', stock_label }
}

/** URL の g 有無ゆれを吸収して検索用コード列を返す */
export function expandProductCodeVariants(code: string): string[] {
  const raw = (code || '').trim()
  if (!raw) return []
  const stripped = raw.replace(/^g/i, '')
  const withG = raw.toLowerCase().startsWith('g') ? raw : `g${stripped}`
  return Array.from(new Set([raw, stripped, withG, `g${stripped}`].filter(Boolean)))
}
