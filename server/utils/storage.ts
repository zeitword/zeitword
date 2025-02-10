import { createStorage } from "unstorage"
import s3Driver from "unstorage/drivers/s3"

export function useS3Storage() {
  const config = useRuntimeConfig()

  const storage = createStorage({
    driver: s3Driver({
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      endpoint: config.s3Endpoint,
      bucket: config.s3Bucket,
      region: config.s3Region,
    }),
  })

  return storage
}
