import { Hash } from "@adonisjs/hash"
import { Scrypt } from "@adonisjs/hash/drivers/scrypt"

// Preserve the PHC scrypt format used by nuxt-auth-utils, including existing PATs
// and site API keys. Better Auth calls these same functions for new passwords.
const passwordHash = new Hash(new Scrypt({}))

export function hashPassword(password: string) {
  return passwordHash.make(password)
}

export async function verifyPassword(hash: string, password: string | undefined) {
  if (password === undefined) return false
  try {
    return await passwordHash.verify(hash, password)
  } catch {
    return false
  }
}
