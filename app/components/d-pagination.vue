<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon, ArrowRight, ArrowRightIcon } from 'lucide-vue-next'
import { PaginationEllipsis, PaginationFirst, PaginationLast, PaginationList, PaginationListItem, PaginationNext, PaginationPrev, PaginationRoot } from 'reka-ui'

const offset = defineModel<number>('offset', { default: 0 })
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
    <PaginationRoot :total="total" :sibling-count="1" :items-per-page="limit" show-edges :default-page="page"
        v-model:page="page" class="flex justify-center w-full py-6">
        <PaginationList v-slot="{ items }" class="flex items-center gap-1 text-stone-700 dark:text-white">
            <PaginationFirst
                class="w-9 h-9 text-neutral disabled:opacity-50 hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer">
                <ArrowLeftIcon />
            </PaginationFirst>
            <PaginationPrev
                class="w-9 h-9 text-neutral disabled:opacity-50 hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer">
                <ChevronLeftIcon />
            </PaginationPrev>
            <template v-for="(page, index) in items">
                <PaginationListItem v-if="page.type === 'page'" :key="index"
                    class="w-9 h-9 text-neutral cursor-pointer border border-neutral hover:bg-neutral-weak hover:shadow-button data-[selected]:bg-neutral-inverse data-[selected]:text-neutral-inverse data-[selected]:inset-shadow bg-neutral relative inline-flex items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    :value="page.value">
                    {{ page.value }}
                </PaginationListItem>
                <PaginationEllipsis v-else :key="page.type" :index="index"
                    class="w-9 h-9 flex items-center justify-center text-neutral">
                    &#8230;
                </PaginationEllipsis>
            </template>
            <PaginationNext
                class="w-9 h-9 text-neutral disabled:opacity-50 hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer">
                <ChevronRightIcon />
            </PaginationNext>
            <PaginationLast
                class="w-9 h-9 text-neutral disabled:opacity-50 hover:bg-neutral-strong/10 active:inset-shadow relative inline-flex items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer">
                <ArrowRightIcon />
            </PaginationLast>
        </PaginationList>
    </PaginationRoot>
</template>