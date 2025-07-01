#!/usr/bin/env bun
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3"
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env") })

// Validate required environment variables
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
  forcePathStyle: true // Required for S3-compatible services like MinIO
})

// Define allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://app.zeitword.com"
]

// Add additional origins from environment if specified
if (process.env.ADDITIONAL_CORS_ORIGINS) {
  const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS.split(",").map(origin => origin.trim())
  allowedOrigins.push(...additionalOrigins)
}

// CORS configuration
const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      AllowedOrigins: allowedOrigins,
      ExposeHeaders: ["ETag", "x-amz-server-side-encryption", "x-amz-request-id", "x-amz-id-2"],
      MaxAgeSeconds: 3000
    }
  ]
}

async function updateBucketCors() {
  try {
    console.log(`Updating CORS policy for bucket: ${process.env.NUXT_S3_BUCKET}`)
    console.log("Allowed origins:")
    allowedOrigins.forEach(origin => console.log(`  - ${origin}`))

    const command = new PutBucketCorsCommand({
      Bucket: process.env.NUXT_S3_BUCKET,
      CORSConfiguration: corsConfiguration
    })

    await s3Client.send(command)

    console.log("✅ CORS policy updated successfully!")
  } catch (error) {
    console.error("❌ Failed to update CORS policy:", error)
    process.exit(1)
  }
}

// Run the update
updateBucketCors()
