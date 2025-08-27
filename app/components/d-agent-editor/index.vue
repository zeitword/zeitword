<script setup lang="ts">
import { ArrowUpIcon } from "lucide-vue-next"
import type { UIMessage } from "ai"
import { Chat } from "@ai-sdk/vue"
import { createIdGenerator, DefaultChatTransport } from "ai"
import { computed, ref } from "vue"

interface Props {
  language: string
  siteId: string
  storyId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "updateNestedField", path: string[], value: any): void
}>()

const messages = ref<UIMessage[]>([
  {
    id: "message-0",
    role: "system",
    parts: [
      {
        type: "text",
        text: `You are a helpful assistant that can edit content. Helpful information: ${JSON.stringify(props)}`
      }
    ]
  }
])

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: "/api/ai/chat"
  }),
  generateId: createIdGenerator({ prefix: "msgc", size: 16 }),
  messages: messages.value,
  onToolCall: async ({ toolCall }) => {
    if (toolCall.dynamic) {
      return
    }

    console.log("toolCall", toolCall)

    if (toolCall.toolName === "updateNestedField") {
      console.log("updateNestedField", toolCall)
      emit("updateNestedField", toolCall.input.path, toolCall.input.value)
    }

    // if (toolCall.toolName === "getContent") {
    //   let result = {
    //     tool: toolCall.toolName,
    //     toolCallId: toolCall.toolCallId,
    //     output: props.content
    //   }

    //   console.log("result", result)

    //   chat.addToolResult(result)
    // }
  }
})

const messageList = computed(() => chat.messages) // computed property for type inference
const input = ref("")

const handleSubmit = (e: Event) => {
  e.preventDefault()
  chat.sendMessage({ text: input.value })
  input.value = ""
}
</script>

<template>
  <div class="stretch mx-auto flex w-full max-w-md flex-1 flex-col p-4">
    <div class="flex flex-1 flex-col overflow-auto">
      <div
        v-for="message in messageList"
        :key="message.id"
        class="flex flex-col whitespace-pre-wrap"
      >
        <template v-if="message.role === 'system'"></template>
        <template v-else>
          <strong>{{ `${message.role}: ` }}</strong>
          <div>
            <template v-for="part in message.parts">
              <div v-if="part.type === 'tool-getContent'">
                <div>Calling getContent tool</div>
              </div>
              <div v-else-if="part.type === 'tool-updateNestedField'">
                <div>Calling updateNestedField tool</div>
              </div>
              <div v-else-if="part.type === 'step-start'">Thinking</div>
              <div v-else-if="part.type === 'text'">
                {{ part.text }}
              </div>
              <div v-else-if="part.type === 'reasoning'">
                <div class="text-neutral-subtle italic">{{ part.text }}</div>
              </div>
              <div v-else>
                <pre>{{ part }}</pre>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <form
      @submit="handleSubmit"
      class="flex items-center gap-2"
    >
      <textarea
        v-model="input"
        class="text-neutral bg-neutral text-copy border-neutral focus:bg-neutral field-sizing-content max-h-64 min-h-10 flex-1 resize-none rounded-lg border p-2 ring-offset-0 transition-colors outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
        placeholder="Ask the agent anything..."
      ></textarea>
      <button
        type="submit"
        class="bg-neutral border-neutral flex size-10 items-center justify-center rounded-lg border"
      >
        <ArrowUpIcon class="size-4" />
      </button>
    </form>
  </div>
</template>
