<script setup lang="ts">
import { provide, ref, computed, onUnmounted, watch } from "vue"
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

const collapsed = ref(!props.isStreaming)
const hovered = ref(false)
const hoveredIndex = ref<number | null>(null)
let collapseTimer: ReturnType<typeof setTimeout> | null = null

const hasNoContent = computed(() => {
  if (props.message.orderedItems?.length) return false
  if (props.message.tool_calls?.length) return false
  if (props.message.content?.trim()) return false
  return true
})

if (props.message.compactBoundary && props.message.freshlyStreamed) {
  collapsed.value = false
  watch(() => props.message.freshlyStreamed, (val) => {
    if (!val && collapseTimer === null) {
      collapseTimer = setTimeout(() => {
        collapsed.value = true
        collapseTimer = null
      }, 1000)
    }
  })
} else if (props.message.freshlyStreamed) {
  collapsed.value = false
  collapseTimer = setTimeout(() => {
    collapsed.value = true
    collapseTimer = null
  }, 1000)
} else {
  collapsed.value = props.isStreaming ? false : true
  watch(() => props.isStreaming, (val) => {
    collapsed.value = !val
  })
}

onUnmounted(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
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
  <div v-if="!hasNoContent || isStreaming" :class="['message', message.role, { 'compact-boundary': message.compactBoundary }]">
    <div v-if="message.compactBoundary" class="compact-divider">
      <span class="compact-divider-label">{{ t("compact_divider") }}</span>
    </div>
    <div class="avatar">
      {{ message.role === "user" ? "U" : message.compactBoundary ? "S" : "A" }}
    </div>
    <div class="bubble">
      <div v-if="message.compactBoundary" class="compact-summary-badge">{{ t("compact_title") }}</div>
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
  position: relative;
}
.message.user {
  flex-direction: row-reverse;
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.message.user .avatar {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid var(--glass-border);
}
.message.assistant .avatar {
  background: var(--surface-bg);
  color: var(--success);
  border: 1px solid var(--glass-border);
}
.bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.5;
}
.message.user .bubble {
  background: var(--accent-dim);
  color: var(--text-primary);
  border-bottom-right-radius: 4px;
  border: 1px solid var(--glass-border);
}
.message.assistant .bubble {
  background: var(--glass-bg);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--glass-border);
}
.message.assistant.compact-boundary .bubble {
  background: var(--surface-raised);
  border-color: var(--accent-dim);
  border-style: dashed;
  padding-top: 6px;
  border-left: 3px solid var(--accent-dim);
  border-radius: 4px 14px 14px 4px;
}
.compact-boundary .avatar {
  background: var(--accent-dim) !important;
  color: var(--accent) !important;
}
.compact-boundary .bubble .compact-summary-badge {
  display: inline-block;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 4px;
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
  padding: 5px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 0;
  opacity: 0;
  transition: opacity var(--transition-duration), color var(--transition-duration);
}
.copyable:hover .copy-btn {
  opacity: 1;
}
.copy-btn:hover {
  color: var(--accent);
}
.compact-boundary {
  margin-top: 40px !important;
}
.compact-divider {
  position: absolute;
  top: -20px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.compact-divider::before,
.compact-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--glass-border);
}
.compact-divider-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
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
