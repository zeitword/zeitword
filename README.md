# Zeitword

Zeitword is an open source, block-based headless CMS built with Nuxt.

# Why is Zeitword?
- Build with your preferred stack using our simple API and schema definition.
- Let your users create and publish content intuitively without ever needing to understand the technical details.

Zeitword is an open-source

# Getting Started

## Prerequisites

- [Bun](https://bun.sh/)
- [Docker](https://www.docker.com/) (for running PostgreSQL)
- [Docker Compose](https://docs.docker.com/compose/)

## Installation

1. Install dependencies:
```
bun i
```
2. Start the PostgreSQL database:
```
docker compose up -d
```
3. Start the development server:
```
bun dev
```

## Database Management

### Generate migrations after schema changes
```
bunx drizzle-kit generate
```

### Apply migrations to the database
```
bunx drizzle-kit migrate
```
