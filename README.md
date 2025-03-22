<p align="center">
  <picture>
      <source srcset="public/favicon.png" media="(prefers-color-scheme: dark)">
      <img src="public/favicon-light.png" alt="" width="64"/>
    </picture>
  <h1 align="center">Zeitword</h1>
  <p align="center">An open-source, block-based headless CMS built with Nuxt</p>
</p>

## What is Zeitword?

Zeitword is a modern headless CMS that empowers developers to build content-rich applications while providing an intuitive interface for content creators. It combines the flexibility of a headless architecture with the simplicity of block-based editing.

## Why Zeitword?

- 🎨 **Block-Based Editing** - Intuitive content creation with modular blocks
- 🔧 **API-First** - Build with your preferred stack using our simple API
- 📝 **User-Friendly** - Let content creators work without understanding technical details
- 🚀 **Developer-Focused** - Easy to integrate, customize, and extend
- 💻 **Open Source** - Transparent, community-driven development
- ⚡ **Performance** - Built with modern technologies for speed

## Tech Stack

Zeitword is built with modern and reliable technologies:

- **Frontend**: Nuxt.js, Vue, TypeScript
- **Backend**: Nitro
- **Database**: PostgreSQL
- **ORM**: Drizzle
- **Storage**: MinIO/S3-compatible
- **Development**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### Quick Start

1. **Clone and Install**
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/zeitword.git
   cd zeitword

   # Install dependencies
   bun i
   ```

2. **Start the Infrastructure**
   ```bash
   docker compose up -d
   ```
   This will start:
   - PostgreSQL database on port 5432
   - MinIO S3-compatible storage on port 9000
   - MinIO Console on port 9001

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   The example configuration includes default values for local development with PostgreSQL and MinIO.

4. **Run Migrations**
   ```bash
   bunx drizzle-kit migrate
   ```

5. **Start Development Server**
   ```bash
   bun dev
   ```

### Local Development Services

#### PostgreSQL
- Host: `localhost:5432`
- User: `postgres`
- Password: `postgres`

#### MinIO (S3-compatible storage)
- API Endpoint: `http://localhost:9000`
- Console UI: `http://localhost:9001`
- Access Key: `admin`
- Secret Key: `password`
- Default Bucket: `zeitword`

You can access the MinIO Console at `http://localhost:9001` to manage your storage directly.

### Database Management

Zeitword uses Drizzle ORM for database operations. Here are common commands:

```bash
# Generate migrations after schema changes
bunx drizzle-kit generate

# Apply migrations to the database
bunx drizzle-kit migrate
```

## Environment Setup

For local development, the `.env.example` comes pre-configured for the included Docker services. For production, you'll need to update these values according to your deployment environment.

### Required Environment Variables

1. **Database Configuration**
   ```env
   NUXT_DSN="postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
   NUXT_SESSION_PASSWORD="your-secure-session-password"
   ```
   - `NUXT_DSN`: PostgreSQL connection string
   - `NUXT_SESSION_PASSWORD`: Secret key for session encryption (this MUST be atleast 32 chars)

2. **S3 Storage Configuration**
   ```env
   # Default values for local MinIO setup
   NUXT_S3_ACCESS_KEY_ID="admin"
   NUXT_S3_SECRET_ACCESS_KEY="password"
   NUXT_S3_ENDPOINT="http://localhost:9000"
   NUXT_S3_BUCKET="zeitword"
   NUXT_S3_REGION="us-east-1"
   ```
   - For local development, these values work with the included MinIO service
   - For production, replace with your preferred S3-compatible service credentials

3. **Waitlist Configuration**
   ```env
   NUXT_RESEND="your-resend-api-key"
   NUXT_PUBLIC_SITE_URL="https://your-site-url.com"
   ```
   - `NUXT_RESEND`: API key for email service
   - `NUXT_PUBLIC_SITE_URL`: Your site's public URL

### Setting Up Environment Variables

1. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Generate a secure session password:
   ```bash
   openssl rand -base64 32
   ```

3. For production S3 storage:
   - Create an S3 bucket or use an S3-compatible service
   - Configure CORS settings for your bucket
   - Add your credentials to the `.env` file

4. Configure email service:
   - Sign up for [Resend](https://resend.com)
   - Add your API key to the `.env` file

> [!NOTE]
> Never commit your `.env` file to version control. It's included in `.gitignore` by default.


## Contributing

We welcome contributions! Please feel free to:

- Submit bug reports
- Propose new features
- Create pull requests
- Improve documentation

Check our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## License

[MIT License](LICENSE)
