# Chunked Upload System Migration Guide

## Overview

This guide explains how to migrate from the presigned URL upload system to the new chunked upload system.

## Key Differences

### Old System (Presigned URLs)

- Direct client-to-S3 uploads using presigned URLs
- Single request for entire file
- Limited by network timeouts and browser constraints
- No resume capability for failed uploads

### New System (Chunked Upload)

- Files split into 2.5MB chunks client-side
- Each chunk uploaded individually
- Server-side merging with memory constraints
- Automatic retry and resume capabilities
- Better handling of large files and poor network conditions

## Migration Steps

### 1. Update Client Code

Replace the old `usePresignedUpload` composable with `useChunkedUpload`:

```vue
<!-- Old -->
<script setup>
import { usePresignedUpload } from "~~/app/composables/usePresignedUpload"

const { uploadFile, isUploading, uploadProgress } = usePresignedUpload({
  onProgress: (progress) => console.log(progress),
  onError: (error) => console.error(error)
})
</script>

<!-- New -->
<script setup>
import { useChunkedUpload } from "~~/app/composables/useChunkedUpload"

const { uploadFile, cancelUpload, isUploading, uploadProgress } = useChunkedUpload({
  chunkSize: 2.5 * 1024 * 1024, // 2.5MB chunks
  maxRetries: 3,
  onProgress: (progress) => console.log(progress),
  onChunkComplete: (chunkIndex) => console.log(`Chunk ${chunkIndex} complete`),
  onError: (error) => console.error(error)
})
</script>
```

### 2. Update Progress Tracking

The progress object structure has changed:

```typescript
// Old progress structure
interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

// New progress structure
interface ChunkUploadProgress {
  totalChunks: number
  uploadedChunks: number
  currentChunkProgress: number
  overallProgress: number
  bytesUploaded: number
  totalBytes: number
}
```

### 3. Handle New Features

The new system provides additional features:

- **Cancel uploads**: Use `cancelUpload()` to abort in-progress uploads
- **Chunk tracking**: Monitor individual chunk progress with `onChunkComplete`
- **Automatic retries**: Failed chunks retry automatically (configurable)

### 4. Server Configuration

Ensure your S3 bucket has appropriate CORS configuration for multipart uploads:

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

## API Endpoints

### Old Endpoints (can be deprecated)

- `POST /api/assets/presigned-url` - Generate presigned URL
- `POST /api/assets` - Direct file upload

### New Endpoints

- `POST /api/assets/chunk` - Upload individual chunk
- `POST /api/assets/chunk/complete` - Complete upload and merge chunks

## Performance Considerations

1. **Memory Usage**: The server processes chunks in 5MB batches to minimize memory usage
2. **Storage**: Temporary chunks are automatically cleaned up after successful merge
3. **Network**: Failed chunks retry automatically with exponential backoff
4. **Concurrency**: Chunks upload sequentially to avoid overwhelming the server

## Rollback Plan

If you need to rollback:

1. Keep the old endpoints active during migration
2. Use feature flags to toggle between upload methods
3. Monitor error rates and performance metrics
4. The old presigned URL system remains functional

## Testing

Test the new system with:

1. **Large files**: Upload files > 100MB to test chunking
2. **Network interruptions**: Disconnect/reconnect during upload
3. **Concurrent uploads**: Test multiple simultaneous uploads
4. **Edge cases**: Empty files, very small files, exact chunk boundaries

## Monitoring

Monitor these metrics:

- Upload success rate
- Average upload time per MB
- Chunk retry frequency
- S3 storage usage (temporary chunks)
- Server memory usage during merge operations
