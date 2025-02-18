<script setup lang="ts">
type Props = {
  show: boolean
}

const { show } = defineProps<Props>()
const emits = defineEmits(["reset", "save"])
</script>

<template>
  <Transition name="slide-fade-up">
    <div
      v-if="show"
      class="fixed bottom-20 flex w-xl items-center justify-between rounded-xl bg-white p-2 pl-4 shadow-lg"
    >
      <p class="text-sm font-medium text-gray-700">Sie haben ungespeicherte Änderungen!</p>
      <div class="flex gap-2">
        <d-button
          variant="secondary"
          size="md"
          @click="$emit('reset')"
        >
          Zurücksetzen
        </d-button>
        <d-button
          @click="$emit('save')"
          size="md"
        >
          Speichern
        </d-button>
      </div>
    </div>
  </Transition>
</template>
