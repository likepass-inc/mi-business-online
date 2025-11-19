import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { GSCRequest, GSCResponse, GSCRow } from './types'

let authClient: any = null

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

function getAuthClient() {
  if (!authClient) {
    const { clientEmail, privateKey } = loadCredentials()

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
  // デフォルトで business.mistore.jp を使用
  const siteUrl = process.env.GSC_SITE_URL || 'https://business.mistore.jp/'

  if (!siteUrl) {
    throw new Error('GSC_SITE_URL must be set')
  }

  const searchconsole = google.searchconsole('v1')

  const dimensions = request.dimensions && request.dimensions.length > 0 ? request.dimensions : undefined
  const rowLimit = request.rowLimit || 1000

  const requestBody: any = {
    startDate: request.startDate,
    endDate: request.endDate,
    rowLimit,
  }

  if (dimensions) {
    requestBody.dimensions = dimensions
  }

  const response = await searchconsole.searchanalytics.query({
    auth,
    siteUrl,
    requestBody,
  })

  const rows: GSCRow[] =
    response.data.rows?.map((row) => {
      const result: GSCRow = {
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
      }

      if (row.keys && dimensions && dimensions.includes('query')) {
        const queryIndex = dimensions.indexOf('query')
        if (queryIndex >= 0 && row.keys[queryIndex]) {
          result.query = row.keys[queryIndex]
        }
      }

      if (row.keys && dimensions && dimensions.includes('page')) {
        const pageIndex = dimensions.indexOf('page')
        if (pageIndex >= 0 && row.keys[pageIndex]) {
          result.page = row.keys[pageIndex]
        }
      }

      return result
    }) || []

  return { rows }
}

