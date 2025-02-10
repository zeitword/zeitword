<script setup lang="ts">
const model = defineModel()

const values = ref(["", "", "", "", "", ""])

watch(
  values,
  () => {
    model.value = values.value.join("")
  },
  {
    deep: true,
  },
)

const inputRef = useTemplateRef("inputs")

onMounted(() => {
  // focus the first input
  // @ts-ignore
  const firstInput = inputRef.value[0]
  firstInput.focus()
})

function handlePaste(e: ClipboardEvent) {
  // if the pasted text is longer than 1 character, handle it by writing it correctly to values array
  const pastedText = e.clipboardData?.getData("text") || ""
  if (pastedText.length > 1 && pastedText.length <= 6) {
    const pastedValues = pastedText.split("")
    for (const [index, value] of pastedValues.entries()) {
      values.value[index] = value
    }

    // focus the next input
    if (pastedValues.length < 6) {
      // @ts-ignore
      const nextInput = inputRef.value[pastedValues.length]
      nextInput.focus()
    }
  }
}

function handleInput(e: Event, index: number) {
  e.preventDefault()
  const input = e.target as HTMLInputElement
  const value = input.value
  const lastChar = value.slice(-1)

  values.value[index] = lastChar

  // focus the next input
  if (index < 5) {
    // @ts-ignore
    const nextInput = inputRef.value[index + 1]
    nextInput.focus()
  }
}
</script>

<template>
  <div class="flex flex-row gap-2">
    <input
      ref="inputs"
      v-for="i in 6"
      :key="i"
      type="text"
      class="size-9 rounded-md border border-neutral-300 p-0 text-center"
      @paste.prevent="handlePaste"
      @input="(e) => handleInput(e, i - 1)"
      :value="values[i - 1]"
    />
  </div>
</template>
