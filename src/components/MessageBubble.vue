<script setup lang="ts">
import { provide, ref, computed, onMounted, watch } from "vue"
import type { Message } from "../types"
import ReasoningBlock from "./ReasoningBlock.vue"
import ToolCallRenderer from "./ToolCallRenderer.vue"
import AgentAnswer from "./AgentAnswer.vue"
import { FOLDABLE_COLLAPSED_KEY } from "../toolContext"
import { useI18nStore } from "../stores/i18n"

const { t } = useI18nStore()

const props = defineProps<{
  message: Message
  isStreaming?: boolean
}>()

const collapsed = ref(
  props.message.freshlyStreamed ? false : !props.isStreaming
)
const hovered = ref(false)
const hoveredIndex = ref<number | null>(null)

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

async function copy(text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement("textarea")
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }
}
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
            class="content-segment copyable"
            @mouseenter="hoveredIndex = i"
            @mouseleave="hoveredIndex = null"
          >
            <AgentAnswer :content="item.text ?? ''" />
            <button
              v-show="hoveredIndex === i"
              class="copy-btn"
              :title="t('copy')"
              @click="copy(item.text ?? '')"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
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
        <div
          v-if="message.content"
          class="copyable"
          @mouseenter="hovered = true"
          @mouseleave="hovered = false"
        >
          <AgentAnswer :content="message.content" />
          <button
            v-show="hovered"
            class="copy-btn"
            :title="t('copy')"
            @click="copy(message.content)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
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
.copyable {
  position: relative;
}
.copy-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 4px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 0;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.copy-btn:hover {
  opacity: 1;
  color: var(--accent);
  border-color: var(--accent);
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
