#!/usr/bin/env bun
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3"

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
const allowedOrigins: string[] = [
  // "http://localhost:3000",
  "https://app.zeitword.com"
]

// Add additional origins from environment if specified
if (process.env.ADDITIONAL_CORS_ORIGINS) {
  const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS.split(",").map((origin) =>
    origin.trim()
  )
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
    allowedOrigins.forEach((origin) => console.log(`  - ${origin}`))

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
await updateBucketCors()

// Verify CORS policy
async function verifyBucketCors() {
  try {
    console.log("\nVerifying CORS policy...")

    const command = new GetBucketCorsCommand({
      Bucket: process.env.NUXT_S3_BUCKET
    })

    const response = await s3Client.send(command)

    if (!response.CORSRules || response.CORSRules.length === 0) {
      console.error("❌ No CORS rules found on the bucket!")
      return false
    }

    const rule = response.CORSRules[0]
    const expectedRule = corsConfiguration.CORSRules[0]

    if (!rule || !expectedRule) {
      console.error("❌ Unable to retrieve CORS rule configuration!")
      return false
    }

    // Check allowed origins
    const actualOrigins = rule.AllowedOrigins || []
    const originsMatch =
      expectedRule.AllowedOrigins.every((origin) => actualOrigins.includes(origin)) &&
      actualOrigins.length === expectedRule.AllowedOrigins.length

    // Check allowed methods
    const actualMethods = rule.AllowedMethods || []
    const methodsMatch =
      expectedRule.AllowedMethods.every((method) => actualMethods.includes(method)) &&
      actualMethods.length === expectedRule.AllowedMethods.length

    // Check allowed headers
    const headersMatch =
      JSON.stringify(rule.AllowedHeaders) === JSON.stringify(expectedRule.AllowedHeaders)

    // Check expose headers
    const exposeHeadersMatch =
      JSON.stringify(rule.ExposeHeaders) === JSON.stringify(expectedRule.ExposeHeaders)

    // Check max age
    const maxAgeMatch = rule.MaxAgeSeconds === expectedRule.MaxAgeSeconds

    console.log("\nCORS Policy Verification:")
    console.log(`  Origins: ${originsMatch ? "✅" : "❌"} (${actualOrigins.length} configured)`)
    console.log(`  Methods: ${methodsMatch ? "✅" : "❌"} (${actualMethods.join(", ")})`)
    console.log(`  Headers: ${headersMatch ? "✅" : "❌"}`)
    console.log(`  Expose Headers: ${exposeHeadersMatch ? "✅" : "❌"}`)
    console.log(`  Max Age: ${maxAgeMatch ? "✅" : "❌"} (${rule.MaxAgeSeconds || 0}s)`)

    if (originsMatch && methodsMatch && headersMatch && exposeHeadersMatch && maxAgeMatch) {
      console.log("\n✅ CORS policy verified successfully!")
      return true
    } else {
      console.log("\n⚠️  CORS policy differs from expected configuration")
      console.log("\nActual CORS configuration:")
      console.log(JSON.stringify(response.CORSRules, null, 2))
      return false
    }
  } catch (error: any) {
    if (error.name === "NoSuchCORSConfiguration") {
      console.error("❌ No CORS configuration found on the bucket!")
    } else {
      console.error("❌ Failed to verify CORS policy:", error)
    }
    return false
  }
}

await verifyBucketCors()
