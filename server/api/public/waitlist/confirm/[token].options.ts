export default defineEventHandler((event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type")
  return null
})
