<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from "radix-vue"
type Props = {
  title?: string
  delay?: number
  side?: "top" | "left" | "bottom" | "right"
  sideOffset?: number
  focusable?: boolean
}
const {
  title,
  delay = 100,
  side = "bottom",
  sideOffset = 2,
  focusable = true
} = defineProps<Props>()
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot>
      <TooltipTrigger :tabindex="focusable ? 0 : -1">
        <slot />
      </TooltipTrigger>
      <TooltipPortal class="pointer-events-none">
        <TooltipContent
          class="data-[state=delayed-open]:animate-slideDownAndFade pointer-events-none rounded-lg bg-neutral-900 px-2 py-1 text-sm text-white will-change-[transform,opacity] select-none"
          :side-offset="sideOffset"
          :side="side"
          avoid-collisions
        >
          {{ title }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
