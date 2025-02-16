<script setup lang="ts">
import { PlusIcon, GripVertical } from "lucide-vue-next"
import { componentFields } from "~~/server/database/schema"

type Field = typeof componentFields.$inferSelect

type Props = {
  field: Field
}

const { field } = defineProps<Props>()

const storyStore = useStoryStore()
const route = useRoute()
const siteId = route.params.siteId

const currentValue = computed(() => storyStore.content[field.fieldKey] as string)

const { data: components } = await useFetch(`/api/sites/${siteId}/components`)

const isAddModalOpen = ref(false)

function addBlock(blockId: string) {
  isAddModalOpen.value = false
  console.log(storyStore.currentStory)

  if (!storyStore.currentStory.content.blocks) {
    storyStore.currentStory.content.blocks = []
  }
  storyStore.currentStory.content.blocks.push({
    id: blockId,
    content: {}
  })
}

function getBlock(blockId: string) {
	if(!components.value) return
  return components.value.find((component) => component.id === blockId)
}
</script>
<template>
  <DFormGroup v-if="field.type === 'text'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DInput
      :model-value="currentValue"
      @input="storyStore.updateField(field.fieldKey, $event.target.value)"
      :placeholder="field.displayName || field.fieldKey"
    />
  </DFormGroup>
  <DFormGroup v-else-if="field.type === 'textarea'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DTextarea
      :model-value="storyStore.content[field.fieldKey] as string"
      @input="storyStore.updateField(field.fieldKey, ($event.target as HTMLTextAreaElement).value)"
      class="border-neutral rounded-lg border p-2 ring-offset-0 transition-all outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-300"
    />
  </DFormGroup>
  <div
    class="flex flex-col gap-2"
    v-else-if="field.type === 'blocks'"
  >
    Blocks
    <DList v-if="storyStore.content[field.fieldKey]">
      <DListItem
        v-for="(block, index) in storyStore.content[field.fieldKey]"
        :key="index"
      >
        <div class="text-copy flex w-full items-center justify-between">
          <div class="flex items-center gap-2">

            <DButton
              :icon-left="GripVertical"
              size="sm"
              variant="transparent"
            />
            <div class="w-60">
              {{ getBlock(block.id)?.displayName }}
							<pre>{{ getBlock(block.id) }}</pre>
            </div>
          </div>
        </div>
      </DListItem>
    </DList>
    <DButton
      variant="secondary"
      :icon-left="PlusIcon"
      @click="isAddModalOpen = true"
    >
      Add Block
    </DButton>

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
  <div
    class="bg-warn text-copy text-warn-onsurface rounded-md p-2"
    v-else-if="field.type === 'asset'"
  >
    Image
    <pre>{{ currentValue }}</pre>
  </div>
</template>
