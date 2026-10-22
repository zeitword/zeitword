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

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith("/api")) return

  if (to.path === "/logout") {
    const { error } = await authClient.signOut()
    if (error) throw createError({ statusCode: error.status, statusMessage: error.message })
    return navigateTo("/login")
  }

  const isPublicRoute = publicRoutes.includes(to.path) || to.path.startsWith("/accept-invitation")

  if (!isPublicRoute) {
    const { data: session } = await authClient.getSession()
    if (!session) {
      return navigateTo("/login")
    }
    if (to.path !== "/organisations") {
      const memberships = await $fetch("/api/organisations")
      if (!memberships.organisations.some((org) => org.id === memberships.activeOrganisationId)) {
        return navigateTo("/organisations")
      }
    }
  }

  if (to.path === "/") {
    return navigateTo("/sites")
  }
})
