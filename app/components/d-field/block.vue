<script setup lang="ts">
import { ChevronDownIcon, GripVertical, Trash2Icon } from "lucide-vue-next"
import { componentFields } from "~~/server/database/schema"

type Field = typeof componentFields.$inferSelect

type Props = {
  block: Field
  index: number
  path?: string[]
}

const { block, index, path = [] } = defineProps<Props>()

const blockPath = computed(() => [...path, index.toString(), "content"])

const isBlockOpen = ref(false)

function deleteBlock() {
  console.log("deleting block")
}

const isRoot = computed(() => path.length === 0)
</script>
<template>
  <div>
    <div
      class="bg-neutral flex w-full flex-col"
      v-if="block"
    >
      <div class="group flex w-full items-center gap-2 px-2 py-2">
        <DButton
          :icon-left="GripVertical"
          size="sm"
          variant="transparent"
        />
        <button
          class="flex flex-1 items-center gap-2 text-left"
          @click="isBlockOpen = !isBlockOpen"
        >
          <div
            class="group-hover:border-neutral grid size-7 place-items-center rounded-md group-hover:border"
          >
            <ChevronDownIcon
              class="size-4"
              :class="[isBlockOpen ? 'rotate-180' : '']"
            />
          </div>
          <div class="text-copy-lg text-neutral flex-1">
            {{ block.displayName }}
          </div>
        </button>
        <div class="hidden group-hover:flex">
          <DButton
            variant="secondary"
            size="sm"
            :icon-left="Trash2Icon"
            @click="deleteBlock"
          ></DButton>
        </div>
      </div>
      <div
        class="bg-neutral-subtle flex flex-col gap-2 p-2"
        v-if="isBlockOpen"
      >
        <template v-for="field in block.fields">
          <DField
            :field="field"
            :path="blockPath"
          />
        </template>
      </div>
    </div>
  </div>
</template>
