<script setup lang="ts">
definePageMeta({ layout: false })
const route = useRoute()
const query = computed(() => route.fullPath.split("?")[1]?.split("#")[0] ?? "")
const { data, error: requestError } = await useFetch("/api/mcp/authorization", { query: { query } })
const email = ref("")
const password = ref("")
const busy = ref(false)
const error = ref("")

async function login() {
  busy.value = true
  error.value = ""
  try {
    const result = await authClient.signIn.email({ email: email.value, password: password.value })
    if (result.error) throw new Error(result.error.message)
    // The OAuth client plugin resumes the signed authorization flow.
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unable to sign in"
  } finally {
    busy.value = false
  }
}
async function consent(accept: boolean) {
  busy.value = true
  error.value = ""
  try {
    const result = await authClient.oauth2.consent({ accept })
    if (result.error) throw new Error(result.error.message)
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unable to authorize"
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="bg-neutral text-neutral flex min-h-screen items-center justify-center p-8">
    <div class="border-neutral flex w-full max-w-md flex-col gap-5 rounded-lg border p-8">
      <h1 class="text-title-sm">Connect to Zeitword</h1>
      <p
        v-if="requestError"
        role="alert"
      >
        This authorization request is invalid or has expired. Start again from your MCP client.
      </p>
      <template v-else-if="data">
        <form
          v-if="!data.signedIn"
          class="flex flex-col gap-4"
          @submit.prevent="login"
        >
          <label for="mcp-email">Email</label>
          <DInput
            v-model="email"
            name="mcp-email"
            type="email"
            autocomplete="email"
            required
          />
          <label for="mcp-password">Password</label>
          <DInput
            v-model="password"
            name="mcp-password"
            type="password"
            autocomplete="current-password"
            required
          />
          <DButton
            type="submit"
            :loading="busy"
          >
            Sign in
          </DButton>
        </form>
        <template v-else>
          <p>
            <strong>{{ data.clientName }}</strong>
            wants to connect to your Zeitword account.
          </p>
          <p>Signed in as {{ data.email }}</p>
          <p>
            Access covers all your current and future workspaces, limited to your membership
            permissions.
          </p>
          <ul class="list-inside list-disc">
            <li
              v-for="scope in data.scopes"
              :key="scope"
            >
              {{ scope }}
            </li>
          </ul>
          <pre
            v-if="data.claims"
            class="overflow-auto text-sm whitespace-pre-wrap"
            >{{ data.claims }}</pre>
          <DButton
            :loading="busy"
            @click="consent(true)"
          >
            Authorize
          </DButton>
          <DButton
            variant="secondary"
            :disabled="busy"
            @click="consent(false)"
          >
            Cancel
          </DButton>
        </template>
        <p
          v-if="error"
          role="alert"
        >
          {{ error }}
        </p>
      </template>
    </div>
  </main>
</template>
