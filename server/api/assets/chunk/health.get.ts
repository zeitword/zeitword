export default defineEventHandler(async () => {
  return {
    status: "ok",
    endpoint: "/api/assets/chunk",
    timestamp: new Date().toISOString()
  }
})
