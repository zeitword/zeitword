import type { _Object } from "@aws-sdk/client-s3"

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let _client: S3Client | null = null

interface PutItemOptions {
  contentType?: string
  cacheControl?: string
  metadata?: Record<string, string>
}

interface MultipartUploadOptions {
  contentType?: string
  cacheControl?: string
  metadata?: Record<string, string>
}

interface MultipartPart {
  ETag: string
  PartNumber: number
}

function init() {
  if (_client) return { client: _client }

  const config = useRuntimeConfig()

  _client = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey
    },
    forcePathStyle: true
  })

  return { client: _client }
}

export function useS3() {
  const config = useRuntimeConfig()
  const { client } = init()

  /**
   * Upload an object to S3.
   */
  async function putItem(
    key: string,
    body: Buffer | Uint8Array | string | Blob,
    options: PutItemOptions = {}
  ) {
    const command = new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
      Metadata: options.metadata
    })
    return client.send(command)
  }

  /**
   * Download an object from S3 and return its contents as a Buffer.
   */
  async function getItem(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key
    })
    const response = await client.send(command)

    if (!response.Body) {
      throw new Error(`Empty response body for key: ${key}`)
    }

    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  /**
   * Download an object from S3 and return its contents as a string.
   */
  async function getItemAsString(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key
    })
    const response = await client.send(command)

    if (!response.Body) {
      throw new Error(`Empty response body for key: ${key}`)
    }

    return response.Body.transformToString()
  }

  /**
   * Delete a single object from S3.
   */
  async function deleteItem(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: config.s3.bucket,
      Key: key
    })
    return client.send(command)
  }

  /**
   * List objects in S3 matching an optional prefix.
   * Automatically paginates to return all matching objects.
   */
  async function listItems(
    prefix?: string,
    options: { maxKeys?: number; paginate?: boolean } = {}
  ): Promise<_Object[]> {
    const { maxKeys = 1000, paginate = true } = options
    const allObjects: _Object[] = []
    let continuationToken: string | undefined

    do {
      const command = new ListObjectsV2Command({
        Bucket: config.s3.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken
      })

      const response = await client.send(command)
      const objects = response.Contents || []
      allObjects.push(...objects)

      continuationToken =
        paginate && response.IsTruncated ? response.NextContinuationToken : undefined
    } while (continuationToken)

    return allObjects
  }

  /**
   * Initiate a multipart upload and return the UploadId.
   */
  async function createMultipartUpload(
    key: string,
    options: MultipartUploadOptions = {}
  ): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: config.s3.bucket,
      Key: key,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
      Metadata: options.metadata
    })

    const response = await client.send(command)

    if (!response.UploadId) {
      console.log(response)
      throw new Error(`Failed to create multipart upload for key: ${key}`)
    }

    return response.UploadId
  }

  /**
   * Upload a single part of a multipart upload. Returns the ETag and PartNumber.
   */
  async function uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer | Uint8Array
  ): Promise<MultipartPart> {
    const command = new UploadPartCommand({
      Bucket: config.s3.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body
    })

    const response = await client.send(command)

    if (!response.ETag) {
      throw new Error(`Missing ETag for part ${partNumber} of key: ${key}`)
    }

    return { ETag: response.ETag, PartNumber: partNumber }
  }

  /**
   * Finalize a multipart upload with the given parts.
   */
  async function completeMultipartUpload(key: string, uploadId: string, parts: MultipartPart[]) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: config.s3.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    })
    return client.send(command)
  }

  /**
   * Abort a multipart upload (cleanup on failure).
   */
  async function abortMultipartUpload(key: string, uploadId: string) {
    const command = new AbortMultipartUploadCommand({
      Bucket: config.s3.bucket,
      Key: key,
      UploadId: uploadId
    })
    return client.send(command)
  }

  /**
   * Generate a presigned URL for uploading a single part of a multipart upload.
   * The client can PUT directly to this URL without going through the server.
   */
  async function getPresignedUploadUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 3600
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: config.s3.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber
    })
    return getSignedUrl(client, command, { expiresIn })
  }

  /**
   * Generate presigned URLs for all parts of a multipart upload.
   */
  async function getPresignedUploadUrls(
    key: string,
    uploadId: string,
    totalParts: number,
    expiresIn = 3600
  ): Promise<{ partNumber: number; url: string }[]> {
    const promises = Array.from({ length: totalParts }, (_, i) => {
      const partNumber = i + 1
      return getPresignedUploadUrl(key, uploadId, partNumber, expiresIn).then((url) => ({
        partNumber,
        url
      }))
    })
    return Promise.all(promises)
  }

  /**
   * Generate a presigned URL for a simple single-object PUT upload.
   */
  async function getPresignedPutUrl(
    key: string,
    options: { contentType?: string; cacheControl?: string; expiresIn?: number } = {}
  ): Promise<string> {
    const { contentType, cacheControl, expiresIn = 3600 } = options
    const command = new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: cacheControl
    })
    return getSignedUrl(client, command, { expiresIn })
  }

  /**
   * Build the public URL for a given object key.
   */
  function getPublicUrl(key: string): string {
    return `${config.s3.endpoint}/${config.s3.bucket}/${key}`
  }

  return {
    putItem,
    getItem,
    getItemAsString,
    deleteItem,
    listItems,
    createMultipartUpload,
    uploadPart,
    completeMultipartUpload,
    abortMultipartUpload,
    getPresignedUploadUrl,
    getPresignedUploadUrls,
    getPresignedPutUrl,
    getPublicUrl,
    /** Escape hatch — prefer the high-level helpers above. */
    $client: client
  }
}
