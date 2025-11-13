const publicRoutes = [
  "/login",
  "/logout",
  "/offline",
  "/register",
  "/up",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation"
]

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (to.path.startsWith("/api")) return

  if (to.path === "/logout") {
    await useUserSession().clear()
    return navigateTo("/login")
  }

  const isPublicRoute = publicRoutes.includes(to.path) || to.path.startsWith("/accept-invitation")

  if (!isPublicRoute) {
    if (!useUserSession().loggedIn.value) {
      return navigateTo("/login")
    }
  }

  if (to.path === "/") {
    return navigateTo("/sites")
  }
})
