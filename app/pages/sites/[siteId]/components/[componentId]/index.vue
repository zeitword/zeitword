<script setup lang="ts">
import { GripVertical } from "lucide-vue-next"
import { LexoRank } from "lexorank"
import Sortable from "sortablejs"
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from "vue"

const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")

const name = ref("")
const fieldType = ref("text")
const sortableInstance = ref<Sortable | null>(null)
const fieldsContainer = ref<HTMLElement | null>(null)
const isMounted = ref(false)

const { data: component, refresh } = await useFetch(
  `/api/sites/${siteId.value}/components/${componentId.value}`
)

const sortedFields = computed(() => {
  if (!component.value?.fields) {
    return []
  }
  return [...component.value.fields].sort((a, b) => a.order.localeCompare(b.order))
})

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function addField() {
  //Calculate lexorank of new field before adding.
  let newRank: LexoRank
  if (sortedFields.value.length === 0) {
    newRank = LexoRank.middle()
  } else {
    const lastField = sortedFields.value.at(-1)
    newRank = LexoRank.parse(lastField!.order).genNext()
  }

  await useRequestFetch()(`/api/sites/${siteId.value}/components/${componentId.value}/fields`, {
    method: "POST",
    body: {
      displayName: capitalize(name.value),
      name: name.value,
      fieldType: fieldType.value,
      order: newRank.toString() // Pass the initial order
    }
  })
  name.value = ""
  fieldType.value = "text"
  await refresh()
}

async function updateFieldOrder(fieldKey: string, newOrder: string) {
  await useRequestFetch()(
    `/api/sites/${siteId.value}/components/${componentId.value}/fields/${fieldKey}`,
    {
      method: "PATCH",
      body: { order: newOrder }
    }
  )
}

// Function to recalculate all field orders
async function recalculateFieldOrders() {
  const fields = [...sortedFields.value] // Work on a copy
  let currentRank = LexoRank.middle()

  for (const field of fields) {
    await updateFieldOrder(field.fieldKey, currentRank.toString())
    currentRank = currentRank.genNext()
  }
}

async function initSortable() {
  if (!fieldsContainer.value || !component.value?.fields) {
    return
  }
  await nextTick()

  if (sortableInstance.value) {
    sortableInstance.value.destroy()
  }

  sortableInstance.value = new Sortable(fieldsContainer.value, {
    handle: ".drag-handle",
    animation: 200,
    onUpdate: async (evt: any) => {
      const movedField = sortedFields.value[evt.oldIndex]
      const fields = [...sortedFields.value] // Create a copy!  Important!
      fields.splice(evt.oldIndex, 1)
      fields.splice(evt.newIndex, 0, movedField)

      let newRank: LexoRank
      if (evt.newIndex === 0) {
        // If moved to the beginning, get previous of the *next* item (index 1 after insertion)
        newRank = LexoRank.parse(fields[1].order).genPrev()
      } else if (evt.newIndex === fields.length - 1) {
        // If moved to the end, get next of the *previous* item.
        newRank = LexoRank.parse(fields[evt.newIndex - 1].order).genNext()
      } else {
        // If moved to the middle, get between the previous and next items.
        const prevRank = LexoRank.parse(fields[evt.newIndex - 1].order)
        const nextRank = LexoRank.parse(fields[evt.newIndex + 1].order)
        // This is where the problem was, add a check to make sure we don't call between on two items with the same order:
        if (prevRank.toString() === nextRank.toString()) {
          console.error("Ranks are equal, regenerating order")
          await recalculateFieldOrders() // Call your script's function here.
          await refresh()
          return
        }
        newRank = prevRank.between(nextRank)
      }

      // Update the field's order in the database
      await updateFieldOrder(movedField.fieldKey, newRank.toString())
      await refresh() // Refresh *after* updating the order.
    }
  })
}

watch(
  [() => component.value?.fields, () => isMounted.value],
  ([newFields, mounted]) => {
    if (mounted) {
      nextTick(() => {
        initSortable()
      })
    }
  },
  { deep: true }
)

onMounted(() => {
  isMounted.value = true
})

onBeforeUnmount(() => {
  if (sortableInstance.value) {
    sortableInstance.value.destroy()
  }
})
</script>

<template>
  <LayoutSidebarComponent>
    <form
      @submit.prevent="addField"
      class="mb-4 flex flex-col gap-4"
    >
      <div class="flex items-end gap-2">
        <DFormGroup class="flex-1">
          <DFormLabel>Field Name</DFormLabel>
          <DInput
            type="text"
            v-model.sanitize="name"
            placeholder="Field name"
          />
        </DFormGroup>
        <DFormGroup class="flex-1">
          <DFormLabel>Field Type</DFormLabel>
          <DSelect
            v-model="fieldType"
            class="bg-neutral-subtle text-copy w-full rounded-md p-2"
            :options="fieldTypes.map((type) => ({ display: type, value: type }))"
          />
        </DFormGroup>
        <DButton type="submit">Add Field</DButton>
      </div>
    </form>
    <div
      v-if="sortedFields.length > 0"
      class="border-neutral overflow-hidden rounded-md border"
      ref="fieldsContainer"
    >
      <div
        v-for="(field, index) in sortedFields"
        :key="field.fieldKey"
        class="hover:bg-neutral-hover group border-neutral flex border-b bg-white px-4 last:border-transparent"
      >
        <div class="text-copy flex flex-1 items-center gap-3">
          <DButton
            class="drag-handle"
            :icon-left="GripVertical"
            size="sm"
            variant="transparent"
          />
          <NuxtLink
            :to="`/sites/${siteId}/components/${component.id}/${field?.fieldKey}`"
            class="flex flex-1 items-center gap-2 py-3"
          >
            <div class="flex flex-1 items-center gap-2">
              <div>
                {{ field?.displayName }}
              </div>
              <div class="text-copy-sm bg-neutral border-neutral rounded-full border px-2 py-px">
                {{ field?.fieldKey }}
              </div>
            </div>
            <div class="text-copy-sm bg-neutral border-neutral rounded-full border px-2 py-px">
              {{ field?.type }}
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>
    <div v-else>No fields yet.</div>
  </LayoutSidebarComponent>
</template>
<style>
.sortable-drag {
  border-radius: 8px;
  opacity: 1;
}
.sortable-ghost {
  opacity: 0;
}
</style>
