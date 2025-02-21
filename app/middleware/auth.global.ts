const publicRoutes = [
  "/login",
  "/logout",
  "/offline",
  "/register",
  "/up",
  "/forgot-password",
  "/reset-password"
]

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (to.path === "/logout") {
    await useUserSession().clear()
    return navigateTo("/login")
  }

  if (!publicRoutes.includes(to.path)) {
    if (!useUserSession().loggedIn.value) {
      return navigateTo("/login")
    }
  }

  if (to.path === "/") {
    return navigateTo("/sites")
  }
})
