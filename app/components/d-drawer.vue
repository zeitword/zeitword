<script setup lang="ts">
import { XIcon } from "lucide-vue-next"

type Props = {
  open: boolean
}

const { open } = defineProps<Props>()
const emit = defineEmits(["close"])

const drawer = ref<HTMLElement | null>(null)

function close() {
  emit("close")
}
</script>

<template>
  <div
    class="fixed inset-0"
    :class="open ? '' : 'pointer-events-none'"
  >
    <div
      class="bg-neutral-inverse/5 absolute inset-0 z-10 backdrop-blur-xs transition-all"
      :class="open ? 'opacity-100' : 'opacity-0'"
      @click="close"
    ></div>
    <Transition name="slide-fade">
      <div
        v-if="open"
        class="absolute top-0 right-0 z-20 flex h-full w-[500px] flex-col p-5"
        ref="drawer"
      >
        <div class="bg-neutral relative flex-1 overflow-y-auto rounded-lg p-5 shadow-lg">
          <div class="absolute top-2 right-2">
            <DButton
              @click="close"
              variant="transparent"
              :icon-left="XIcon"
            />
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>
