import { S3Client } from "@aws-sdk/client-s3"

let s3Client: S3Client | null = null

export function useS3Client() {
  if (s3Client) return s3Client

  const config = useRuntimeConfig()

  s3Client = new S3Client({
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey
    },
    forcePathStyle: false // Hetzner Object Storage doesn't use path-style
  })

  return s3Client
}
