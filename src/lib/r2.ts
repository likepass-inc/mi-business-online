import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  type GetObjectCommandInput,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'stream'

export { PutObjectCommand }

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET_NAME

export function getClient(): S3Client {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  })
}

export function isR2Configured(): boolean {
  return !!(accountId && accessKeyId && secretAccessKey && bucket)
}

export function getBucket(): string {
  if (!bucket) throw new Error('R2_BUCKET_NAME is not set')
  return bucket
}

/**
 * アップロード用 presigned URL（PUT）を発行する。
 * @param key オブジェクトキー（例: uploads/uuid.zip）
 * @param expiresIn 有効秒数（デフォルト 1 時間）
 */
export async function getUploadPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient()
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
  })
  return getSignedUrl(client, command, { expiresIn })
}

/**
 * ダウンロード用 presigned URL（GET）を発行する。
 * @param key オブジェクトキー
 * @param expiresIn 有効秒数（デフォルト 1 時間）
 */
export async function getDownloadPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient()
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  })
  return getSignedUrl(client, command, { expiresIn })
}

/**
 * R2 からオブジェクトをストリームで取得する。
 */
export async function getObjectStream(key: string): Promise<Readable> {
  const client = getClient()
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  })
  const response = await client.send(command)
  const body = response.Body
  if (!body || !(body instanceof Readable)) {
    throw new Error(`Failed to get object stream: ${key}`)
  }
  return body
}

/**
 * R2 からオブジェクトを削除する。
 * @param key オブジェクトキー。空の場合は何もしない。
 */
export async function deleteObject(key: string): Promise<void> {
  if (!key || !key.trim()) return
  const client = getClient()
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key.trim(),
    })
  )
}

/**
 * Buffer を R2 にアップロードする。
 */
export async function uploadBuffer(key: string, body: Buffer, contentType?: string): Promise<void> {
  const client = getClient()
  const input: PutObjectCommandInput = {
    Bucket: getBucket(),
    Key: key,
    Body: body,
  }
  if (contentType) input.ContentType = contentType
  await client.send(new PutObjectCommand(input))
}
