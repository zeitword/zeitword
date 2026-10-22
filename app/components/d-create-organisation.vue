<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const name = ref("")
const busy = ref(false)
const error = ref("")
const { transition } = useOrganisationTransition()
const nameInput = ref<{ focus: () => void } | null>(null)
function focusName(event: Event) {
  event.preventDefault()
  nameInput.value?.focus()
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = ""
      error.value = ""
    }
  }
)
async function create() {
  if (busy.value) return
  if (!name.value.trim()) {
    error.value = "Enter an organisation name."
    return
  }
  busy.value = true
  error.value = ""
  try {
    await transition(() =>
      $fetch("/api/organisations", { method: "POST", body: { name: name.value.trim() } })
    )
    emit("close")
  } catch {
    error.value = "Unable to create organisation. Please try again."
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DModal
    :open="open"
    title="New organisation"
    confirm-text="Create"
    :loading="busy"
    @close="!busy && emit('close')"
    @confirm="create"
    @open-auto-focus="focusName"
  >
    <form @submit.prevent="create">
      <label
        for="new-organisation-name"
        class="sr-only"
      >
        Organisation name
      </label>
      <DInput
        ref="nameInput"
        name="new-organisation-name"
        v-model="name"
        placeholder="Organisation name"
        aria-label="Organisation name"
        autofocus
        maxlength="255"
        :disabled="busy"
      />
      <p
        v-if="error"
        role="alert"
        class="text-danger mt-2 text-sm"
      >
        {{ error }}
      </p>
    </form>
  </DModal>
</template>
