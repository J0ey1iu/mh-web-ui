<script setup lang="ts">
import { ref, computed } from "vue"
import type { FeedbackStatus } from "../types"
import { useI18nStore } from "../stores/i18n"
import { submitFeedback } from "../api/client"

const { t } = useI18nStore()

const props = defineProps<{
  sessionId: string
  targetType: "message" | "tool_call"
  targetId: string
  existingFeedbackType?: "thumbs_up" | "thumbs_down"
  existingFeedbackId?: string
}>()

const status = ref<FeedbackStatus>(props.existingFeedbackType ? "submitted" : "none")
const selectedType = ref<"thumbs_up" | "thumbs_down" | null>(props.existingFeedbackType ?? null)
const showForm = ref(false)
const comment = ref("")
const submitting = ref(false)

const quickTags = computed(() => {
  if (selectedType.value === "thumbs_up") {
    return ["准确", "有用", "快速", "清晰", "完整"]
  }
  return ["不准确", "不清楚", "不完整", "太慢", "错误"]
})

function openForm(fbType: "thumbs_up" | "thumbs_down") {
  if (status.value === "submitted") return
  selectedType.value = fbType
  comment.value = ""
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  selectedType.value = null
}

function toggleTag(tag: string) {
  const tags = comment.value.split(/\s+/).filter(Boolean)
  const idx = tags.indexOf(tag)
  if (idx >= 0) {
    tags.splice(idx, 1)
  } else {
    tags.push(tag)
  }
  comment.value = tags.join(" ")
}

function hasTag(tag: string): boolean {
  return comment.value.split(/\s+/).includes(tag)
}

async function submit() {
  if (!selectedType.value) return
  submitting.value = true
  status.value = "submitting"
  try {
    await submitFeedback({
      session_id: props.sessionId,
      target_type: props.targetType,
      target_id: props.targetId,
      feedback_type: selectedType.value,
      comment: comment.value || undefined,
    })
    status.value = "submitted"
    showForm.value = false
  } catch {
    status.value = "none"
  } finally {
    submitting.value = false
  }
}

function reset() {
  closeForm()
  status.value = "none"
}
</script>

<template>
  <div class="feedback-widget">
    <!-- Submitted state -->
    <div v-if="status === 'submitted'" class="submitted-state">
      <span class="feedback-done">{{ t("feedback_submitted") }}</span>
      <button class="fb-undo" @click="reset" :title="t('mgmt_cancel')">✕</button>
    </div>

    <!-- Feedback buttons (always visible when not submitted) -->
    <div v-else class="fb-buttons">
      <button
        class="fb-btn"
        :class="{ active: selectedType === 'thumbs_up' && showForm }"
        :disabled="submitting"
        :title="t('feedback_thumbs_up')"
        @click="openForm('thumbs_up')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button
        class="fb-btn"
        :class="{ active: selectedType === 'thumbs_down' && showForm }"
        :disabled="submitting"
        :title="t('feedback_thumbs_down')"
        @click="openForm('thumbs_down')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>
        </svg>
      </button>
    </div>

    <!-- Feedback form overlay: teleported to body so hover-v-show parents and
         clickable foldable headers can't hide it or catch its clicks -->
    <Teleport to="body">
      <div v-if="showForm" class="fb-overlay" @click.self="closeForm">
      <div class="fb-form-dialog">
        <div class="fb-form-header">
          <span class="fb-form-type" :class="selectedType">
            {{ selectedType === 'thumbs_up' ? '😊' : '😕' }}
            {{ selectedType === 'thumbs_up' ? t('feedback_thumbs_up') : t('feedback_thumbs_down') }}
          </span>
          <button class="fb-close-btn" @click="closeForm">✕</button>
        </div>

        <div class="fb-form-body">
          <label class="fb-label">{{ t('feedback_comment') }}（{{ t('mgmt_optional') }}）</label>

          <div class="fb-tags">
            <button
              v-for="tag in quickTags"
              :key="tag"
              class="fb-tag"
              :class="{ active: hasTag(tag) }"
              @click="toggleTag(tag)"
            >{{ tag }}</button>
          </div>

          <textarea
            v-model="comment"
            class="fb-textarea"
            :placeholder="t('feedback_comment_placeholder')"
            rows="3"
          ></textarea>
        </div>

        <div class="fb-form-footer">
          <button class="fb-cancel-btn" @click="closeForm">{{ t('mgmt_cancel') }}</button>
          <button class="fb-submit-btn" :disabled="submitting" @click="submit">
            {{ submitting ? t('mgmt_saving') : t('mgmt_save') }}
          </button>
        </div>
      </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.feedback-widget {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-top: 8px;
}

.fb-buttons {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--glass-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--transition-duration);
  padding: 0;
  line-height: 0;
}

.fb-btn:hover:not(:disabled) {
  color: var(--accent);
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

.submitted-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.feedback-done {
  font-size: 11px;
  color: var(--success);
  font-weight: 500;
}

.fb-undo {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  line-height: 1;
}

.fb-undo:hover {
  color: var(--text-primary);
}

/* ── Overlay modal ── */

.fb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  backdrop-filter: blur(1px);
}

.fb-form-dialog {
  width: 360px;
  max-width: 90vw;
  background: var(--surface-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
}

.fb-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--surface-alt);
}

.fb-form-type {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.fb-close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
  transition: all 0.15s;
  line-height: 1;
}

.fb-close-btn:hover {
  background: var(--glass-highlight);
  color: var(--text-primary);
}

.fb-form-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fb-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.fb-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fb-tag {
  padding: 4px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: var(--glass-highlight);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.fb-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.fb-tag.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 500;
}

.fb-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--input-bg, var(--glass-highlight));
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 56px;
  box-sizing: border-box;
}

.fb-textarea::placeholder {
  color: var(--text-tertiary);
}

.fb-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.fb-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--glass-border);
  background: var(--surface-alt);
}

.fb-cancel-btn {
  padding: 6px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--glass-highlight);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.15s;
}

.fb-cancel-btn:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}

.fb-submit-btn {
  padding: 6px 18px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  transition: opacity 0.15s;
}

.fb-submit-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.fb-submit-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
