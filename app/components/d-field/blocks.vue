<script setup lang="ts">
import { PlusIcon } from "lucide-vue-next"
import type { DField } from "~/types/models"

type Props = {
  field: DField
  path?: string[]
}

const { field, path = [] } = defineProps<Props>()

const storyStore = useStoryStore()
const siteId = useRouteParams("siteId")

const { data: components } = await useFetch(
  `/api/sites/${siteId.value}/components`
)

const isAddModalOpen = ref(false)

function addBlock(blockId: string) {
  isAddModalOpen.value = false

  const blockPath = [...path, field.fieldKey]
  const currentBlocks = storyStore.getNestedValue(blockPath) || []

  const newBlock = {
    id: blockId,
    content: {}
  }

  storyStore.updateNestedField(blockPath, [...currentBlocks, newBlock])
}

function getBlock(blockId: string) {
  if (!components) return
  return components.value?.find((block) => block.id === blockId)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <div
      class="border-neutral bg-neutral-subtle overflow-hidden rounded-lg border"
    >
      <div
        v-if="storyStore.getNestedValue([...path, field.fieldKey])"
        class="overflow-hidden rounded-lg shadow-md"
      >
        <DFieldBlock
          v-for="(block, index) in storyStore.getNestedValue([
            ...path,
            field.fieldKey
          ])"
          :block="getBlock(block.id)"
          :index="index"
          :path="[...path, field.fieldKey]"
          class="border-neutral overflow-hidden border-b last:border-none"
        />
      </div>

      <div class="p-1">
        <DButton
          variant="transparent"
          size="sm"
          :icon-left="PlusIcon"
          @click="isAddModalOpen = true"
          class="w-full"
        >
          Add Block
        </DButton>
      </div>
    </div>

    <DModal
      :open="isAddModalOpen"
      title="Add Block"
      @close="isAddModalOpen = false"
    >
      <div class="flex flex-col gap-2 p-5">
        <DList>
          <DListItem
            v-for="block in components"
            :key="block.id"
            @click="addBlock(block.id)"
          >
            <div class="text-copy flex w-full items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-60">
                  {{ block?.displayName }}
                </div>
              </div>
            </div>
          </DListItem>
        </DList>
      </div>
    </DModal>
  </div>
</template>
