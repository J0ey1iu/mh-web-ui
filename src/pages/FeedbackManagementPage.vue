<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue"
import type { ManageFeedbackItem, MessageItem } from "../types"
import { fetchManageFeedback, fetchFeedbackSession, deleteManageFeedback, deleteManageFeedbackBatch, updateFeedbackStatus, getFeedbackExportUrl } from "../api/client"
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
const statusFilter = ref("")
const selected = ref<Set<string>>(new Set())
const showReplay = ref(false)
const replayFeedback = ref<ManageFeedbackItem | null>(null)
const replayMessages = ref<MessageItem[]>([])
const replayHighlightMsgId = ref("")
const replayContainer = ref<HTMLElement | null>(null)

const statusLabels: Record<string, string> = {
  new: "待处理",
  analyzing: "分析中",
  optimized: "已优化",
  deployed: "已上线",
}

const statusColors: Record<string, string> = {
  new: "badge-neutral",
  analyzing: "badge-warning",
  optimized: "badge-success",
  deployed: "badge-accent",
}

async function load() {
  loading.value = true
  try {
    const resp = await fetchManageFeedback({
      page: page.value,
      page_size: pageSize.value,
      q: q.value || undefined,
      feedback_type: feedbackTypeFilter.value || undefined,
      source: sourceFilter.value || undefined,
      status: statusFilter.value || undefined,
    })
    items.value = resp.items
    total.value = resp.total
    selected.value = new Set()
  } catch { /* */ } finally {
    loading.value = false
  }
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

function onSearch() {
  page.value = 1
  load()
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function goPrev() {
  if (page.value > 1) { page.value--; load() }
}

function goNext() {
  if (page.value < totalPages.value) { page.value++; load() }
}

function toggleAll() {
  if (selected.value.size === items.value.length) {
    selected.value = new Set()
  } else {
    selected.value = new Set(items.value.map(i => i.feedback_id))
  }
}

function toggleOne(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

async function doDelete(feedbackId: string) {
  try {
    await deleteManageFeedback(feedbackId)
    load()
  } catch { /* */ }
}

async function doBatchDelete() {
  const ids = Array.from(selected.value)
  if (!ids.length) return
  try {
    await deleteManageFeedbackBatch(ids)
    load()
  } catch { /* */ }
}

async function doStatusChange(feedbackId: string) {
  const fb = items.value.find(i => i.feedback_id === feedbackId)
  if (!fb) return
  const next = fb.status === "new" ? "analyzing" : fb.status === "analyzing" ? "optimized" : fb.status === "optimized" ? "deployed" : "new"
  try {
    await updateFeedbackStatus(feedbackId, next)
    load()
  } catch { /* */ }
}

function doExport() {
  window.open(
    getFeedbackExportUrl({
      q: q.value || undefined,
      feedback_type: feedbackTypeFilter.value || undefined,
      source: sourceFilter.value || undefined,
      status: statusFilter.value || undefined,
    }),
    "_blank"
  )
}

const hasSelected = computed(() => selected.value.size > 0)

onMounted(load)
</script>

<template>
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content">
      <header class="mgmt-header">
        <h1>{{ t("feedback_management") }}</h1>
      </header>

      <div class="mgmt-toolbar">
        <input v-model="q" class="mgmt-search" :placeholder="t('mgmt_search_placeholder')" @keyup.enter="onSearch" />
        <button class="btn-search" @click="onSearch">{{ t("mgmt_search") }}</button>
        <select v-model="feedbackTypeFilter" class="mgmt-search" style="max-width:180px" @change="onSearch">
          <option value="">{{ t("feedback_type_all") }}</option>
          <option value="thumbs_up">👍 {{ t("feedback_thumbs_up") }}</option>
          <option value="thumbs_down">👎 {{ t("feedback_thumbs_down") }}</option>
        </select>
        <select v-model="sourceFilter" class="mgmt-search" style="max-width:180px" @change="onSearch">
          <option value="">{{ t("feedback_source_all") }}</option>
          <option value="ui_button">{{ t("feedback_source_ui") }}</option>
          <option value="agent_tool">{{ t("feedback_source_tool") }}</option>
        </select>
        <select v-model="statusFilter" class="mgmt-search" style="max-width:160px" @change="onSearch">
          <option value="">{{ t("feedback_status_all") }}</option>
          <option value="new">待处理</option>
          <option value="analyzing">分析中</option>
          <option value="optimized">已优化</option>
          <option value="deployed">已上线</option>
        </select>
        <button class="btn-action" @click="doExport">📤 导出 CSV</button>
        <button class="btn-action btn-danger" :disabled="!hasSelected" @click="doBatchDelete">🗑 批量删除</button>
      </div>

      <div v-if="loading" class="mgmt-loading">{{ t("mgmt_loading") }}</div>

      <div v-else-if="items.length === 0" class="mgmt-empty">{{ t("mgmt_no_results") }}</div>

      <div v-else class="table-wrap">
        <table class="mgmt-table">
          <thead>
            <tr>
              <th class="cell-check"><input type="checkbox" :checked="selected.size === items.length && items.length > 0" @change="toggleAll" /></th>
              <th>{{ t("feedback_type_col") }}</th>
              <th>{{ t("feedback_source") }}</th>
              <th>{{ t("mgmt_name") }}</th>
              <th>{{ t("feedback_status") }}</th>
              <th>{{ t("feedback_rating") }}</th>
              <th>{{ t("feedback_comment") }}</th>
              <th>{{ t("mgmt_created_at") }}</th>
              <th>{{ t("mgmt_actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fb in items" :key="fb.feedback_id" :class="{ 'row-selected': selected.has(fb.feedback_id) }">
              <td class="cell-check"><input type="checkbox" :checked="selected.has(fb.feedback_id)" @change="toggleOne(fb.feedback_id)" /></td>
              <td>
                <span class="fb-type-tag" :class="fb.feedback_type">
                  {{ fb.feedback_type === 'thumbs_up' ? '👍' : '👎' }}
                  {{ feedbackTypeLabel(fb.feedback_type) }}
                </span>
              </td>
              <td>
                <span class="badge" :class="fb.source === 'agent_tool' ? 'badge-accent' : 'badge-neutral'">{{ sourceLabel(fb.source) }}</span>
              </td>
              <td><code>{{ fb.user_id }}</code></td>
              <td>
                <span class="badge" :class="statusColors[fb.status] || 'badge-neutral'" style="cursor:pointer" :title="t('feedback_status_change')" @click="doStatusChange(fb.feedback_id)">
                  {{ statusLabels[fb.status] || fb.status }}
                </span>
              </td>
              <td>{{ ratingStars(fb.rating) }}</td>
              <td class="cell-desc">{{ truncate(fb.comment ?? "", 60) }}</td>
              <td class="cell-audit">{{ formatTime(fb.created_at) }}</td>
              <td class="cell-actions">
                <button class="btn-action" @click="openReplay(fb)">{{ t("feedback_view_session") }}</button>
                <button class="btn-action btn-danger" @click="doDelete(fb.feedback_id)">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mgmt-pagination" v-if="totalPages > 1">
        <button class="btn-page" :disabled="page <= 1" @click="goPrev">{{ t("mgmt_prev_page") }}</button>
        <span class="mgmt-page-info">{{ page }} / {{ totalPages }}</span>
        <button class="btn-page" :disabled="page >= totalPages" @click="goNext">{{ t("mgmt_next_page") }}</button>
      </div>
    </div>

    <!-- Session replay dialog -->
    <div v-if="showReplay" class="dialog-overlay" @mousedown.self="closeReplay">
      <div class="dialog dialog-lg">
        <div class="fb-replay-header">
          <div class="fb-replay-header-left">
            <span class="fb-replay-badge" :class="replayFeedback?.feedback_type">
              {{ replayFeedback?.feedback_type === 'thumbs_up' ? '👍' : '👎' }}
            </span>
            <h3>{{ t("feedback_replay_title") }}</h3>
          </div>
          <button class="btn-close" @click="closeReplay">✕</button>
        </div>

        <div class="fb-replay-info" v-if="replayFeedback">
          <span class="badge" :class="replayFeedback.feedback_type === 'thumbs_up' ? 'badge-success' : 'badge-error'">
            {{ replayFeedback.feedback_type === 'thumbs_up' ? '👍' : '👎' }} {{ feedbackTypeLabel(replayFeedback.feedback_type) }}
          </span>
          <span class="badge badge-accent" v-if="replayFeedback.rating">{{ ratingStars(replayFeedback.rating) }}</span>
          <span class="badge badge-neutral">{{ sourceLabel(replayFeedback.source) }}</span>
          <span class="badge" :class="statusColors[replayFeedback.status] || 'badge-neutral'">{{ statusLabels[replayFeedback.status] || replayFeedback.status }}</span>
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
          <div v-if="replayMessages.length === 0" class="mgmt-loading">{{ t("mgmt_loading") }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cell-check { width: 36px; text-align: center; }
.cell-check input { cursor: pointer; }

.row-selected { background: color-mix(in srgb, var(--accent) 8%, transparent); }

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

.fb-replay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.fb-replay-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fb-replay-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
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

.fb-replay-info {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px 0;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--glass-border);
}

.fb-info-comment {
  color: var(--text-secondary);
  font-size: 12px;
  font-style: italic;
}

.fb-replay-msgs {
  max-height: 55vh;
  overflow-y: auto;
}

.msg-row {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--glass-border);
  font-size: 13px;
  line-height: 1.5;
  transition: background 0.15s;
}

.msg-row:hover {
  background: var(--glass-highlight);
  margin: 0 -4px;
  padding: 10px 4px;
  border-radius: 6px;
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

.hl-row {
  background: color-mix(in srgb, var(--accent-dim) 35%, transparent) !important;
  border-top: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
  position: relative;
  margin: 0 -4px;
  padding: 10px 4px;
  border-radius: 6px;
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
  margin: 0 -4px;
  padding: 10px 4px;
  border-radius: 6px;
}

.compact-badge {
  font-size: 11px;
  color: var(--info);
  white-space: nowrap;
  flex-shrink: 0;
  font-weight: 500;
}

</style>
