<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()

const token = computed(() => route.query.token)

const password = ref("")
const loading = ref(false)
const success = ref(false)

async function requestPasswordReset() {
  loading.value = true
  try {
    await $fetch("/api/reset-password", {
      method: "POST",
      body: {
        password: password.value,
        token: token.value
      }
    })
    success.value = true
    await navigateTo("/login")
  } catch (e: any) {
    // const statusCode = e.statusCode
    if (e.statusCode === 429) {
      // handle rate limit error
      alert("Too many requests have been made. Please try again later.")
    } else {
      alert("An unknown error has occurred. Please try again later.")
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-100 px-8 pt-24">
    <div class="mx-auto max-w-sm rounded-lg border border-neutral-50 bg-white p-8 shadow">
      <h1 class="mb-4 text-center text-2xl font-semibold text-neutral-900">New Password</h1>

      <form
        v-if="!success"
        @submit.prevent="requestPasswordReset"
        class="flex flex-col gap-4"
      >
        <p class="mb-2 text-sm text-neutral-700">It must be at least 8 characters long.</p>

        <div class="flex flex-col gap-1">
          <DLabel for="email">Password</DLabel>
          <DInput
            v-model="password"
            type="password"
            autocomplete="off"
            id="password"
            name="password"
            required
            placeholder="Your new password"
          />
        </div>
        <div class="flex flex-col gap-2">
          <DButton
            type="submit"
            text-center
          >
            Reset Password
          </DButton>
          <DButton
            to="/login"
            variant="secondary"
            text-center
          >
            Back to Login
          </DButton>
        </div>
      </form>
      <div
        v-else
        class="flex flex-col gap-2"
      >
        <div class="rounded-md bg-green-100 p-4">
          <p class="text-sm text-green-900">You have successfully reset your password.</p>
        </div>
        <DButton
          to="/login"
          text-center
        >
          Back to Login
        </DButton>
      </div>
    </div>
  </div>
</template>
