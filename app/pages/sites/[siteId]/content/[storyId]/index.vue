<script setup lang="ts">
definePageMeta({
  layout: "story"
})
const storyStore = useStoryStore()
const story = computed(() => storyStore.currentStory)

const route = useRoute()
const siteId = route.params.siteId

const { data: components } = await useFetch(`/api/sites/${siteId}/components`)

function save() {
  storyStore.save()
}

function publish() {
  console.log("publish")
}
</script>

<template>
  <DPageTitle
    v-if="story"
    :title="story.title"
    wide
  >
    <template #subtitle>
      <p class="text-copy-sm text-neutral-subtle">/{{ story.slug }}</p>
    </template>
    <div class="flex gap-2">
      <DButton
        variant="secondary"
        @click="save"
        :disabled="!storyStore.hasChanges"
      >
        Save
      </DButton>
      <DButton @click="publish">Publish</DButton>
    </div>
  </DPageTitle>
  <div
    v-if="story"
    class="flex flex-1"
  >
    <div class="flex-1 p-5">
      <pre>{{ storyStore.content }}</pre>
    </div>
    <div class="border-neutral flex w-[500px] flex-col gap-2 border-l p-5">
      <template v-for="field in story.component.fields">
        <DField :field="field" />
      </template>
    </div>
  </div>
</template>
