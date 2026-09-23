import "server-only"
import { S3Client, GetObjectCommand, PutObjectCommand, HeadBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "node:crypto"

let client: S3Client | undefined

function s3(): S3Client {

  client ??= new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  })
  return client


}

function bucket(): string {
  const b = process.env.S3_BUCKET
  if (!b) throw new Error("S3_BUCKET belum disetel.")
  return b
}

/** Pola penamaan kunci objek (docs/03-erd.md bab 3.9):
 * `{organizationId}/assets/{assetId}/events/{eventId}/{uuid}.{ext}`
 */
export function objectKeyForAttachment(input: {
  organizationId: string
  assetId: string
  eventId: string
  ext: string
}): string {
  return [
    input.organizationId,
    "assets",
    input.assetId,
    "events",
    input.eventId,
    `${randomUUID()}.${input.ext}`,
  ].join("/")
}

export async function presignUpload(opts: {
  objectKey: string
  contentType: string
}): Promise<{ url: string }> {
  const ttl = Number(process.env.PRESIGN_PUT_TTL_SECONDS ?? 300)
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: opts.objectKey,
    ContentType: opts.contentType,
    CacheControl: "private, max-age=0",
  })
  const url = await getSignedUrl(s3(), command, { expiresIn: ttl })
  return { url }
}

export async function presignDownload(opts: { objectKey: string }): Promise<{ url: string }> {
  const ttl = Number(process.env.PRESIGN_GET_TTL_SECONDS ?? 900)
  const command = new GetObjectCommand({ Bucket: bucket(), Key: opts.objectKey })
  const url = await getSignedUrl(s3(), command, { expiresIn: ttl })
  return { url }
}

export async function storageHealth(): Promise<boolean> {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket() }))
    return true
  } catch {
    return false
  }
}