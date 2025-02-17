interface RateLimitConfig {
  key: string
  limit: number
  ttl?: number // in seconds
}

export function useRateLimiter() {
  const storage = useStorage("limiter")

  async function checkLimit({ key, limit, ttl = 3600 }: RateLimitConfig) {
    const now = Date.now()
    const windowStart = now - ttl * 1000

    // Get stored requests as array of timestamps
    const storedValue = await storage.getItem(key)
    const requests: number[] = Array.isArray(storedValue) ? storedValue : []

    // Filter out expired timestamps
    const validRequests = requests.filter(
      (timestamp) => timestamp > windowStart
    )

    if (validRequests.length >= limit) return false

    // Add current timestamp and store
    validRequests.push(now)
    await storage.setItem(key, validRequests, { ttl })

    return true
  }

  return {
    checkLimit
  }
}
