import {
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3"
import { useS3Client } from "~~/server/utils/s3-client"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const config = useRuntimeConfig()
  const s3Client = useS3Client()
  const testKey = `test-${Date.now()}.txt`

  const results: {
    config: {
      bucket: string
      endpoint: string
      region: string
    }
    tests: any[]
  } = {
    config: {
      bucket: config.s3Bucket as string,
      endpoint: config.s3Endpoint as string,
      region: config.s3Region as string
    },
    tests: []
  }

  try {
    // Test 1: Put a test object
    console.log("Test 1: Putting test object")
    const putCommand = new PutObjectCommand({
      Bucket: config.s3Bucket as string,
      Key: testKey,
      Body: "Test content",
      ContentType: "text/plain"
    })

    await s3Client.send(putCommand)
    results.tests.push({ test: "Put object", success: true, key: testKey })

    // Test 2: List objects without prefix
    console.log("Test 2: Listing without prefix")
    const listCommand1 = new ListObjectsV2Command({
      Bucket: config.s3Bucket as string,
      MaxKeys: 10
    })

    const listResponse1 = await s3Client.send(listCommand1)
    results.tests.push({
      test: "List without prefix",
      success: true,
      count: listResponse1.Contents?.length || 0,
      keys: listResponse1.Contents?.map((c) => c.Key) || []
    })

    // Test 3: List with test prefix
    console.log("Test 3: Listing with test prefix")
    const listCommand2 = new ListObjectsV2Command({
      Bucket: config.s3Bucket as string,
      Prefix: "test-",
      MaxKeys: 10
    })

    const listResponse2 = await s3Client.send(listCommand2)
    results.tests.push({
      test: "List with test- prefix",
      success: true,
      count: listResponse2.Contents?.length || 0,
      keys: listResponse2.Contents?.map((c) => c.Key) || []
    })

    // Test 4: Get the test object
    console.log("Test 4: Getting test object")
    const getCommand = new GetObjectCommand({
      Bucket: config.s3Bucket as string,
      Key: testKey
    })

    const getResponse = await s3Client.send(getCommand)
    const body = await getResponse.Body?.transformToString()
    results.tests.push({
      test: "Get object",
      success: true,
      content: body
    })

    // Clean up - delete test object
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.s3Bucket as string,
      Key: testKey
    })
    await s3Client.send(deleteCommand)
  } catch (error: any) {
    console.error("S3 test error:", error)
    results.tests.push({
      test: "Error",
      success: false,
      error: error.message || String(error),
      code: error.Code || error.code
    })
  }

  return results
})
