import { Hash } from "@adonisjs/hash"
import { Scrypt } from "@adonisjs/hash/drivers/scrypt"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { customAlphabet } from "nanoid"

import { siteApiKeys, sites } from "../server/database/schema"

const siteId = process.argv[2]
const name = process.argv[3] || "Import"

if (!siteId) {
  throw new Error("Usage: npm run api-key:create -- <site-id> [name]")
}

const dsn = process.env.NUXT_DSN
if (!dsn) throw new Error("NUXT_DSN is not configured")

const db = drizzle(dsn)
const [site] = await db
  .select({ id: sites.id, organisationId: sites.organisationId })
  .from(sites)
  .where(eq(sites.id, siteId))
  .limit(1)

if (!site) throw new Error(`Site not found: ${siteId}`)

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 32)
const secret = nanoid()
const hash = await new Hash(new Scrypt()).make(secret)

const [apiKey] = await db
  .insert(siteApiKeys)
  .values({
    name,
    hash,
    siteId: site.id,
    organisationId: site.organisationId
  })
  .returning({ id: siteApiKeys.id })

if (!apiKey) throw new Error("Failed to create API key")

console.log(`zeitword_${apiKey.id}_${secret}`)
