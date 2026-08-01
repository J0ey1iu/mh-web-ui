<script setup lang="ts">
import { provide, ref, computed, onUnmounted, watch } from "vue"
import type { Message } from "../types"
// @ts-ignore used in template
import FeedbackWidget from "./FeedbackWidget.vue"
// @ts-ignore used in template
import ReasoningBlock from "./ReasoningBlock.vue"
// @ts-ignore used in template
import ToolCallRenderer from "./ToolCallRenderer.vue"
// @ts-ignore used in template
import AgentAnswer from "./AgentAnswer.vue"
import { FOLDABLE_COLLAPSED_KEY } from "../toolContext"
import { useChatStore } from "../stores/chat"
import { useI18nStore } from "../stores/i18n"

// @ts-ignore used in template
const { t } = useI18nStore()
// @ts-ignore used in template
const chatStore = useChatStore()

const props = defineProps<{
  message: Message
  isStreaming?: boolean
}>()

const collapsed = ref(!props.isStreaming)
const hovered = ref(false)
const hoveredIndex = ref<number | null>(null)
let collapseTimer: ReturnType<typeof setTimeout> | null = null

function getFeedback(key: string): { feedback_type: "thumbs_up" | "thumbs_down"; feedback_id: string } | null {
  const fb = chatStore.feedbackState[key]
  if (!fb) return null
  return { feedback_type: fb.feedback_type as "thumbs_up" | "thumbs_down", feedback_id: fb.feedback_id }
}

// @ts-ignore used in template
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

// @ts-ignore used in template
function toggleCompactCollapse() {
  if (!props.message.compactBoundary) return
  collapsed.value = !collapsed.value
  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
}

// @ts-ignore used in template
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
    <template v-if="message.compactBoundary">
      <span class="compact-rule" aria-hidden="true"></span>
      <div class="compact-stack" :class="{ 'compact-enter': message.freshlyStreamed }">
        <div class="compact-panel" :class="{ 'is-collapsed': collapsed }">
          <div class="compact-header" @click="toggleCompactCollapse">
            <div class="compact-header-left">
              <span class="compact-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </span>
              <span class="compact-header-title">{{ t("compact_title") }}</span>
            </div>
            <div class="compact-header-right">
              <div v-if="message.compactStats" class="compact-chips">
                <span class="compact-chip">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  {{ message.compactStats.duration }}ms
                </span>
                <span class="compact-chip">{{ message.compactStats.droppedMessageCount }} {{ t("compact_messages") }}</span>
              </div>
              <svg :class="['compact-chevron', { 'is-open': !collapsed }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <div class="compact-body" :class="{ collapsed: collapsed }">
            <div class="compact-content">
              <div class="compact-content-inner">
              <template v-if="message.orderedItems">
                <template v-for="(item, i) in message.orderedItems" :key="i">
                  <ReasoningBlock
                    v-if="item.type === 'reasoning'"
                    :text="item.text ?? ''"
                  />
                  <div
                    v-else-if="item.type === 'content'"
                    class="content-segment"
                    @mouseenter="hoveredIndex = i"
                    @mouseleave="hoveredIndex = null"
                  >
                    <AgentAnswer :content="item.text ?? ''" />
                    <div v-show="hoveredIndex === i" class="segment-actions">
                      <FeedbackWidget
                        v-if="message.role === 'assistant'"
                        :session-id="chatStore.currentSessionId ?? ''"
                        target-type="message"
                        :target-id="message.id"
                        :existing-feedback-type="getFeedback(`message:${message.id}`)?.feedback_type"
                        :existing-feedback-id="getFeedback(`message:${message.id}`)?.feedback_id"
                      />
                      <button class="copy-btn" :title="t('copy')" @click="copy(item.text ?? '')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
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
                  class="content-segment"
                  @mouseenter="hovered = true"
                  @mouseleave="hovered = false"
                >
                  <AgentAnswer :content="message.content" />
                  <div v-show="hovered" class="segment-actions">
                    <FeedbackWidget
                      v-if="message.role === 'assistant'"
                      :session-id="chatStore.currentSessionId ?? ''"
                      target-type="message"
                      :target-id="message.id"
                      :existing-feedback-type="getFeedback(`message:${message.id}`)?.feedback_type"
                      :existing-feedback-id="getFeedback(`message:${message.id}`)?.feedback_id"
                    />
                    <button class="copy-btn" :title="t('copy')" @click="copy((message.content ?? ''))">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
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
          </div>
        </div>
      </div>
      <span class="compact-rule" aria-hidden="true"></span>
    </template>
    <template v-else>
      <div class="avatar">
        {{ message.role === "user" ? "U" : "A" }}
      </div>
      <div :class="['bubble', { 'auto-msg': message.auto }]">
        <span v-if="message.auto" class="auto-msg-label">{{ t("auto_message_label") }}</span>
        <template v-if="message.orderedItems">
          <template v-for="(item, i) in message.orderedItems" :key="i">
            <ReasoningBlock
              v-if="item.type === 'reasoning'"
              :text="item.text ?? ''"
            />
            <div
              v-else-if="item.type === 'content'"
              class="content-segment"
              @mouseenter="hoveredIndex = i"
              @mouseleave="hoveredIndex = null"
            >
              <AgentAnswer :content="item.text ?? ''" />
              <div v-show="hoveredIndex === i" class="segment-actions">
                <FeedbackWidget
                  v-if="message.role === 'assistant'"
                  :session-id="chatStore.currentSessionId ?? ''"
                  target-type="message"
                  :target-id="message.id"
                  :existing-feedback-type="getFeedback(`message:${message.id}`)?.feedback_type"
                  :existing-feedback-id="getFeedback(`message:${message.id}`)?.feedback_id"
                />
                <button class="copy-btn" :title="t('copy')" @click="copy(item.text ?? '')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
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
            class="content-segment"
            @mouseenter="hovered = true"
            @mouseleave="hovered = false"
          >
            <AgentAnswer :content="message.content" />
            <div v-show="hovered" class="segment-actions">
              <FeedbackWidget
                v-if="message.role === 'assistant'"
                :session-id="chatStore.currentSessionId ?? ''"
                target-type="message"
                :target-id="message.id"
                :existing-feedback-type="getFeedback(`message:${message.id}`)?.feedback_type"
                :existing-feedback-id="getFeedback(`message:${message.id}`)?.feedback_id"
              />
              <button class="copy-btn" :title="t('copy')" @click="copy((message.content ?? ''))">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
        </template>

        <div
          v-if="isStreaming && !message.orderedItems?.length"
          class="thinking"
        >
          <span class="dot-pulse"></span>
        </div>
      </div>
    </template>
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
.message.user .bubble.auto-msg {
  background: transparent;
  border-style: dashed;
  color: var(--text-muted);
  font-size: 13px;
  padding: 6px 12px;
}
.auto-msg-label {
  display: inline-block;
  margin-bottom: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--glass-bg);
  border: 1px dashed var(--glass-border);
  font-size: 11px;
  color: var(--text-muted);
}
.message.assistant .bubble {
  background: var(--glass-bg);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--glass-border);
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

.content-segment {
  position: relative;
}

.segment-actions {
  position: absolute;
  bottom: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.segment-actions .feedback-widget {
  margin-top: 0;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 0;
  transition: color var(--transition-duration);
}
.copy-btn:hover {
  color: var(--accent);
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

/* ── Compaction card ── */
.compact-boundary {
  margin-top: 28px;
  padding: 0 16px;
}
.compact-stack {
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
}
.compact-stack::before,
.compact-stack::after {
  content: "";
  position: absolute;
  height: 100%;
  border-radius: 12px;
  background: var(--surface-raised);
  border: 1px solid var(--glass-border);
  z-index: 0;
  pointer-events: none;
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.compact-stack::before {
  top: -5px;
  left: 6px;
  right: 6px;
  opacity: 0.55;
}
.compact-stack::after {
  top: -10px;
  left: 12px;
  right: 12px;
  opacity: 0.3;
}
.compact-stack:hover::before {
  transform: translateY(-2px);
  opacity: 0.7;
}
.compact-stack:hover::after {
  transform: translateY(-4px);
  opacity: 0.45;
}
.compact-panel {
  position: relative;
  z-index: 1;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-bg);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.compact-panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.45;
  z-index: 2;
  pointer-events: none;
}
.compact-stack:hover .compact-panel {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--glass-border));
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22), 0 0 24px color-mix(in srgb, var(--accent) 10%, transparent);
}
.compact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(135deg, var(--surface-alt) 0%, color-mix(in srgb, var(--accent-dim) 30%, var(--surface-alt)) 100%);
  border-bottom: 1px solid var(--glass-border);
  cursor: pointer;
  user-select: none;
  transition: background 0.25s ease, border-color 0.3s ease;
}
.compact-header:hover {
  background: linear-gradient(135deg, var(--surface-raised) 0%, color-mix(in srgb, var(--accent-dim) 45%, var(--surface-raised)) 100%);
}
.compact-header:hover .compact-chevron {
  color: var(--accent);
}
.compact-panel.is-collapsed .compact-header {
  border-bottom-color: transparent;
}
.compact-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.compact-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--accent-dim);
  color: var(--accent);
  flex-shrink: 0;
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 25%, transparent);
}
.compact-icon-badge svg {
  width: 14px;
  height: 14px;
}
.compact-header-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--text-strong);
  white-space: nowrap;
}
.compact-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.compact-chips {
  display: flex;
  align-items: center;
  gap: 6px;
}
.compact-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--accent-dim) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
}
.compact-chip svg {
  width: 10px;
  height: 10px;
}
.compact-chevron {
  width: 15px;
  height: 15px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: transform 0.3s ease, color 0.2s ease;
}
.compact-chevron.is-open {
  transform: rotate(180deg);
}
.compact-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.compact-body.collapsed {
  grid-template-rows: 0fr;
}
.compact-content {
  overflow: hidden;
  min-height: 0;
}
.compact-content-inner {
  padding: 12px 14px;
  background: var(--glass-bg);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
}
.compact-rule {
  flex: 1;
  height: 1px;
  margin-top: 19px;
  background: var(--glass-border);
  min-width: 16px;
  pointer-events: none;
}
.compact-enter {
  animation: compact-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes compact-enter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 600px) {
  .compact-boundary {
    padding: 0 8px;
  }
  .compact-chips {
    display: none;
  }
  .compact-header {
    padding: 9px 12px;
  }
  .compact-content-inner {
    padding: 10px 12px;
  }
  .compact-stack::before {
    top: -4px;
    left: 5px;
    right: 5px;
  }
  .compact-stack::after {
    top: -8px;
    left: 10px;
    right: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .compact-enter {
    animation: none;
  }
  .compact-body,
  .compact-stack::before,
  .compact-stack::after,
  .compact-panel,
  .compact-chevron {
    transition: none;
  }
}
</style>
