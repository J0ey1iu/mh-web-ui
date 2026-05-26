<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue"
import type { Message, StreamingState } from "../types"
import MessageBubble from "./MessageBubble.vue"
import { useI18nStore } from "../stores/i18n"

const props = defineProps<{
  messages: Message[]
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

watch(
  [
    () => props.messages.length,
    () => props.streaming.content,
    () => props.streaming.isStreaming,
  ],
  async () => {
    await nextTick()
    if (listRef.value) {
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
    <div ref="listRef" class="message-list">
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
      <div
        v-if="messages.length === 0 && !streaming.isStreaming"
        class="empty-state"
      >
        <p class="empty-text">{{ t("start_conversation") }}</p>
      </div>
    </div>
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
  background: var(--page-bg);
  min-width: 0;
  min-height: 0;
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
  border-top: 1px solid var(--border);
  background: var(--surface-bg);
}
.input-bar input,
.input-bar textarea {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--page-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}
.input-bar input:focus,
.input-bar textarea:focus {
  border-color: var(--accent);
}
.input-bar input::placeholder,
.input-bar textarea::placeholder {
  color: var(--text-muted);
}
.input-bar textarea {
  field-sizing: content;
  max-height: calc(1.5em * 4 + 20px);
  resize: none;
  overflow-y: auto;
  line-height: 1.5;
  font-family: inherit;
}
.input-bar button {
  padding: 10px 16px;
  background: var(--accent-dim);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}
.input-bar button:hover:not(:disabled) {
  background: var(--accent);
  color: var(--text-strong);
}
.input-bar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-new-chat {
  min-width: 36px;
  padding: 10px 0 !important;
  text-align: center;
  font-size: 18px !important;
  line-height: 1;
  background: var(--border) !important;
  border-color: var(--border-hover) !important;
}
.btn-new-chat:hover {
  background: var(--border-hover) !important;
}
.btn-cancel {
  background: var(--danger) !important;
  border-color: var(--danger-hover) !important;
}
.btn-cancel:hover {
  background: var(--danger-hover) !important;
}
</style>
