export default defineEventHandler(async (event) => {
  try {
    await requireUserSession(event)
    await clearUserSession(event)
  } catch {
    console.error("logout failed")
  } finally {
    await sendRedirect(event, "/login", 302)
  }
})
