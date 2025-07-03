import { S3Client } from "@aws-sdk/client-s3"

let s3Client: S3Client | null = null

export function useS3Client() {
  if (s3Client) return s3Client

  const config = useRuntimeConfig()
  const endpoint = config.s3Endpoint as string
  const bucket = config.s3Bucket as string

  // Clean the endpoint to ensure it doesn't include the bucket name
  let cleanEndpoint = endpoint

  // Check if endpoint has bucket name as subdomain (e.g., bucket.region.provider.com)
  const urlParts = endpoint.replace(/^https?:\/\//, "").split(".")
  if (urlParts.length > 2 && urlParts[0] === bucket) {
    // Remove bucket subdomain and reconstruct URL
    const protocol = endpoint.startsWith("https") ? "https://" : "http://"
    cleanEndpoint = protocol + urlParts.slice(1).join(".")
  }

  // Also remove bucket from path if present
  if (cleanEndpoint.includes(`/${bucket}`)) {
    cleanEndpoint = cleanEndpoint.replace(`/${bucket}`, "")
  }

  // Remove trailing slash
  cleanEndpoint = cleanEndpoint.replace(/\/$/, "")

  console.log("S3 Client Configuration:", {
    originalEndpoint: endpoint,
    cleanEndpoint,
    bucket,
    region: config.s3Region
  })

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
