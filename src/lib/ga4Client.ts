import { BetaAnalyticsDataClient } from '@google-analytics/data'
import type { GA4Request, GA4Response } from './types'

let client: BetaAnalyticsDataClient | null = null

function getClient(): BetaAnalyticsDataClient {
  if (!client) {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    
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
    dimensionFilter: request.filters && request.filters.length > 0
      ? {
          andGroup: {
            expressions: request.filters.map((f) => ({
              filter: {
                fieldName: f.field,
                stringFilter: {
                  matchType: f.operator === 'EXACT' ? 'EXACT' : 'CONTAINS',
                  value: f.value,
                },
              },
            })),
          },
        }
      : undefined,
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

