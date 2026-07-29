<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue"
import type { ManageFeedbackItem, MessageItem } from "../types"
import { fetchManageFeedback, fetchFeedbackSession } from "../api/client"
import { useI18nStore } from "../stores/i18n"
import ManagementNav from "../components/ManagementNav.vue"

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
const replayHighlightMsgId = ref("")
const replayContainer = ref<HTMLElement | null>(null)

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
  replayHighlightMsgId.value = ""
  try {
    const resp = await fetchFeedbackSession(fb.feedback_id)
    replayMessages.value = resp.messages
    replayHighlightMsgId.value = resp.highlight_message_id ?? ""
    await nextTick()
    setTimeout(() => {
      const el = replayContainer.value?.querySelector(".hl-row")
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 100)
  } catch {
    replayMessages.value = []
  }
  showReplay.value = true
}

function closeReplay() {
  showReplay.value = false
  replayFeedback.value = null
  replayMessages.value = []
  replayHighlightMsgId.value = ""
}

function feedbackTypeLabel(fbType: string): string {
  return fbType === "thumbs_up" ? "表扬" : "批评"
}

function sourceLabel(source: string): string {
  return source === "agent_tool" ? t("feedback_source_tool") : t("feedback_source_ui")
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

function isHighlight(msg: MessageItem): boolean {
  return msg.id === replayHighlightMsgId.value
}

function truncate(s: string, n: number): string {
  if (!s) return ""
  return s.length > n ? s.slice(0, n) + "…" : s
}

function msgLabel(role: string): string {
  if (role === "user") return "用户"
  if (role === "assistant") return "助手"
  if (role === "reasoning") return "推理"
  if (role === "tool") return "工具"
  return role
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
  <ManagementNav />
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
          <th>{{ t("feedback_type_col") }}</th>
          <th>{{ t("feedback_source") }}</th>
          <th>{{ t("mgmt_name") }}</th>
          <th>{{ t("feedback_rating") }}</th>
          <th>{{ t("feedback_comment") }}</th>
          <th>{{ t("mgmt_created_at") }}</th>
          <th>{{ t("mgmt_actions") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="fb in items" :key="fb.feedback_id">
          <td>
            <span class="fb-type-tag" :class="fb.feedback_type">
              {{ fb.feedback_type === 'thumbs_up' ? '👍' : '👎' }}
              {{ feedbackTypeLabel(fb.feedback_type) }}
            </span>
          </td>
          <td>
            <span class="fb-source-tag" :class="fb.source">{{ sourceLabel(fb.source) }}</span>
          </td>
          <td>{{ fb.user_id }}</td>
          <td>{{ ratingStars(fb.rating) }}</td>
          <td class="fb-comment-cell">{{ truncate(fb.comment ?? "", 60) }}</td>
          <td>{{ formatTime(fb.created_at) }}</td>
          <td>
            <button class="fb-view-btn" @click="openReplay(fb)">{{ t("feedback_view_session") }}</button>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="7" class="fb-empty">{{ t("mgmt_no_results") }}</td>
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
          <div class="fb-replay-header-left">
            <span class="fb-replay-badge" :class="replayFeedback?.feedback_type">
              {{ replayFeedback?.feedback_type === 'thumbs_up' ? '👍' : '👎' }}
            </span>
            <h3>{{ t("feedback_replay_title") }}</h3>
          </div>
          <button class="fb-close-btn" @click="closeReplay">✕</button>
        </div>

        <div class="fb-replay-info" v-if="replayFeedback">
          <span class="fb-info-tag">{{ replayFeedback.feedback_type === 'thumbs_up' ? '👍' : '👎' }} {{ feedbackTypeLabel(replayFeedback.feedback_type) }}</span>
          <span class="fb-info-tag" v-if="replayFeedback.rating">{{ ratingStars(replayFeedback.rating) }}</span>
          <span class="fb-info-tag src">{{ sourceLabel(replayFeedback.source) }}</span>
          <span class="fb-info-comment" v-if="replayFeedback.comment">"{{ replayFeedback.comment }}"</span>
        </div>

        <div class="fb-replay-msgs" ref="replayContainer">
          <div
            v-for="(msg, idx) in replayMessages"
            :key="msg.id || idx"
            class="msg-row"
            :class="{ 'hl-row': isHighlight(msg), 'compact-row': msg.compact_boundary }"
          >
            <div class="msg-role">
            <template v-if="msg.compact_boundary">📋 摘要</template>
            <template v-else>{{ msgLabel(msg.role) }}</template>
          </div>
            <div class="msg-body">
              <div class="msg-text" v-if="msg.content && msg.role !== 'tool'">{{ msg.content }}</div>
              <pre class="msg-json" v-if="msg.role === 'tool'">{{ truncate(msg.content || '{}', 500) }}</pre>
              <div class="msg-tc" v-if="msg.tool_calls?.length">
                <div v-for="tc in msg.tool_calls" :key="tc.id" class="tc-mini">
                  <span class="tc-name">{{ tc.function?.name || "?" }}</span>
                  <pre class="tc-args">{{ truncate(tc.function?.arguments || "{}", 200) }}</pre>
                </div>
              </div>
            </div>
            <div class="hl-indicator" v-if="isHighlight(msg)">← 被评价</div>
            <div class="compact-badge" v-if="msg.compact_boundary">📋 以上内容已被总结压缩</div>
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

.fb-type-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.fb-type-tag.thumbs_up {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
  border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
}

.fb-type-tag.thumbs_down {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}

.fb-source-tag {
  display: inline-flex;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.fb-source-tag.ui_button {
  background: var(--glass-highlight);
  color: var(--accent);
  border: 1px solid var(--glass-border);
}

.fb-source-tag.agent_tool {
  background: color-mix(in srgb, var(--info) 12%, transparent);
  color: var(--info);
  border: 1px solid color-mix(in srgb, var(--info) 25%, transparent);
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
  transition: all 0.2s;
}

.fb-view-btn:hover {
  background: var(--accent);
  color: #fff;
}

/* ── Replay dialog ── */

.fb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.fb-replay-dialog {
  width: 92%;
  max-width: 760px;
  max-height: 85vh;
  background: var(--surface-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.fb-replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--surface-alt);
  flex-shrink: 0;
}

.fb-replay-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fb-replay-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 15px;
}

.fb-replay-badge.thumbs_up {
  background: color-mix(in srgb, var(--success) 18%, transparent);
}

.fb-replay-badge.thumbs_down {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
}

.fb-replay-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.fb-close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 8px;
  transition: all 0.2s;
  line-height: 1;
}

.fb-close-btn:hover {
  background: var(--glass-highlight);
  color: var(--text-primary);
}

/* feedback info bar */
.fb-replay-info {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 20px;
  background: var(--glass-highlight);
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.fb-info-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: color-mix(in srgb, var(--accent-dim) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
}

.fb-info-tag.src {
  background: var(--glass-highlight);
  border-color: var(--glass-border);
  color: var(--text-secondary);
}

.fb-info-comment {
  color: var(--text-secondary);
  font-size: 12px;
  font-style: italic;
}

/* message list */
.fb-replay-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.msg-row {
  display: flex;
  gap: 10px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--glass-border);
  font-size: 13px;
  line-height: 1.5;
  transition: background 0.15s;
}

.msg-row:hover {
  background: var(--glass-highlight);
}

.msg-role {
  min-width: 40px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
  padding-top: 1px;
  font-size: 12px;
}

.msg-body {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
}

.msg-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-json {
  margin: 0;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: var(--glass-highlight);
  padding: 6px 8px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* tool calls */
.msg-tc {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.tc-mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--warning) 10%, var(--glass-highlight));
  border: 1px solid color-mix(in srgb, var(--warning) 20%, var(--glass-border));
  font-size: 11px;
}

.tc-name {
  font-weight: 600;
  color: var(--warning);
}

.tc-args {
  margin: 0;
  color: var(--text-tertiary);
  font-family: ui-monospace, monospace;
  font-size: 10px;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

/* highlight row */
.hl-row {
  background: color-mix(in srgb, var(--accent-dim) 35%, transparent) !important;
  border-top: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
  position: relative;
}

.hl-row .msg-role {
  color: var(--accent);
}

.hl-indicator {
  align-self: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
}

.compact-row {
  background: color-mix(in srgb, var(--info) 8%, var(--glass-highlight));
  border-top: 2px dashed var(--info);
  border-bottom: 2px dashed var(--info);
}

.compact-badge {
  font-size: 11px;
  color: var(--info);
  white-space: nowrap;
  flex-shrink: 0;
  font-weight: 500;
}
</style>
