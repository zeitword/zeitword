<script setup lang="ts">
import { ArrowUpIcon } from "lucide-vue-next"
import type { UIMessage } from "ai"
import { Chat } from "@ai-sdk/vue"
import {
  createIdGenerator,
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls
} from "ai"
import { computed, ref } from "vue"

interface Props {
  language: string
  siteId: string
  storyId: string
  content: any
  sortedFields: any[]
}

const props = defineProps<Props>()

const content = computed(() => props.content)

const { data: availableComponents } = await useFetch(`/api/sites/${props.siteId}/components`)

const emit = defineEmits<{
  (e: "updateNestedField", path: string[], value: any): void
  (e: "addBlock", { componentId }: { componentId: string }): void
}>()

const messages = ref<UIMessage[]>([
  {
    id: "message-0",
    role: "system",
    parts: [
      {
        type: "text",
        text: `You are a helpful assistant that can edit content. Helpful information: ${JSON.stringify(
          {
            siteId: props.siteId,
            storyId: props.storyId,
            language: props.language
          }
        )}`
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
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  onToolCall: async ({ toolCall }) => {
    if (toolCall.dynamic) {
      return
    }

    console.log(`[${toolCall.toolName}]`, toolCall)

    switch (toolCall.toolName) {
      case "updateBlockField": {
        console.log("updateBlockField", toolCall)
        const { blockId, fieldKey, value } = toolCall.input as unknown as any
        // we can call emit updateNestedField but to do that we need to construct the path first
        let blockIndex = content.value[props.language].blocks.findIndex(
          (block: any) => block.id === blockId
        )

        const path = [props.language, "blocks", blockIndex, "content", fieldKey]

        emit("updateNestedField", path, value)

        chat.addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: "Block field updated"
        })

        break
      }
      case "listAvailableBlockTypes": {
        console.log("listAvailableBlockTypes", toolCall)

        // extract [{ id, name, displayName, fields: [{fieldKey, displayName, type, componentWhitelist}]}]
        const blockTypes = availableComponents.value!.map((component: any) => ({
          id: component.id,
          name: component.name,
          displayName: component.displayName,
          fields: component.fields.map((field: any) => ({
            fieldKey: field.fieldKey,
            displayName: field.displayName,
            type: field.type,
            componentWhitelist: field.componentWhitelist
          }))
        }))
        console.log("blockTypes", blockTypes)

        chat.addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: blockTypes
        })

        break
      }
      case "getBlock": {
        const block = content.value[props.language].blocks.find(
          (block: any) => block.id === toolCall.input.blockId
        )
        if (!block) {
          chat.addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: "Block not found"
          })
        } else {
          chat.addToolResult({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: block
          })
        }
        break
      }
      case "addBlock": {
        console.log("addBlock", toolCall)
        emit("addBlock", toolCall.input as unknown as { componentId: string })

        chat.addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: "Block added"
        })

        break
      }
      case "listBlocks": {
        chat.addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: listBlocks()
        })
        break
      }
      default: {
        console.log(`[${toolCall.toolName}] Not implemented`)
        chat.addToolResult({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: "Not implemented"
        })
        break
      }
    }
  }
})

const messageList = computed(() => chat.messages) // computed property for type inference
const input = ref("")

const handleSubmit = (e: Event) => {
  e.preventDefault()
  chat.sendMessage({ text: input.value })
  input.value = ""
}

function listBlocks() {
  let blocks = content.value[props.language].blocks
  // remove the content field from the blocks
  blocks = blocks.map((block: any) => {
    const { content, ...rest } = block
    return { blockId: block.id, blockName: block.componentName, componentId: block.componentId }
  })

  // using sortedfields ensure that if a "fieldKey" isn't present, that we populate it with an empty object
  blocks = blocks.map((block: any) => {
    const { content, ...rest } = block

    const fields = availableComponents.value
      ?.filter((field: any) => field.id === block.componentId)
      .reduce((acc: any, field: any) => {
        return field.fields.reduce((acc: any, subField: any) => {
          acc.push(subField.fieldKey)
          return acc
        }, [])
      }, [])

    return {
      ...rest,
      fields: fields
    }
  })

  return blocks
}

const listedBlocks = computed(() => listBlocks())
</script>

<template>
  <div class="stretch mx-auto flex h-full w-full flex-1 flex-col p-4">
    <div class="flex h-full flex-1 flex-col gap-2 overflow-auto">
      <!-- <pre>{{ availableComponents }}</pre> -->
      <!-- <pre>{{ listedBlocks }}</pre> -->
      <div
        v-for="message in messageList"
        :key="message.id"
        class="flex flex-col gap-2 whitespace-pre-wrap"
      >
        <template v-if="message.role === 'system'"></template>
        <template v-else>
          <strong>{{ `${message.role}: ` }}</strong>
          <div>
            <template v-for="part in message.parts">
              <div v-if="part.type === 'tool-web_search_preview'">
                <div class="text-neutral-subtle italic">searching the web...</div>
              </div>
              <div v-else-if="part.type === 'tool-updateBlockField'">
                <div class="text-neutral-subtle italic">updating block field</div>
              </div>
              <div v-else-if="part.type === 'tool-listBlocks'">
                <div class="text-neutral-subtle italic">listing blocks</div>
              </div>
              <div v-else-if="part.type === 'tool-listAvailableBlockTypes'">
                <div class="text-neutral-subtle italic">listing available block types</div>
              </div>
              <div v-else-if="part.type === 'tool-getBlock'">
                <div class="text-neutral-subtle italic">getting block</div>
              </div>
              <div v-else-if="part.type === 'tool-addBlock'">
                <div class="text-neutral-subtle italic">adding block</div>
              </div>
              <div v-else-if="part.type === 'step-start'">
                <div class="text-neutral-subtle italic">considering</div>
              </div>
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
