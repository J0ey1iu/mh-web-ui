<script setup lang="ts">
import { ref } from "vue"
import type { FeedbackStatus } from "../types"
import { useI18nStore } from "../stores/i18n"
import { submitFeedback } from "../api/client"

const { t } = useI18nStore()

const props = defineProps<{
  sessionId: string
  targetType: "message" | "tool_call"
  targetId: string
}>()

const status = ref<FeedbackStatus>("none")
const selectedType = ref<"thumbs_up" | "thumbs_down" | null>(null)

async function handleClick(fbType: "thumbs_up" | "thumbs_down") {
  if (status.value === "submitted") return
  selectedType.value = fbType
  status.value = "submitting"
  try {
    await submitFeedback({
      session_id: props.sessionId,
      target_type: props.targetType,
      target_id: props.targetId,
      feedback_type: fbType,
    })
    status.value = "submitted"
  } catch {
    status.value = "none"
    selectedType.value = null
  }
}
</script>

<template>
  <div class="feedback-widget">
    <template v-if="status === 'submitted'">
      <span class="feedback-done">{{ t("feedback_submitted") }}</span>
    </template>
    <template v-else>
      <button
        class="fb-btn"
        :class="{ active: selectedType === 'thumbs_up' }"
        :disabled="status === 'submitting'"
        :title="t('feedback_thumbs_up')"
        @click="handleClick('thumbs_up')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button
        class="fb-btn"
        :class="{ active: selectedType === 'thumbs_down' }"
        :disabled="status === 'submitting'"
        :title="t('feedback_thumbs_down')"
        @click="handleClick('thumbs_down')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.feedback-widget {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.fb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--glass-highlight);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-duration);
  padding: 0;
}

.fb-btn:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-dim);
}

.fb-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-dim);
}

.fb-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.feedback-done {
  font-size: 11px;
  color: var(--success);
  font-weight: 500;
}
</style>
