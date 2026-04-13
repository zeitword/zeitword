<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const { user } = useUserSession()

const callbackPort = computed(() => {
  const port = route.query.port
  if (!port || typeof port !== "string") return null
  const parsed = parseInt(port, 10)
  if (isNaN(parsed) || parsed < 1024 || parsed > 65535) return null
  return parsed
})

const loading = ref(false)
const error = ref("")
const authorized = ref(false)

async function authorize() {
  if (!callbackPort.value) return

  try {
    loading.value = true
    error.value = ""

    const result = await $fetch("/api/auth/mcp/authorize", {
      method: "POST",
      body: {
        callbackPort: callbackPort.value
      }
    })

    authorized.value = true

    // Redirect to the MCP server's local callback with the token
    window.location.href = `${result.callbackUrl}?token=${encodeURIComponent(result.token)}`
  } catch (e: any) {
    error.value = e?.data?.message || "Failed to authorize. Please try again."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-100 px-8 pt-24">
    <div class="mx-auto max-w-sm rounded-lg border border-neutral-50 bg-white p-8 shadow">
      <h1 class="mb-2 text-center text-2xl font-semibold text-neutral-900">Zeitword</h1>
      <p class="mb-6 text-center text-sm text-neutral-500">MCP Authorization</p>

      <div v-if="!callbackPort" class="text-center">
        <p class="text-sm text-red-600">
          Invalid authorization request. Missing callback port.
        </p>
      </div>

      <div v-else-if="authorized" class="text-center">
        <p class="text-sm text-neutral-600">
          Authorization successful. You can close this window.
        </p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div class="rounded-md bg-neutral-50 p-4">
          <p class="text-sm text-neutral-700">
            An MCP client is requesting access to your Zeitword account.
          </p>
          <p class="mt-2 text-sm text-neutral-500">
            Signed in as <strong class="text-neutral-700">{{ user?.email }}</strong>
          </p>
        </div>

        <p class="text-xs text-neutral-500">
          This will create a personal access token that allows the MCP client to manage your sites, content, and schemas on your behalf.
        </p>

        <DButton
          :loading="loading"
          @click="authorize"
          text-center
        >
          Authorize
        </DButton>

        <DButton
          variant="secondary"
          text-center
          @click="$router.push('/sites')"
        >
          Cancel
        </DButton>

        <div
          v-if="error"
          class="rounded-md bg-red-100 px-4 py-2 text-center text-sm text-red-600"
        >
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>
