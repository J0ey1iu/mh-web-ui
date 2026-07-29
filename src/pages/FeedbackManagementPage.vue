<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import type { ManageFeedbackItem, MessageItem } from "../types"
import { fetchManageFeedback, fetchFeedbackSession } from "../api/client"
import { useI18nStore } from "../stores/i18n"

const { t } = useI18nStore()

const items = ref<ManageFeedbackItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const q = ref("")
const feedbackTypeFilter = ref("")
const sourceFilter = ref("")
const showReplay = ref(false)
const replayFeedback = ref<ManageFeedbackItem | null>(null)
const replayMessages = ref<MessageItem[]>([])
const replayHighlight = ref<{ type: string; id: string }>({ type: "", id: "" })

async function load() {
  loading.value = true
  try {
    const resp = await fetchManageFeedback({
      page: page.value,
      page_size: pageSize.value,
      q: q.value || undefined,
      feedback_type: feedbackTypeFilter.value || undefined,
      source: sourceFilter.value || undefined,
    })
    items.value = resp.items
    total.value = resp.total
  } catch { /* */ } finally {
    loading.value = false
  }
}

async function openReplay(fb: ManageFeedbackItem) {
  replayFeedback.value = fb
  replayMessages.value = []
  try {
    const resp = await fetchFeedbackSession(fb.feedback_id)
    replayMessages.value = resp.messages
    replayHighlight.value = { type: resp.highlight_target_type, id: resp.highlight_target_id }
  } catch {
    replayMessages.value = []
  }
  showReplay.value = true
}

function closeReplay() {
  showReplay.value = false
  replayFeedback.value = null
  replayMessages.value = []
}

function sourceLabel(source: string): string {
  return source === "agent_tool" ? `[${t("feedback_source_tool")}]` : `[${t("feedback_source_ui")}]`
}

function typeIcon(fbType: string): string {
  return fbType === "thumbs_up" ? "👍" : "👎"
}

function ratingStars(rating: number | null): string {
  if (rating == null) return "—"
  return "★".repeat(rating) + "☆".repeat(5 - rating)
}

function formatTime(ts: string): string {
  if (!ts) return ""
  const d = new Date(ts)
  return d.toLocaleString()
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function goPrev() {
  if (page.value > 1) { page.value--; load() }
}

function goNext() {
  if (page.value < totalPages.value) { page.value++; load() }
}

onMounted(load)
</script>

<template>
  <div class="fb-page">
    <div class="fb-header">
      <h2>{{ t("feedback_management") }}</h2>
    </div>

    <div class="fb-filters">
      <input v-model="q" class="fb-search" :placeholder="t('mgmt_search_placeholder')" @input="load" />
      <select v-model="feedbackTypeFilter" class="fb-select" @change="load">
        <option value="">{{ t("feedback_type_all") }}</option>
        <option value="thumbs_up">👍 {{ t("feedback_thumbs_up") }}</option>
        <option value="thumbs_down">👎 {{ t("feedback_thumbs_down") }}</option>
      </select>
      <select v-model="sourceFilter" class="fb-select" @change="load">
        <option value="">{{ t("feedback_source_all") }}</option>
        <option value="ui_button">{{ t("feedback_source_ui") }}</option>
        <option value="agent_tool">{{ t("feedback_source_tool") }}</option>
      </select>
    </div>

    <div v-if="loading" class="fb-loading">{{ t("mgmt_loading") }}</div>

    <table v-else class="fb-table">
      <thead>
        <tr>
          <th></th>
          <th>{{ t("feedback_source") }}</th>
          <th>{{ t("mgmt_name") }}</th>
          <th>{{ t("feedback_target") }}</th>
          <th>{{ t("feedback_rating") }}</th>
          <th>{{ t("feedback_comment") }}</th>
          <th>{{ t("mgmt_created_at") }}</th>
          <th>{{ t("mgmt_actions") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="fb in items" :key="fb.feedback_id">
          <td class="fb-type-cell">{{ typeIcon(fb.feedback_type) }}</td>
          <td>{{ sourceLabel(fb.source) }}</td>
          <td>{{ fb.user_id }}</td>
          <td><code>{{ fb.target_type }}:{{ fb.target_id?.slice(0, 12) }}</code></td>
          <td>{{ ratingStars(fb.rating) }}</td>
          <td class="fb-comment-cell">{{ fb.comment?.slice(0, 60) }}{{ (fb.comment?.length ?? 0) > 60 ? "…" : "" }}</td>
          <td>{{ formatTime(fb.created_at) }}</td>
          <td>
            <button class="fb-view-btn" @click="openReplay(fb)">{{ t("feedback_view_session") }}</button>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="8" class="fb-empty">{{ t("mgmt_no_results") }}</td>
        </tr>
      </tbody>
    </table>

    <div class="fb-pagination" v-if="totalPages > 1">
      <button :disabled="page <= 1" @click="goPrev">{{ t("mgmt_prev_page") }}</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="goNext">{{ t("mgmt_next_page") }}</button>
    </div>

    <!-- Session replay dialog -->
    <div v-if="showReplay" class="fb-overlay" @click.self="closeReplay">
      <div class="fb-replay-dialog">
        <div class="fb-replay-header">
          <h3>{{ t("feedback_replay_title") }}</h3>
          <button class="fb-close-btn" @click="closeReplay">✕</button>
        </div>
        <div class="fb-replay-info" v-if="replayFeedback">
          <span>{{ typeIcon(replayFeedback.feedback_type) }}</span>
          <span v-if="replayFeedback.rating">{{ ratingStars(replayFeedback.rating) }}</span>
          <span v-if="replayFeedback.comment">{{ replayFeedback.comment }}</span>
          <span>{{ sourceLabel(replayFeedback.source) }}</span>
        </div>
        <div class="fb-replay-messages">
          <div
            v-for="msg in replayMessages"
            :key="msg.id"
            class="fb-msg"
            :class="{ highlighted: msg.id === replayHighlight.id }"
          >
            <span class="fb-msg-role">{{ msg.role }}</span>
            <span class="fb-msg-content">{{ msg.content?.slice(0, 200) }}</span>
          </div>
          <div v-if="replayMessages.length === 0" class="fb-empty">{{ t("mgmt_loading") }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fb-page {
  max-width: 1160px;
  margin: 0 auto;
  padding: 24px 16px;
}

.fb-header h2 {
  margin: 0 0 16px;
  font-size: 20px;
  color: var(--text-primary);
}

.fb-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.fb-search {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--surface-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}

.fb-select {
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--surface-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}

.fb-loading {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.fb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.fb-table th {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.fb-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.fb-type-cell {
  font-size: 18px;
  text-align: center;
}

.fb-comment-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.fb-empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 24px;
}

.fb-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
  padding: 8px;
}

.fb-pagination button {
  padding: 6px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--surface-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}

.fb-pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}

.fb-view-btn {
  padding: 4px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--accent-dim);
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
}

.fb-view-btn:hover {
  background: var(--accent);
  color: #fff;
}

/* Replay dialog */
.fb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.fb-replay-dialog {
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  background: var(--surface-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.fb-replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--glass-border);
}

.fb-replay-header h3 {
  margin: 0;
  font-size: 16px;
}

.fb-close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.fb-close-btn:hover {
  background: var(--glass-highlight);
}

.fb-replay-info {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  background: var(--glass-highlight);
  border-bottom: 1px solid var(--glass-border);
  font-size: 13px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.fb-replay-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.fb-msg {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--glass-border);
}

.fb-msg.highlighted {
  background: var(--accent-dim);
  margin: 0 -8px;
  padding: 6px 8px;
  border-radius: 6px;
}

.fb-msg-role {
  font-weight: 600;
  min-width: 60px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.fb-msg-content {
  color: var(--text-primary);
  word-break: break-word;
}
</style>
