# S3 Chunk Listing Issue - Solution

## Problem

Chunks are successfully uploaded to S3 (confirmed via test and bucket inspection), but the complete endpoint cannot find them when listing with the prefix.

## Diagnosis Steps

1. **Use the debug endpoint** to see what's in your bucket:

   ```
   GET /api/assets/chunk/debug?uploadId=YOUR_UPLOAD_ID
   ```

   This will show:

   - All objects in the bucket (first 10)
   - Objects matching the chunk prefix
   - Bucket configuration details

2. **Check the logs** for:
   - `Bucket: your-bucket-name` - Verify it matches your S3 bucket
   - `IsTruncated: true/false` - Check if S3 is paginating results
   - `All chunks in bucket: []` - See what keys are actually in S3

## Common Causes and Solutions

### 1. S3 Bucket Region Mismatch

If your S3 client is configured for a different region than your bucket:

```javascript
// In server/utils/s3-client.ts
s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region, // Make sure this matches your bucket's region
  credentials: {
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey
  },
  forcePathStyle: true
})
```

### 2. S3-Compatible Service Issues

Some S3-compatible services (MinIO, DigitalOcean Spaces) handle listing differently:

```javascript
// Try without forcePathStyle
s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  credentials: {
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey
  }
  // Remove: forcePathStyle: true
})
```

### 3. Prefix Case Sensitivity

S3 keys are case-sensitive. Verify the chunk keys match exactly:

- Upload creates: `chunks/${uploadId}/${index}-${chunkId}`
- Complete searches: `chunks/${uploadId}/`

### 4. IAM Permissions

Ensure your IAM user has ListBucket permission:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::your-bucket-name"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 5. Bucket Name in Path

If using a non-AWS S3 service, the bucket might be part of the path:

```javascript
// Check if your endpoint includes the bucket
// Wrong: https://s3.example.com/my-bucket
// Right: https://s3.example.com

// Or try listing with empty prefix first
const testCommand = new ListObjectsV2Command({
  Bucket: config.s3Bucket as string,
  MaxKeys: 10
})
```

## Quick Debug Script

Add this temporary endpoint to debug:

```typescript
// server/api/assets/chunk/test-list.get.ts
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const s3Client = useS3Client()

  console.log("S3 Config:", {
    bucket: config.s3Bucket,
    endpoint: config.s3Endpoint,
    region: config.s3Region
  })

  // Try different listing approaches
  const tests = []

  // Test 1: List with no prefix
  try {
    const cmd1 = new ListObjectsV2Command({
      Bucket: config.s3Bucket as string,
      MaxKeys: 5
    })
    const res1 = await s3Client.send(cmd1)
    tests.push({
      test: "No prefix",
      success: true,
      count: res1.Contents?.length || 0,
      keys: res1.Contents?.map((c) => c.Key) || []
    })
  } catch (error) {
    tests.push({
      test: "No prefix",
      success: false,
      error: error.message
    })
  }

  // Test 2: List with chunks/ prefix
  try {
    const cmd2 = new ListObjectsV2Command({
      Bucket: config.s3Bucket as string,
      Prefix: "chunks/",
      MaxKeys: 5
    })
    const res2 = await s3Client.send(cmd2)
    tests.push({
      test: "chunks/ prefix",
      success: true,
      count: res2.Contents?.length || 0,
      keys: res2.Contents?.map((c) => c.Key) || []
    })
  } catch (error) {
    tests.push({
      test: "chunks/ prefix",
      success: false,
      error: error.message
    })
  }

  return { config: { bucket: config.s3Bucket, endpoint: config.s3Endpoint }, tests }
})
```

## Alternative Approach

If listing continues to fail, use the chunk IDs directly:

```typescript
// Instead of listing, construct keys from chunk IDs
const chunkKeys = data.chunkIds.map(
  (chunkId, index) => `chunks/${data.uploadId}/${index.toString().padStart(6, "0")}-${chunkId}`
)

// Then get each chunk directly
for (const key of chunkKeys) {
  const getCommand = new GetObjectCommand({
    Bucket: config.s3Bucket as string,
    Key: key
  })
  // ... rest of processing
}
```

This bypasses the listing issue entirely.
