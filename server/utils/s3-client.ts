import { S3Client } from "@aws-sdk/client-s3"

let s3Client: S3Client | null = null

export function useS3Client() {
  if (s3Client) return s3Client

  const config = useRuntimeConfig()

  // Hetzner Object Storage expects the bucket name in the endpoint
  // But AWS SDK will add it again, causing the duplicate bucket issue
  // Solution: Extract the base endpoint and let SDK handle bucket name
  const endpoint = config.s3Endpoint as string
  const bucket = config.s3Bucket as string

  // Extract base endpoint by removing the bucket name
  let baseEndpoint = endpoint
  if (endpoint.includes(bucket)) {
    // Remove bucket from the beginning of the domain
    baseEndpoint = endpoint.replace(`${bucket}.`, "")
    // Also remove bucket from path if present
    baseEndpoint = baseEndpoint.replace(`/${bucket}`, "")
  }

  console.log("S3 Client Configuration:", {
    originalEndpoint: endpoint,
    baseEndpoint,
    bucket,
    region: config.s3Region
  })

  s3Client = new S3Client({
    endpoint: baseEndpoint,
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey
    },
    // Don't use forcePathStyle with Hetzner when bucket is in subdomain
    forcePathStyle: false
  })

  // If endpoint includes the bucket name, remove it
  let cleanEndpoint = endpoint
  if (endpoint.includes(`/${config.s3Bucket}`)) {
    console.warn(`S3_ENDPOINT includes bucket name, removing it: ${endpoint}`)
    cleanEndpoint = endpoint.replace(`/${config.s3Bucket}`, "")
  }

  s3Client = new S3Client({
    endpoint: cleanEndpoint,
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey
    },
    forcePathStyle: true // Required for Hetzner Object Storage
  })

  return s3Client
}
