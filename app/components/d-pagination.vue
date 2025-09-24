<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon, ArrowRightIcon } from "lucide-vue-next"
import {
  PaginationEllipsis,
  PaginationFirst,
  PaginationLast,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  PaginationRoot
} from "reka-ui"

const offset = defineModel<number>("offset", { default: 0 })
const props = defineProps<{
  total: number
  limit: number
}>()

const page = computed({
  get: () => Math.floor(offset.value / props.limit) + 1,
  set: (value) => {
    offset.value = (value - 1) * props.limit
  }
})
</script>

<template>
  <PaginationRoot
    :total="total"
    :sibling-count="1"
    :items-per-page="limit"
    show-edges
    :default-page="page"
    v-model:page="page"
    class="flex w-full justify-center py-6"
  >
    <PaginationList
      v-slot="{ items }"
      class="flex items-center gap-1 text-stone-700 dark:text-white"
    >
      <PaginationFirst
        class="text-neutral hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <ArrowLeftIcon />
      </PaginationFirst>
      <PaginationPrev
        class="text-neutral hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <ChevronLeftIcon />
      </PaginationPrev>
      <template v-for="(page, index) in items">
        <PaginationListItem
          v-if="page.type === 'page'"
          :key="index"
          class="text-neutral border-neutral hover:bg-neutral-weak hover:shadow-button data-[selected]:bg-neutral-inverse data-[selected]:text-neutral-inverse data-[selected]:inset-shadow bg-neutral relative inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2"
          :value="page.value"
        >
          {{ page.value }}
        </PaginationListItem>
        <PaginationEllipsis
          v-else
          :key="page.type"
          :index="index"
          class="text-neutral flex h-9 w-9 items-center justify-center"
        >
          &#8230;
        </PaginationEllipsis>
      </template>
      <PaginationNext
        class="text-neutral hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <ChevronRightIcon />
      </PaginationNext>
      <PaginationLast
        class="text-neutral hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <ArrowRightIcon />
      </PaginationLast>
    </PaginationList>
  </PaginationRoot>
</template>
