export function useOrganisationTransition() {
  const switching = useState("organisation-switching", () => false)
  const revision = useState("organisation-page-revision", () => 0)
  const nuxtApp = useNuxtApp()

  async function transition(change: () => Promise<unknown>) {
    if (switching.value) return
    switching.value = true
    let removeHook: (() => void) | undefined
    try {
      await change()
      // Cancel in-flight useFetch requests and remove cached tenant data before
      // mounting the new page. Keep the layout (and its header) mounted.
      nuxtApp.runWithContext(() => clearNuxtData())
      await nuxtApp.runWithContext(() => navigateTo("/sites"))
      const pageReady = new Promise<void>((resolve) => {
        removeHook = nuxtApp.hook("page:finish", () => resolve())
      })
      // A new key resets editors, forms and local refs even on /sites -> /sites.
      revision.value++
      await pageReady
      await nuxtApp.runWithContext(() => refreshNuxtData(["current-user", "organisations"]))
    } finally {
      removeHook?.()
      switching.value = false
    }
  }

  return { switching, revision, transition }
}
