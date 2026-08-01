<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted } from "vue"
import gsap from "gsap"
import type { Message, StreamingState, SlashCommand, ControllerInfo } from "../types"
import MessageBubble from "./MessageBubble.vue"
import SkeletonBlock from "./SkeletonBlock.vue"
import SlashCommandPanel from "./SlashCommandPanel.vue"
import { useI18nStore } from "../stores/i18n"
import { useChatStore } from "../stores/chat"
import { getLocale } from "../api/client"
import { filterSlashCommands } from "../slashCommandRegistry"

const props = defineProps<{
  messages: Message[]
  messagesLoading: boolean
  streaming: StreamingState
  disabled: boolean
  contextUsage: { totalTokens: number; maxContext: number }
}>()

const hasMaxCtx = computed(() => props.contextUsage.maxContext > 0)

const pct = computed(() => {
  const { totalTokens, maxContext } = props.contextUsage
  if (maxContext <= 0) return 0
  return Math.min(1, totalTokens / maxContext)
})

const barFill = computed(() => `${Math.round(pct.value * 100)}%`)

const barColor = computed(() => {
  const v = pct.value
  if (v < 0.4) return "var(--accent)"
  if (v < 0.7) return "#eab308"
  return "#ef4444"
})

const contextLabel = computed(() => {
  const { totalTokens, maxContext } = props.contextUsage
  if (hasMaxCtx.value) {
    return `${totalTokens.toLocaleString()} / ${maxContext.toLocaleString()} (${Math.round(pct.value * 100)}%)`
  }
  return `${totalTokens.toLocaleString()} tokens`
})

const emit = defineEmits<{
  send: [text: string]
  cancel: []
  newChat: []
  slashCommand: [command: SlashCommand]
}>()

const { t } = useI18nStore()
const input = ref("")
const listRef = ref<HTMLDivElement | null>(null)
const isAtBottom = ref(true)

const showSlashPanel = ref(false)
const slashFilter = ref("")
const selectedIndex = ref(0)
const filteredCommands = computed(() => filterSlashCommands(slashFilter.value))

// Controller 选择：加载目录，切换时写回 chat store（随消息发送）
const chatStore = useChatStore()
const controllerCatalog = ref<ControllerInfo[]>([])
const controllerType = ref(chatStore.controllerType || "default")
const controllerConfig = ref<Record<string, unknown>>({ ...chatStore.controllerConfig })
const timerDuration = ref<string>(
  String(controllerConfig.value.duration ?? "30m"),
)

const selectedController = computed<ControllerInfo | undefined>(
  () => controllerCatalog.value.find((c) => c.value === controllerType.value),
)

function applyController() {
  const cfg: Record<string, unknown> = {}
  const entry = selectedController.value
  if (entry?.settings) {
    for (const s of entry.settings) {
      if (s.key === "duration" && controllerType.value === "timer") {
        cfg[s.key] = timerDuration.value.trim() || String(s.default)
      } else {
        cfg[s.key] = s.default
      }
    }
  }
  controllerConfig.value = cfg
  chatStore.setController(controllerType.value, cfg)
}

function onControllerChange() {
  const entry = selectedController.value
  if (entry?.settings?.some((s) => s.key === "duration")) {
    timerDuration.value = String(entry.settings.find((s) => s.key === "duration")!.default)
  }
  applyController()
}

function onDurationInput() {
  if (controllerType.value === "timer") applyController()
}

// ── 模式选择：悬浮展开 + GSAP 动画 ─────────────────────────
const MODE_ICONS: Record<string, string> = {
  // 普通/标准模式：闪电
  default: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  // 目标模式：靶子
  goal: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  // 计时模式：计时器
  timer: '<line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/>',
}

function modeIcon(value: string): string {
  return MODE_ICONS[value] ?? MODE_ICONS.default
}

const modeOpen = ref(false)
const modePopupRef = ref<HTMLElement | null>(null)

function onModeEnter() {
  if (props.streaming.isStreaming || props.disabled || controllerCatalog.value.length === 0) return
  modeOpen.value = true
  nextTick(() => {
    if (modePopupRef.value) {
      gsap.fromTo(
        modePopupRef.value,
        { opacity: 0, y: 8, xPercent: -50 },
        { opacity: 1, y: 0, xPercent: -50, duration: 0.18, ease: "power2.out" },
      )
    }
  })
}

function onModeLeave() {
  modeOpen.value = false
}

function selectMode(value: string) {
  controllerType.value = value
  onControllerChange()
  modeOpen.value = false
}

function onOptionEnter(e: MouseEvent) {
  const label = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".mode-label")
  if (label) {
    gsap.to(label, { opacity: 1, x: 0, yPercent: -50, duration: 0.2, ease: "power2.out" })
  }
}

function onOptionLeave(e: MouseEvent) {
  const label = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".mode-label")
  if (label) {
    gsap.to(label, { opacity: 0, x: -6, yPercent: -50, duration: 0.15, ease: "power2.out" })
  }
}

onMounted(async () => {
  await chatStore.loadControllers()
  controllerCatalog.value = chatStore.controllerCatalog
  applyController()
})

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

function closeSlashPanel() {
  showSlashPanel.value = false
  slashFilter.value = ""
  selectedIndex.value = 0
}

function executeSlashCommand(cmd: SlashCommand) {
  closeSlashPanel()
  input.value = ""
  emit("slashCommand", cmd)
}

function onButtonClick() {
  if (props.streaming.isStreaming) {
    emit("cancel")
    return
  }
  if (showSlashPanel.value && filteredCommands.value.length > 0) {
    executeSlashCommand(filteredCommands.value[selectedIndex.value])
    return
  }
  const text = input.value.trim()
  if (!text || props.disabled) return
  input.value = ""
  emit("send", text)
}

function onKeydown(e: KeyboardEvent) {
  if (showSlashPanel.value) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % filteredCommands.value.length
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length
      return
    }
    if (e.key === "Escape") {
      e.preventDefault()
      closeSlashPanel()
      return
    }
  }
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    onButtonClick()
  }
}

watch(input, (val) => {
  if (val.startsWith("/") && val.length > 1) {
    showSlashPanel.value = true
    slashFilter.value = val.slice(1)
    selectedIndex.value = 0
  } else if (val === "/") {
    showSlashPanel.value = true
    slashFilter.value = ""
    selectedIndex.value = 0
  } else {
    closeSlashPanel()
  }
})
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
    <div class="input-area">
      <SlashCommandPanel
        :visible="showSlashPanel"
        :commands="filteredCommands"
        :selected-index="selectedIndex"
        @select="executeSlashCommand"
        @close="closeSlashPanel"
      />
      <div class="capsule-bar">
        <button
          class="capsule capsule-new-chat"
          @click="emit('newChat')"
          :title="t('new_chat')"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <div
          v-if="controllerCatalog.length > 0"
          class="capsule capsule-mode-switcher"
          @mouseenter="onModeEnter"
          @mouseleave="onModeLeave"
        >
          <button
            class="mode-btn"
            :title="selectedController?.description"
            :disabled="streaming.isStreaming || disabled"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              v-html="modeIcon(controllerType)"
            ></svg>
          </button>
          <div
            v-if="modeOpen"
            ref="modePopupRef"
            class="mode-pop"
          >
            <button
              v-for="c in controllerCatalog"
              :key="c.value"
              class="mode-option"
              :class="{ active: c.value === controllerType }"
              @mouseenter="onOptionEnter"
              @mouseleave="onOptionLeave"
              @click="selectMode(c.value)"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                v-html="modeIcon(c.value)"
              ></svg>
              <span class="mode-label">{{ (getLocale() === "zh" ? c.display_name_zh || c.display_name : c.display_name) }}</span>
            </button>
          </div>
        </div>
        <div
          v-if="controllerType === 'timer' && selectedController?.settings?.some(s => s.key === 'duration')"
          class="capsule capsule-duration"
        >
          <input
            class="controller-duration"
            v-model="timerDuration"
            :placeholder="selectedController.settings.find(s => s.key === 'duration')!.placeholder"
            :disabled="streaming.isStreaming || disabled"
            :title="t('controller_timer_duration')"
            @input="onDurationInput"
          />
        </div>
        <div class="capsule capsule-input">
          <textarea
            v-model="input"
            :placeholder="t('type_message')"
            :disabled="disabled"
            rows="1"
            @keydown="onKeydown"
          ></textarea>
        </div>
        <button
          :class="['capsule', 'capsule-send', { 'btn-cancel': streaming.isStreaming }]"
          :disabled="!streaming.isStreaming && (disabled || !input.trim())"
          @click="onButtonClick"
        >
          {{ streaming.isStreaming ? t("stop") : t("send") }}
        </button>
      </div>
      <div class="context-bar">
        <div class="context-bar-fill" :style="{ width: barFill, background: barColor }"></div>
        <div class="context-bar-text"><span>{{ contextLabel }}</span></div>
      </div>
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
  padding-bottom: 130px; /* room for the floating capsule bar */
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
.input-area {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  width: min(760px, calc(100% - 24px));
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.capsule-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.capsule {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid var(--border);
  /* 实心背景：避免历史消息从半透明玻璃底下透上来 */
  background: var(--surface-bg);
  color: var(--text-primary);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
}
.capsule-new-chat {
  width: 42px;
  height: 42px;
  cursor: pointer;
  font-size: 18px;
}
.capsule-new-chat:hover {
  background: var(--accent-dim);
  border-color: var(--accent);
  box-shadow: 0 2px 16px var(--accent-dim);
}
.capsule-mode-switcher {
  position: relative;
  width: 42px;
  height: 42px;
  padding: 0;
}
.mode-btn {
  width: 100%;
  height: 100%;
  border: none;
  background: none;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  transition: color var(--transition-duration);
}
.mode-btn:hover:not(:disabled) {
  color: var(--accent);
}
.mode-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.mode-pop {
  position: absolute;
  left: 50%;
  bottom: 100%;
  /* padding-bottom 是悬停桥：弹层盒子从按钮顶边开始，鼠标向上移动不会触发 mouseleave */
  padding-bottom: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 30;
}
.mode-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-bg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--transition-duration);
}
.mode-option:hover,
.mode-option.active {
  border-color: var(--accent);
}
.mode-label {
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-bg);
  border: 1px solid var(--border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  color: var(--text-primary);
  font-size: 13px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
}
.capsule-duration {
  height: 42px;
  padding: 0 16px;
}
.controller-duration {
  border: none;
  background: none;
  outline: none;
  width: 72px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}
.controller-duration:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.capsule-input {
  flex: 1;
  min-width: 0;
  min-height: 42px;
  padding: 0 20px;
  /* 单行高度42px时 2×24≥42 两端合成半圆；多行变高后自动退化为圆角长方形 */
  border-radius: 24px;
  overflow: hidden;
}
.capsule-input textarea {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  font-family: inherit;
  resize: none;
  overflow-y: auto;
  field-sizing: content;
  max-height: calc(1.5em * 4 + 20px);
  padding: 10px 0;
}
.capsule-input textarea::placeholder {
  color: var(--text-muted);
}
.capsule-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.capsule-send {
  height: 42px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
.capsule-send:hover:not(:disabled) {
  border-color: var(--accent);
  box-shadow: 0 2px 16px var(--accent-dim);
}
.capsule-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-cancel {
  background: var(--danger) !important;
  border-color: var(--danger-hover) !important;
}
.btn-cancel:hover {
  background: var(--danger-hover) !important;
}
.context-bar {
  position: relative;
  margin-top: 8px;
  width: 100%;
  height: 22px;
  border-radius: 999px;
  background: var(--surface-bg);
  border: 1px solid var(--border);
  overflow: hidden;
}
.context-bar-fill {
  position: absolute;
  inset: 0;
  height: 100%;
  transition: width 0.4s ease, background 0.4s ease, border-radius 0.2s ease;
}
.context-bar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.context-bar-text span {
  background: var(--page-bg);
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  color: var(--text-primary);
}
.scroll-to-bottom {
  position: absolute;
  bottom: 140px;
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
