import { google } from 'googleapis'
import type { GSCRequest, GSCResponse, GSCRow } from './types'

let authClient: any = null

function getAuthClient() {
  if (!authClient) {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!clientEmail || !privateKey) {
      throw new Error('GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY must be set')
    }

    authClient = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
  }
  return authClient
}

export async function fetchGSCData(request: GSCRequest): Promise<GSCResponse> {
  const auth = getAuthClient()
  const siteUrl = process.env.GSC_SITE_URL

  if (!siteUrl) {
    throw new Error('GSC_SITE_URL must be set')
  }

  const searchconsole = google.searchconsole('v1')

  const dimensions = request.dimensions || ['query', 'page']
  const rowLimit = request.rowLimit || 1000

  const response = await searchconsole.searchanalytics.query({
    auth,
    siteUrl,
    requestBody: {
      startDate: request.startDate,
      endDate: request.endDate,
      dimensions,
      rowLimit,
    },
  })

  const rows: GSCRow[] =
    response.data.rows?.map((row) => {
      const result: GSCRow = {
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
      }

      if (row.keys && dimensions.includes('query')) {
        const queryIndex = dimensions.indexOf('query')
        if (queryIndex >= 0 && row.keys[queryIndex]) {
          result.query = row.keys[queryIndex]
        }
      }

      if (row.keys && dimensions.includes('page')) {
        const pageIndex = dimensions.indexOf('page')
        if (pageIndex >= 0 && row.keys[pageIndex]) {
          result.page = row.keys[pageIndex]
        }
      }

      return result
    }) || []

  return { rows }
}

