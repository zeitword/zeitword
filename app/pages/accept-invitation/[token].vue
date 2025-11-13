<script setup lang="ts">
import { z } from "zod"

const route = useRoute()
const token = route.params.token as string

definePageMeta({
  layout: false
})

// Fetch invitation details
const { data: invitation, error: invitationError } = await useFetch<{
  email: string
  organisationName: string
}>(`/api/invitations/${token}`, {
  server: false
})

const formData = ref({
  name: "",
  password: "",
  confirmPassword: ""
})

const formErrors = ref<Record<string, string>>({})
const isSubmitting = ref(false)
const submitError = ref("")

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  })

async function handleSubmit() {
  // Reset errors
  formErrors.value = {}
  submitError.value = ""

  // Validate form
  try {
    formSchema.parse(formData.value)
  } catch (error: any) {
    if (error.errors) {
      error.errors.forEach((err: any) => {
        formErrors.value[err.path[0]] = err.message
      })
    }
    return
  }

  isSubmitting.value = true

  try {
    await $fetch(`/api/invitations/${token}/accept`, {
      method: "POST",
      body: formData.value
    })

    // Redirect to sites page
    navigateTo("/sites")
  } catch (error: any) {
    submitError.value = error.data?.statusMessage || "Failed to accept invitation"
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
    <div class="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
      <div class="text-center">
        <h1 class="text-3xl font-bold">Accept Invitation</h1>
      </div>

      <!-- Error state -->
      <div
        v-if="invitationError"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
      >
        <p class="font-medium">{{ invitationError.data?.statusMessage || "Invalid invitation" }}</p>
      </div>

      <!-- Success state - show form -->
      <div
        v-else-if="invitation"
        class="space-y-6"
      >
        <div class="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p class="text-sm text-neutral-600">You've been invited to join:</p>
          <p class="text-lg font-semibold">{{ invitation.organisationName }}</p>
          <p class="text-sm text-neutral-600">as {{ invitation.email }}</p>
        </div>

        <form
          @submit.prevent="handleSubmit"
          class="space-y-4"
        >
          <div>
            <DFormGroup>
              <DLabel>Name</DLabel>
              <DInput
                v-model="formData.name"
                placeholder="Your name"
                :class="{ 'border-red-500': formErrors.name }"
              />
              <p
                v-if="formErrors.name"
                class="mt-1 text-sm text-red-600"
              >
                {{ formErrors.name }}
              </p>
            </DFormGroup>
          </div>

          <div>
            <DFormGroup>
              <DLabel>Password</DLabel>
              <DInput
                v-model="formData.password"
                type="password"
                placeholder="At least 8 characters"
                :class="{ 'border-red-500': formErrors.password }"
              />
              <p
                v-if="formErrors.password"
                class="mt-1 text-sm text-red-600"
              >
                {{ formErrors.password }}
              </p>
            </DFormGroup>
          </div>

          <div>
            <DFormGroup>
              <DLabel>Confirm Password</DLabel>
              <DInput
                v-model="formData.confirmPassword"
                type="password"
                placeholder="Confirm your password"
                :class="{ 'border-red-500': formErrors.confirmPassword }"
              />
              <p
                v-if="formErrors.confirmPassword"
                class="mt-1 text-sm text-red-600"
              >
                {{ formErrors.confirmPassword }}
              </p>
            </DFormGroup>
          </div>

          <div
            v-if="submitError"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {{ submitError }}
          </div>

          <DButton
            type="submit"
            :disabled="isSubmitting"
            class="w-full"
          >
            {{ isSubmitting ? "Creating account..." : "Accept & Create Account" }}
          </DButton>
        </form>
      </div>

      <!-- Loading state -->
      <div
        v-else
        class="text-center text-neutral-600"
      >
        Loading invitation...
      </div>
    </div>
  </div>
</template>
