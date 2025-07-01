# Zeitword Scripts

## update-s3-cors.ts

Updates the S3 bucket CORS policy to allow uploads from the frontend application.

### Usage

```bash
bun run s3:update-cors
```

### Prerequisites

1. Ensure your S3/MinIO server is running
2. Have the following environment variables set in `.env`:
   - `NUXT_S3_ENDPOINT`
   - `NUXT_S3_REGION`
   - `NUXT_S3_ACCESS_KEY_ID`
   - `NUXT_S3_SECRET_ACCESS_KEY`
   - `NUXT_S3_BUCKET`

### Default Allowed Origins

- `http://localhost:3000` (local development)
- `https://app.zeitword.com` (production)

### Adding Additional Origins

You can add more origins by setting the `ADDITIONAL_CORS_ORIGINS` environment variable:

```bash
ADDITIONAL_CORS_ORIGINS="https://staging.zeitword.com,https://preview.zeitword.com"
```

### What it does

The script configures the S3 bucket to:

- Accept PUT requests from allowed origins (for direct uploads)
- Allow all headers
- Expose necessary headers like ETag for upload verification
- Set a 3000 second (50 minute) max age for CORS preflight caching
