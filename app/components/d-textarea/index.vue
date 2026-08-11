<script setup lang="ts">
type Props = {
  rows?: number
  cols?: number
  placeholder?: string
  disabled?: boolean
  required?: boolean
  minlength?: number
  maxlength?: number
}

const {
  rows = 5,
  cols = 50,
  placeholder = "",
  disabled = false,
  required = false,
  minlength,
  maxlength
} = defineProps<Props>()

const model = defineModel<string>()
</script>
<template>
  <textarea
    v-model="model"
    class="text-neutral bg-neutral text-copy border-neutral focus:bg-neutral rounded-lg border p-2 ring-offset-0 transition-colors outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
    :rows="rows"
    :cols="cols"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :minlength="minlength"
    :maxlength="maxlength"
  ></textarea>
</template>
