<script setup lang="ts">
import { provide, ref, computed, onMounted, watch } from "vue"
import type { Message } from "../types"
import ReasoningBlock from "./ReasoningBlock.vue"
import ToolCallRenderer from "./ToolCallRenderer.vue"
import AgentAnswer from "./AgentAnswer.vue"
import { FOLDABLE_COLLAPSED_KEY } from "../toolContext"

const props = defineProps<{
  message: Message
  isStreaming?: boolean
}>()

const collapsed = ref(
  props.message.freshlyStreamed ? false : !props.isStreaming
)

const hasNoContent = computed(() => {
  if (props.message.orderedItems?.length) return false
  if (props.message.tool_calls?.length) return false
  if (props.message.content?.trim()) return false
  return true
})

onMounted(() => {
  if (props.message.freshlyStreamed) {
    setTimeout(() => { collapsed.value = true }, 1000)
  }
})

watch(() => props.isStreaming, (val) => {
  collapsed.value = !val
})

provide(FOLDABLE_COLLAPSED_KEY, collapsed)
</script>

<template>
  <div v-if="!hasNoContent || isStreaming" :class="['message', message.role]">
    <div class="avatar">
      {{ message.role === "user" ? "U" : "A" }}
    </div>
    <div class="bubble">
      <template v-if="message.orderedItems">
        <template v-for="(item, i) in message.orderedItems" :key="i">
          <ReasoningBlock
            v-if="item.type === 'reasoning'"
            :text="item.text ?? ''"
          />
          <div
            v-else-if="item.type === 'content'"
            class="content-segment"
          >
            <AgentAnswer :content="item.text ?? ''" />
          </div>
          <ToolCallRenderer
            v-else-if="
              item.type === 'tool_call' &&
              message.tool_calls?.[item.toolCallIndex ?? -1]
            "
            :tool="message.tool_calls[item.toolCallIndex!]"
          />
        </template>
      </template>

      <template v-else>
        <div v-if="message.tool_calls?.length" class="tool-calls">
          <ToolCallRenderer
            v-for="tc in message.tool_calls"
            :key="tc.id"
            :tool="tc"
          />
        </div>
        <AgentAnswer v-if="message.content" :content="message.content" />
      </template>

      <div
        v-if="isStreaming && !message.orderedItems?.length"
        class="thinking"
      >
        <span class="dot-pulse"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.message.user {
  flex-direction: row-reverse;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.message.user .avatar {
  background: var(--accent-dim);
  color: var(--accent);
}
.message.assistant .avatar {
  background: var(--surface-bg);
  color: var(--success);
}
.bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
}
.message.user .bubble {
  background: var(--accent-dim);
  color: var(--text-primary);
  border-bottom-right-radius: 4px;
}
.message.assistant .bubble {
  background: var(--surface-alt);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}
.tool-calls {
  margin-bottom: 8px;
}
.content-segment {
  margin-bottom: 8px;
}
.content-segment:last-child {
  margin-bottom: 0;
}
.thinking {
  padding: 8px 0;
}
.dot-pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}
</style>
