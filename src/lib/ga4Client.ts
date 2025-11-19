import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { GA4Request, GA4Response } from './types'

let client: BetaAnalyticsDataClient | null = null

function loadCredentials() {
  // 環境変数から読み込みを試みる
  let clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  
  // 環境変数が設定されていない場合、JSONファイルから読み込む
  if (!clientEmail || !privateKey) {
    try {
      const jsonPath = join(process.cwd(), 'credentials', 'service-account.json')
      const jsonContent = readFileSync(jsonPath, 'utf-8').trim()
      
      if (!jsonContent) {
        throw new Error('credentials/service-account.json is empty. Please add your service account JSON key.')
      }
      
      const serviceAccount = JSON.parse(jsonContent)
      
      if (!serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('credentials/service-account.json is missing client_email or private_key')
      }
      
      clientEmail = serviceAccount.client_email
      privateKey = serviceAccount.private_key
    } catch (error) {
      if (error instanceof Error && error.message.includes('is empty')) {
        throw error
      }
      // JSONファイルの読み込みに失敗した場合はエラーをスロー
      throw new Error('GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set, or credentials/service-account.json must contain valid service account credentials')
    }
  }
  
  return { clientEmail, privateKey }
}

function getClient(): BetaAnalyticsDataClient {
  if (!client) {
    const { clientEmail, privateKey } = loadCredentials()
    
    if (!clientEmail || !privateKey) {
      throw new Error('GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set')
    }

    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    })
  }
  return client
}

export async function fetchGA4Data(request: GA4Request): Promise<GA4Response> {
  const analyticsClient = getClient()
  const propertyId = process.env.GA4_PROPERTY_ID

  if (!propertyId) {
    throw new Error('GA4_PROPERTY_ID must be set')
  }

  // すべてのフィルタをdimensionFilterに統合
  const filters = request.filters || []
  const dimensionFilter = filters.length > 0
    ? {
        andGroup: {
          expressions: filters.map((f) => ({
            filter: {
              fieldName: f.field,
              stringFilter: {
                matchType: (f.operator === 'EXACT' ? 'EXACT' : 'CONTAINS') as 'EXACT' | 'CONTAINS',
                value: f.value,
              },
            },
          })),
        },
      }
    : undefined

  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: request.dateRange.startDate,
        endDate: request.dateRange.endDate,
      },
    ],
    metrics: request.metrics.map((m) => ({ name: m })),
    dimensions: request.dimensions?.map((d) => ({ name: d })) || [],
    dimensionFilter,
  })

  const rows =
    response.rows?.map((row) => {
      const dim: Record<string, string> = {}
      row.dimensionValues?.forEach((v, i) => {
        if (request.dimensions && request.dimensions[i]) {
          dim[request.dimensions[i]] = v.value ?? ''
        }
      })

      const met: Record<string, number> = {}
      row.metricValues?.forEach((v, i) => {
        if (request.metrics[i]) {
          met[request.metrics[i]] = Number(v.value ?? 0)
        }
      })

      return { ...dim, ...met }
    }) ?? []

  return { rows }
}

