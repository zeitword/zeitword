import { lookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { BlockList, isIP } from "node:net"

export const MAX_IMPORT_BYTES = 512 * 1024 * 1024
export const IMPORT_TIMEOUT_MS = 10 * 60 * 1000
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const blocked = new BlockList()
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
] as const)
  blocked.addSubnet(address, prefix, "ipv4")
const globalV6 = new BlockList()
globalV6.addSubnet("2000::", 3, "ipv6")
blocked.addSubnet("2001::", 23, "ipv6")
blocked.addSubnet("2001:db8::", 32, "ipv6")
blocked.addSubnet("2002::", 16, "ipv6")
blocked.addSubnet("3fff::", 20, "ipv6")

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, "ipv4")
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6")
}

export function decodeUpload(base64: string): Buffer {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
    throw new Error("Expected standard padded base64 without a data URL prefix")
  const body = Buffer.from(base64, "base64")
  if (body.toString("base64") !== base64) throw new Error("Expected canonical padded base64")
  if (!body.length || body.length > MAX_UPLOAD_BYTES)
    throw new Error("Upload must be between 1 byte and 8 MiB")
  return body
}

// Resolve and pin every connection, including redirects. Node's HTTP client has no proxy
// or cookie jar here, and never receives caller credentials or arbitrary request headers.
export async function fetchAsset(source: string, signal = AbortSignal.timeout(IMPORT_TIMEOUT_MS)) {
  let url = new URL(source)
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      throw new Error("Use a public HTTP(S) URL without credentials")
    const hostname = url.hostname.replace(/^\[|\]$/g, "")
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true })
    signal.throwIfAborted()
    if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address)))
      throw new Error("Asset URL must resolve only to public internet addresses")
    const pinned = addresses[0]!
    const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
        url,
        {
          signal,
          headers: { "Accept-Encoding": "identity" },
          lookup: (_host, options, callback) => {
            if (options.all) callback(null, [pinned])
            else callback(null, pinned.address, pinned.family)
          }
        },
        (response) => {
          // Keep source errors handled while an S3 part is being uploaded;
          // the async iterator will still surface the failure to the transfer.
          response.on("error", () => {})
          resolve(response)
        }
      )
      request.on("error", reject)
      request.end()
    })
    if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
      response.destroy()
      if (!response.headers.location || redirects === 3)
        throw new Error("Too many or invalid asset redirects")
      url = new URL(response.headers.location, url)
      continue
    }
    if (
      response.statusCode !== 200 ||
      (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")
    ) {
      response.destroy()
      throw new Error("Asset source must return HTTP 200 with uncompressed bytes")
    }
    if (Number(response.headers["content-length"]) > MAX_IMPORT_BYTES) {
      response.destroy()
      throw new Error("Asset exceeds the 512 MiB import limit")
    }
    async function* body() {
      let size = 0
      try {
        for await (const raw of response) {
          signal.throwIfAborted()
          const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
          size += chunk.length
          if (size > MAX_IMPORT_BYTES) throw new Error("Asset exceeds the 512 MiB import limit")
          yield chunk
        }
        if (!size) throw new Error("Asset source returned an empty body")
      } finally {
        response.destroy()
      }
    }
    const contentType = (response.headers["content-type"] ?? "application/octet-stream")
      .split(";")[0]!
      .trim()
    return { body: body(), contentType, close: () => response.destroy() }
  }
  throw new Error("Asset redirect limit exceeded")
}
