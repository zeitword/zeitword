<script lang="ts" setup>
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "lucide-vue-next"

interface Props {
  options: { value: string | number | boolean | null; display: string }[]
  placeholder?: string
}

const { options } = defineProps<Props>()

const model = defineModel<string | null>()

const open = ref(false)

const emit = defineEmits<{
  (e: "change", value: string | null): void
}>()

const container = templateRef<HTMLElement>("container")

onClickOutside(container, () => (open.value = false))

onKeyStroke("Escape", () => (open.value = false))

function select(option: any) {
  emit("change", option.value)
  model.value = option.value
  open.value = false
}

const optionsRef = templateRef<HTMLElement[]>("options")
const input = templateRef<HTMLInputElement>("input")

function onOpen({ keyboard = false }: { keyboard?: boolean } = {}) {
  if (open.value) {
    open.value = false
    return
  }

  open.value = true
  // defocus
  input.value?.blur()

  if (!keyboard) return

  // Wait for the next tick to ensure the options are rendered
  nextTick(() => {
    if (!optionsRef.value || optionsRef.value.length === 0) return

    if (model.value !== null) {
      // Find the index of the currently selected option
      const selectedIndex = options.findIndex((opt) => opt.value === model.value)
      if (selectedIndex !== -1) {
        optionsRef.value[selectedIndex]?.focus()
        return
      }
    }

    // Fall back to focusing first option if no option is selected
    optionsRef.value[0]?.focus()
  })
}

function selectNextOption() {
  const options = optionsRef.value
  if (!options) return
  let index = options.findIndex((option) => option.classList.contains("active"))
  if (index === -1) index = -1
  const nextIndex = (index + 1) % options.length
  options[nextIndex]?.focus()
}

function selectPreviousOption() {
  const options = optionsRef.value
  if (!options) return
  let index = options.findIndex((option) => option.classList.contains("active"))
  if (index === -1) index = options.length
  const prevIndex = index <= 0 ? options.length - 1 : index - 1
  options[prevIndex]?.focus()
}

onKeyStroke("ArrowDown", () => {
  if (!open.value) return
  selectNextOption()
})

onKeyStroke("ArrowUp", () => {
  if (!open.value) return
  selectPreviousOption()
})

const { x: inputX, y: inputY, width: inputWidth, height: inputHeight } = useElementBounding(input)

const popoverStyle = computed(() => {
  const popoverTop = inputY.value + inputHeight.value + 4
  const popoverLeft = inputX.value

  return {
    top: `${popoverTop}px`,
    left: `${popoverLeft}px`,
    width: `${inputWidth.value}px`,
  }
})
</script>

<template>
  <div ref="container" class="relative">
    <div
      ref="input"
      @click="onOpen"
      tabindex="0"
      @keypress.enter="onOpen({ keyboard: true })"
      class="flex w-full cursor-default items-center justify-between rounded-md bg-neutral-100 px-2.5 py-1.5 text-sm ring-blue-600 outline-none focus:ring-2 focus:outline-0"
    >
      <div v-if="placeholder && model === null" class="overflow-hidden text-sm text-nowrap overflow-ellipsis text-neutral-700">{{ placeholder }}</div>
      <div v-else class="overflow-hidden text-sm text-nowrap overflow-ellipsis text-neutral-900">{{ options.find((o) => o.value == model)?.display }}</div>
      <ChevronDownIcon v-show="!open" class="ml-2 size-4 text-neutral-700" />
      <ChevronUpIcon v-show="open" class="ml-2 size-4 text-neutral-700" />
    </div>
    <div
      v-if="open"
      :style="popoverStyle"
      class="fixed z-100 flex max-h-48 flex-col gap-1 overflow-scroll rounded-md border border-neutral-200 bg-white p-1 text-sm shadow"
    >
      <div
        ref="options"
        v-for="option in options"
        @click="select(option)"
        @keypress.enter="select(option)"
        tabindex="0"
        class="flex cursor-default items-center justify-between rounded px-2.5 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-0"
      >
        <div class="overflow-hidden text-nowrap overflow-ellipsis">{{ option.display }}</div>
        <CheckIcon v-if="model === option.value" class="ml-2 size-4" />
      </div>
    </div>
  </div>
</template>
