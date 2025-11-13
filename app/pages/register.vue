<script setup lang="ts">
definePageMeta({
  layout: false
})

const name = ref("")
const email = ref("")
const password = ref("")
const organisationName = ref("")
const errorMsg = ref("")
const loading = ref(false)

const { fetch: refresh } = useUserSession()

async function login() {
  try {
    loading.value = true
    errorMsg.value = ""
    await $fetch("/api/register", {
      method: "POST",
      body: {
        name: name.value,
        email: email.value,
        password: password.value,
        organisationName: organisationName.value
      }
    })
    await refresh()
    await navigateTo("/")
  } catch (e) {
    errorMsg.value = "Invalid credentials"
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-100 px-8 pt-24">
    <div class="mx-auto max-w-sm rounded-lg border border-neutral-50 bg-white p-8 shadow">
      <h1 class="mb-4 text-center text-2xl font-semibold text-neutral-900">Zeitword</h1>

      <form
        @submit.prevent="login"
        class="flex flex-col gap-4"
      >
        <div class="flex flex-col gap-1">
          <d-label for="name">Name</d-label>
          <d-input
            v-model="name"
            type="text"
            id="name"
            name="name"
            required
            placeholder="Your Name"
          />
        </div>

        <div class="flex flex-col gap-1">
          <d-label for="email">Email</d-label>
          <d-input
            v-model="email"
            type="email"
            id="email"
            name="email"
            required
            placeholder="Your Email Address"
          />
        </div>

        <div class="flex flex-col gap-1">
          <d-label for="password">Password</d-label>
          <d-input
            v-model="password"
            type="password"
            id="password"
            name="password"
            required
            placeholder="Your Password"
          />
        </div>

        <div class="flex flex-col gap-1">
          <d-label for="organisationName">Organization Name</d-label>
          <d-input
            v-model="organisationName"
            type="text"
            id="organisationName"
            name="organisationName"
            required
            placeholder="Organization Name"
          />
        </div>

        <div class="flex flex-col gap-2">
          <DButton
            :loading
            type="submit"
            text-center
          >
            Register
          </DButton>
          <DButton
            to="/login"
            variant="transparent"
            text-center
          >
            Back to Login
          </DButton>
        </div>

        <div
          v-if="errorMsg"
          class="mb-2 rounded-md bg-red-100 px-4 py-2 text-center text-sm text-red-600"
        >
          {{ errorMsg }}
        </div>
      </form>
    </div>
  </div>
</template>
