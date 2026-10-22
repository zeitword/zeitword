// OAuth issuer-inserted discovery URLs live outside /api/auth.
export default defineEventHandler((event) => useAuth().handler(authRequest(event)))
