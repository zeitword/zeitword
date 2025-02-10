<script setup lang="ts">
import { XIcon } from "lucide-vue-next"
import { onClickOutside, onKeyDown } from "@vueuse/core"

interface Props {
  title: string
  confirmText?: string
}

withDefaults(defineProps<Props>(), {
  confirmText: "Speichern",
  wide: false,
})

const emit = defineEmits(["close", "confirm"])

const dialog = ref<HTMLElement | null>(null)

function close() {
  emit("close")
}

function save() {
  emit("confirm")
}

const cancelButton = useTemplateRef("cancel")

onMounted(() => {
  document.getElementById("cancel")?.focus()
})

onClickOutside(dialog, () => emit("close"))
onKeyDown("Escape", () => emit("close"))
</script>

<template>
  <Teleport to="body">
    <div>
      <div class="fixed inset-0 z-50 bg-black/10"></div>
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <div class="max-h-full w-full max-w-md">
            <div ref="dialog" class="relative rounded-lg bg-white shadow">
              <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
                <h3 class="text-base font-medium text-neutral-900">{{ title }}</h3>
                <DButton :icon-left="XIcon" variant="secondary" class="!px-1" @click="close"></DButton>
              </div>
              <div class="items-start space-y-6 overflow-auto text-left">
                <slot></slot>
              </div>
              <div class="flex justify-end space-x-2 rounded-b border-t border-neutral-200 p-4">
                <DButton id="cancel" variant="secondary" @click="close">Abbrechen</DButton>
                <DButton variant="primary" @click="save">{{ confirmText }}</DButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
