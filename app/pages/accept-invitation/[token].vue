<script setup lang="ts">
definePageMeta({ layout: false })
const token = useRoute().params.token as string
const { data: invitation, error: invitationError } = await useFetch(`/api/invitations/${token}`)
const { data: current } = await authClient.getSession()
const signedIn = ref(current?.user ?? null)
const existingAccount = ref(true)
const name = ref("")
const password = ref("")
const confirmPassword = ref("")
const busy = ref(false)
const error = ref("")
const { transition } = useOrganisationTransition()
async function accept() {
  busy.value = true
  error.value = ""
  try {
    if (!signedIn.value && existingAccount.value) {
      const result = await authClient.signIn.email({
        email: invitation.value!.email,
        password: password.value
      })
      if (result.error) throw new Error(result.error.message)
      signedIn.value = result.data.user
    }
    await transition(() =>
      $fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        body: signedIn.value
          ? {}
          : {
              name: name.value,
              password: password.value,
              confirmPassword: confirmPassword.value
            }
      })
    )
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || "Unable to accept invitation"
  } finally {
    busy.value = false
  }
}
async function signOut() {
  await authClient.signOut()
  signedIn.value = null
}
</script>

<template>
  <main class="bg-neutral-weak text-neutral flex min-h-screen items-center justify-center p-6">
    <div class="bg-neutral border-neutral w-full max-w-md space-y-6 rounded-lg border p-8 shadow">
      <h1 class="text-2xl font-semibold">Accept invitation</h1>
      <p
        v-if="invitationError"
        role="alert"
      >
        This invitation is invalid or expired.
      </p>
      <template v-else-if="invitation">
        <p>
          Join
          <strong>{{ invitation.organisationName }}</strong>
          as {{ invitation.email }}.
        </p>
        <template
          v-if="signedIn && signedIn.email.toLowerCase() !== invitation.email.toLowerCase()"
        >
          <p>
            You are signed in as {{ signedIn.email }}. Sign in with the invited email to continue.
          </p>
          <DButton @click="signOut">Sign out</DButton>
        </template>
        <form
          v-else
          @submit.prevent="accept"
          class="space-y-4"
        >
          <template v-if="!signedIn">
            <DInput
              v-if="!existingAccount"
              v-model="name"
              placeholder="Your name"
              aria-label="Name"
              required
            />
            <DInput
              v-model="password"
              type="password"
              placeholder="Password"
              aria-label="Password"
              required
              minlength="8"
            />
            <DInput
              v-if="!existingAccount"
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm password"
              aria-label="Confirm password"
              required
            />
          </template>
          <p
            v-if="error"
            role="alert"
            class="text-danger"
          >
            {{ error }}
          </p>
          <DButton
            type="submit"
            :disabled="busy"
          >
            {{
              signedIn
                ? "Accept invitation"
                : existingAccount
                  ? "Sign in & accept"
                  : "Create account & accept"
            }}
          </DButton>
          <DButton
            v-if="!signedIn"
            type="button"
            variant="transparent"
            @click="existingAccount = !existingAccount"
          >
            {{
              existingAccount ? "Create a new account instead" : "Already have an account? Sign in"
            }}
          </DButton>
          <NuxtLink
            v-if="!signedIn"
            to="/forgot-password"
            class="text-neutral-subtle block text-sm"
          >
            Forgot password?
          </NuxtLink>
        </form>
      </template>
    </div>
  </main>
</template>
