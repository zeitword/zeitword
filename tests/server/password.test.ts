import { expect, test } from "vitest"

import { hashPassword, verifyPassword } from "../../server/utils/password"

test("preserves PHC scrypt passwords and token hashes", async () => {
  const password = "Long legacy password with ünicode"
  const hash = await hashPassword(password)
  expect(hash).toMatch(/^\$scrypt\$/)
  expect(await verifyPassword(hash, password)).toBe(true)
  expect(await verifyPassword(hash, "wrong password")).toBe(false)
  expect(await verifyPassword("invalid hash", password)).toBe(false)
})
