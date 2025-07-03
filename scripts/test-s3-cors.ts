#!/usr/bin/env bun
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// Load environment variables
const requiredEnvVars = [
  "NUXT_S3_ENDPOINT",
  "NUXT_S3_REGION",
  "NUXT_S3_ACCESS_KEY_ID",
  "NUXT_S3_SECRET_ACCESS_KEY",
  "NUXT_S3_BUCKET"
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`)
    process.exit(1)
  }
}

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: process.env.NUXT_S3_ENDPOINT,
  region: process.env.NUXT_S3_REGION,
  credentials: {
    accessKeyId: process.env.NUXT_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NUXT_S3_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true
})

async function testCORS() {
  try {
    // Generate a presigned URL for testing
    const command = new PutObjectCommand({
      Bucket: process.env.NUXT_S3_BUCKET,
      Key: `test-cors-${Date.now()}.txt`,
      ContentType: "text/plain"
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })

    console.log("🔍 Testing CORS with presigned URL...")
    console.log(`URL: ${presignedUrl.split("?")[0]}...`)

    // Test preflight request (OPTIONS)
    console.log("\n📤 Testing preflight (OPTIONS) request...")
    try {
      const optionsResponse = await fetch(presignedUrl, {
        method: "OPTIONS",
        headers: {
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-type,x-amz-meta-filename",
          Origin: "https://zeitword-git-feature-large-uploads-trail-group.vercel.app"
        }
      })

      console.log(`Status: ${optionsResponse.status} ${optionsResponse.statusText}`)
      console.log("Response headers:")
      optionsResponse.headers.forEach((value, key) => {
        if (key.toLowerCase().includes("access-control")) {
          console.log(`  ${key}: ${value}`)
        }
      })
    } catch (error: any) {
      console.error("❌ OPTIONS request failed:", error.message)
    }

    // Test actual PUT request
    console.log("\n📤 Testing PUT request...")
    try {
      const putResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "text/plain",
          "x-amz-meta-filename": "test.txt",
          Origin: "https://zeitword-git-feature-large-uploads-trail-group.vercel.app"
        },
        body: "Test CORS upload"
      })

      console.log(`Status: ${putResponse.status} ${putResponse.statusText}`)
      console.log("Response headers:")
      putResponse.headers.forEach((value, key) => {
        if (key.toLowerCase().includes("access-control") || key.toLowerCase() === "etag") {
          console.log(`  ${key}: ${value}`)
        }
      })

      if (putResponse.ok) {
        console.log("\n✅ CORS test successful! Upload worked.")
      } else {
        console.log("\n❌ Upload failed with status:", putResponse.status)
      }
    } catch (error: any) {
      console.error("❌ PUT request failed:", error.message)
    }
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

// Run the test
await testCORS()
