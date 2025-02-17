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
      alert(
        "Es wurden zu viele Anfragen gestellt. Bitte versuche es später noch einmal."
      )
    } else {
      alert(
        "Ein unbekannter Fehler ist aufgetreten. Bitte versuche es später noch einmal."
      )
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-100 px-8 pt-24">
    <div
      class="mx-auto max-w-sm rounded-lg border border-neutral-50 bg-white p-8 shadow"
    >
      <h1 class="mb-4 text-center text-2xl font-semibold text-neutral-900">
        Neues Passwort
      </h1>

      <form
        v-if="!success"
        @submit.prevent="requestPasswordReset"
        class="flex flex-col gap-4"
      >
        <p class="mb-2 text-sm text-neutral-700">
          Es muss mindestens 8 Zeichen lang sein.
        </p>

        <div class="flex flex-col gap-1">
          <DLabel for="email">Passwort</DLabel>
          <DInput
            v-model="password"
            type="password"
            autocomplete="off"
            id="password"
            name="password"
            required
            placeholder="Dein neues Passwort"
          />
        </div>
        <div class="flex flex-col gap-2">
          <DButton
            type="submit"
            text-center
          >
            Passwort zurücksetzen
          </DButton>
          <DButton
            to="/login"
            variant="secondary"
            text-center
          >
            Zurück zur Anmeldung
          </DButton>
        </div>
      </form>
      <div
        v-else
        class="flex flex-col gap-2"
      >
        <div class="rounded-md bg-green-100 p-4">
          <p class="text-sm text-green-900">
            Du hast erfolgreich dein Passwort zurückgesetzt.
          </p>
        </div>
        <DButton
          to="/login"
          text-center
        >
          Zurück zur Anmeldung
        </DButton>
      </div>
    </div>
  </div>
</template>
