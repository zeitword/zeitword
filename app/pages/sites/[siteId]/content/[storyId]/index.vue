<script setup lang="ts">
definePageMeta({ layout: "story" })

const storyStore = useStoryStore()

const storyId = useRouteParams<string>("storyId")

const { currentStory: story } = storeToRefs(storyStore)

await useAsyncData(`/stories/${storyId.value}`, () => storyStore.fetchStory(storyId.value))
const { toast } = useToast()
async function save() {
  await storyStore.save()
  toast.success({
    description: "The story has been saved."
  })
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
    <div class="flex-1 overflow-auto p-5">
      <pre>{{ storyStore.content }}</pre>
    </div>
    <div class="border-neutral flex w-[500px] flex-col gap-2 border-l p-5">
      <template v-for="field in story.component.fields">
        <DField :field="field" />
      </template>
    </div>
  </div>
</template>
