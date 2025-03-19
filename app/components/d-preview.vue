<script setup lang="ts">
const props = defineProps({
  siteDomain: {
    type: String,
    required: true
  },
  storySlug: {
    type: String,
    required: true
  },
  content: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(["ready"])

const { content } = toRefs(props) // Create a reactive reference to the content prop

const domain = computed(() => {
  let d = props.siteDomain
  if (d.endsWith("/")) d = d.slice(0, -1)
  return d
})

const iframeUrl = computed(() => {
  if (!props.siteDomain || !props.storySlug) return null
  const slug = props.storySlug.replace("index", "")
  return `${domain.value}/preview/${slug}`
})

const sendPreviewUpdate = useDebounceFn((updatedContent) => {
  const previewFrame = document.getElementById("previewFrame")
  if (previewFrame && previewFrame.contentWindow) {
    previewFrame.contentWindow.postMessage(
      {
        type: "updatePreview",
        data: JSON.parse(JSON.stringify(updatedContent)) // Still need to clone
      },
      domain.value
    )
  }
}, 200)

// Watch the *reactive* content reference, deeply
watch(
  content, // Watch the reactive ref
  (newContent) => {
    sendPreviewUpdate(newContent)
  },
  { deep: true } // Watch for changes *within* the content object
)

onMounted(() => {
  window.addEventListener("message", (event) => {
    const allowedOrigins = ["https://app.zeitword.com", "http://localhost:"]
    if (!allowedOrigins.some((prefix) => event.origin.startsWith(prefix))) {
      return
    }

    if (event.data.type === "requestInitialData") {
      // Send the *current value* of the reactive content ref
      sendPreviewUpdate(content.value)
      emit("ready")
    }
  })
})

onBeforeUnmount(() => {
  window.removeEventListener("message", (event) => {
    const allowedOrigins = ["https://app.zeitword.com", "http://localhost:"]
    if (!allowedOrigins.some((prefix) => event.origin.startsWith(prefix))) {
      return
    }
    if (event.data.type === "requestInitialData") {
      sendPreviewUpdate(JSON.parse(JSON.stringify(props.content)))
    }
  })
})
</script>

<template>
  <iframe
    id="previewFrame"
    class="h-full w-full"
    :src="iframeUrl"
    v-if="iframeUrl"
    sandbox="allow-scripts allow-same-origin allow-popups"
  />
  <div v-else>
    <d-empty title="No preview available" />
  </div>
</template>
