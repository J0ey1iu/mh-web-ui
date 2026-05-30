<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue"
import type { Message, StreamingState } from "../types"
import MessageBubble from "./MessageBubble.vue"
import SkeletonBlock from "./SkeletonBlock.vue"
import { useI18nStore } from "../stores/i18n"

const props = defineProps<{
  messages: Message[]
  messagesLoading: boolean
  streaming: StreamingState
  disabled: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
  cancel: []
  newChat: []
}>()

const { t } = useI18nStore()
const input = ref("")
const listRef = ref<HTMLDivElement | null>(null)
const isAtBottom = ref(true)

const showScrollBtn = computed(
  () => !isAtBottom.value && props.streaming.isStreaming
)

const streamingMessage = computed<Message | null>(() => {
  if (!props.streaming.isStreaming) return null
  return {
    id: "streaming",
    role: "assistant",
    content: props.streaming.content,
    orderedItems: props.streaming.orderedItems,
    tool_calls:
      props.streaming.toolCalls.length > 0
        ? props.streaming.toolCalls
        : undefined,
  }
})

function onScroll() {
  if (!listRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = listRef.value
  isAtBottom.value = scrollTop + clientHeight >= scrollHeight - 20
}

function scrollToBottom() {
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight
    isAtBottom.value = true
  }
}

watch(
  [
    () => props.messages.length,
    () => props.streaming.content,
    () => props.streaming.isStreaming,
  ],
  async () => {
    await nextTick()
    if (listRef.value && isAtBottom.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  },
  { deep: true },
)

function onButtonClick() {
  if (props.streaming.isStreaming) {
    emit("cancel")
    return
  }
  const text = input.value.trim()
  if (!text || props.disabled) return
  input.value = ""
  emit("send", text)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    onButtonClick()
  }
}
</script>

<template>
  <div class="chat-view">
    <div ref="listRef" class="message-list" @scroll="onScroll">
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
      <MessageBubble
        v-if="streamingMessage"
        :message="streamingMessage"
        is-streaming
      />
      <template v-if="messagesLoading">
        <div class="skeleton-msg-group">
          <div class="skeleton-msg skeleton-msg-user">
            <SkeletonBlock width="140px" height="40px" borderRadius="12px" />
          </div>
          <div class="skeleton-msg skeleton-msg-assistant">
            <SkeletonBlock width="220px" height="48px" borderRadius="12px" />
          </div>
        </div>
      </template>
      <div
        v-else-if="messages.length === 0 && !streaming.isStreaming"
        class="empty-state"
      >
        <p class="empty-text">{{ t("start_conversation") }}</p>
      </div>
    </div>
    <button
      v-if="showScrollBtn"
      class="scroll-to-bottom"
      @click="scrollToBottom"
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
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {{ t("scroll_to_bottom") }}
    </button>
    <div class="input-bar">
      <button
        class="btn-new-chat"
        @click="emit('newChat')"
        :title="t('new_chat')"
      >
        +
      </button>
      <textarea
        v-model="input"
        :placeholder="t('type_message')"
        :disabled="disabled"
        rows="1"
        @keydown="onKeydown"
      ></textarea>
      <button
        :class="{ 'btn-cancel': streaming.isStreaming }"
        :disabled="!streaming.isStreaming && (disabled || !input.trim())"
        @click="onButtonClick"
      >
        {{ streaming.isStreaming ? t("stop") : t("send") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
}
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-text {
  color: var(--text-muted);
  font-size: 14px;
}
.input-bar {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-top: 1px solid var(--glass-border);
}
.input-bar textarea {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--glass-highlight);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
  field-sizing: content;
  max-height: calc(1.5em * 4 + 20px);
  resize: none;
  overflow-y: auto;
  line-height: 1.5;
  font-family: inherit;
}
.input-bar textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.input-bar textarea::placeholder {
  color: var(--text-muted);
}
.input-bar button {
  padding: 10px 18px;
  background: var(--accent-dim);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  font-weight: 500;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: border-color var(--transition-duration), box-shadow var(--transition-duration), backdrop-filter var(--transition-duration), -webkit-backdrop-filter var(--transition-duration);
}
.input-bar button:hover:not(:disabled) {
  border-color: var(--accent);
  box-shadow: 0 2px 16px var(--accent-dim);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.input-bar button:active:not(:disabled) {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.input-bar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.btn-new-chat {
  min-width: 40px;
  padding: 10px 0 !important;
  text-align: center;
  font-size: 20px !important;
  line-height: 1;
  background: var(--glass-highlight) !important;
  border-color: var(--glass-border) !important;
}
.btn-new-chat:hover {
  background: var(--accent-dim) !important;
  border-color: var(--accent) !important;
}
.btn-cancel {
  background: var(--danger) !important;
  border-color: var(--danger-hover) !important;
}
.btn-cancel:hover {
  background: var(--danger-hover) !important;
}
.scroll-to-bottom {
  position: absolute;
  bottom: 76px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--glass-shadow);
  transition: color var(--transition-duration), border-color var(--transition-duration);
}
.scroll-to-bottom:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.skeleton-msg-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  padding: 24px;
}
.skeleton-msg {
  display: flex;
}
.skeleton-msg-user {
  justify-content: flex-end;
}
.skeleton-msg-assistant {
  justify-content: flex-start;
  flex-direction: column;
}
</style>
