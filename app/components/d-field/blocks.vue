<script setup lang="ts">
import { PlusIcon } from "lucide-vue-next"
import type { DField } from "~/types/models"

type Props = {
  field: DField
  path?: string[]
  value: any
}

const { field, path = [], value } = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", path: string[], index: number): void
}>()

const siteId = useRouteParams("siteId")

const { data: availableComponents } = await useFetch<Component[]>(
  `/api/sites/${siteId.value}/components`
)

const isAddModalOpen = ref(false)

function addBlock(blockId: string) {
  isAddModalOpen.value = false

  const currentBlocks = Array.isArray(value) ? value : [] // Ensure it's an array

  const newBlock = {
    id: blockId,
    content: {}
  }

  emit("update:value", [...currentBlocks, newBlock])
}

function getBlock(blockId: string) {
  return availableComponents.value?.find((block) => block.id === blockId)
}

function updateNestedBlock(index: number, updatedBlock: any) {
  if (!Array.isArray(value)) {
    console.error("Value is not an array in updateNestedBlock", value)
    return
  }
  const newBlocks = [...value]
  newBlocks[index] = updatedBlock
  emit("update:value", newBlocks)
}

function deleteBlock(path: string[], index: number) {
  console.log("blocks.vue", path, index)
  emit("delete-block", path, index)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <div class="border-neutral bg-neutral-subtle overflow-hidden rounded-lg border">
      <div
        v-if="value"
        class="overflow-hidden rounded-lg shadow-md"
      >
        <DFieldBlock
          v-for="(block, index) in value"
          :key="index"
          :block="getBlock(block.id)"
          :block-content="block"
          :index="index"
          :path="path"
          class="border-neutral overflow-hidden border-b last:border-none"
          @update:value="updateNestedBlock(index, $event)"
          @delete-block="(path, index) => deleteBlock(path, index)"
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
            v-for="block in availableComponents"
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
