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
const replayHighlight = ref<{ type: string; id: string }>({ type: "", id: "" })
const replayContainer = ref<HTMLElement | null>(null)
const expandedTools = ref<Set<string>>(new Set())

function toggleTool(id: string) {
  if (expandedTools.value.has(id)) expandedTools.value.delete(id)
  else expandedTools.value.add(id)
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
  expandedTools.value = new Set()
  try {
    const resp = await fetchFeedbackSession(fb.feedback_id)
    replayMessages.value = resp.messages
    replayHighlight.value = { type: resp.highlight_target_type, id: resp.highlight_target_id }
    await nextTick()
    // scroll to highlighted message
    setTimeout(() => {
      const el = replayContainer.value?.querySelector(".msg-highlight")
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

function isHighlight(msg: MessageItem): boolean {
  return msg.id === replayHighlight.value.id
}

function roleLabel(role: string): string {
  if (role === "user") return "你"
  if (role === "assistant") return "AI"
  if (role === "reasoning") return "推理"
  if (role === "tool") return "工具"
  return role
}

function truncate(s: string, n: number): string {
  if (!s) return ""
  return s.length > n ? s.slice(0, n) + "…" : s
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
          <td class="fb-comment-cell">{{ truncate(fb.comment ?? "", 60) }}</td>
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
          <div class="fb-replay-header-left">
            <span class="fb-replay-badge" :class="replayFeedback?.feedback_type">
              {{ typeIcon(replayFeedback?.feedback_type ?? "thumbs_up") }}
            </span>
            <h3>{{ t("feedback_replay_title") }}</h3>
          </div>
          <button class="fb-close-btn" @click="closeReplay">✕</button>
        </div>

        <div class="fb-replay-info" v-if="replayFeedback">
          <div class="fb-info-row">
            <span class="fb-info-tag">{{ typeIcon(replayFeedback.feedback_type) }} {{ replayFeedback.feedback_type === "thumbs_up" ? "表扬" : "批评" }}</span>
            <span class="fb-info-tag" v-if="replayFeedback.rating">{{ ratingStars(replayFeedback.rating) }}</span>
            <span class="fb-info-tag source">{{ sourceLabel(replayFeedback.source) }}</span>
          </div>
          <div class="fb-info-comment" v-if="replayFeedback.comment">{{ replayFeedback.comment }}</div>
        </div>

        <div class="fb-replay-messages" ref="replayContainer">
          <div
            v-for="msg in replayMessages"
            :key="msg.id"
            class="msg-row"
          >
            <!-- User message -->
            <div v-if="msg.role === 'user'" class="msg msg-user" :class="{ 'msg-highlight': isHighlight(msg) }">
              <div class="msg-avatar user">U</div>
              <div class="msg-bubble user-bubble">{{ msg.content }}</div>
            </div>

            <!-- Assistant message -->
            <div v-else-if="msg.role === 'assistant'" class="msg msg-assistant" :class="{ 'msg-highlight': isHighlight(msg) }">
              <div class="msg-avatar assistant">A</div>
              <div class="msg-bubble assistant-bubble">
                <div class="msg-text" v-if="msg.content">{{ msg.content }}</div>
                <div class="msg-tools" v-if="msg.tool_calls?.length">
                  <div
                    v-for="tc in msg.tool_calls"
                    :key="tc.id"
                    class="tool-card"
                    :class="{ expanded: expandedTools.has(tc.id) }"
                  >
                    <div class="tool-card-header" @click="toggleTool(tc.id)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                      <span class="tool-name">{{ tc.function?.name || "tool" }}</span>
                      <svg class="tool-chevron" :class="{ open: expandedTools.has(tc.id) }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <div class="tool-card-body" v-if="expandedTools.has(tc.id)">
                      <pre class="tool-json">{{ JSON.stringify(JSON.parse(tc.function?.arguments || '{}'), null, 2) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tool result message -->
            <div v-else-if="msg.role === 'tool'" class="msg msg-tool" :class="{ 'msg-highlight': isHighlight(msg) }">
              <div class="msg-avatar tool">T</div>
              <div class="msg-bubble tool-bubble">
                <pre class="tool-result-json">{{ truncate(msg.content || '{}', 500) }}</pre>
              </div>
            </div>

            <!-- Reasoning message -->
            <div v-else-if="msg.role === 'reasoning'" class="msg msg-reasoning" :class="{ 'msg-highlight': isHighlight(msg) }">
              <div class="msg-avatar reasoning">R</div>
              <div class="msg-bubble reasoning-bubble">{{ truncate(msg.content, 300) }}</div>
            </div>
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
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--surface-alt);
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 16px;
}

.fb-replay-badge.thumbs_up {
  background: color-mix(in srgb, var(--success) 20%, transparent);
}

.fb-replay-badge.thumbs_down {
  background: color-mix(in srgb, var(--danger) 20%, transparent);
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

.fb-replay-info {
  padding: 12px 20px;
  background: var(--glass-highlight);
  border-bottom: 1px solid var(--glass-border);
}

.fb-info-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.fb-info-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: color-mix(in srgb, var(--accent-dim) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
}

.fb-info-tag.source {
  background: var(--glass-highlight);
  border-color: var(--glass-border);
  color: var(--text-secondary);
}

.fb-info-comment {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  padding: 6px 10px;
  background: var(--surface-bg);
  border-radius: 8px;
  border: 1px solid var(--glass-border);
}

/* ── Message list ── */

.fb-replay-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--glass-bg);
}

.msg-row {
  display: flex;
  flex-direction: column;
}

.msg {
  display: flex;
  gap: 10px;
  max-width: 85%;
  position: relative;
}

.msg-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.msg-assistant,
.msg-tool,
.msg-reasoning {
  align-self: flex-start;
}

.msg-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

.msg-avatar.user {
  background: var(--accent-dim);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.msg-avatar.assistant {
  background: var(--surface-raised);
  color: var(--success);
  border: 1px solid var(--glass-border);
}

.msg-avatar.tool {
  background: color-mix(in srgb, var(--warning) 20%, transparent);
  color: var(--warning);
  border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
  font-size: 10px;
}

.msg-avatar.reasoning {
  background: color-mix(in srgb, var(--info) 20%, transparent);
  color: var(--info);
  border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
  font-size: 10px;
}

.msg-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  min-width: 0;
}

.user-bubble {
  background: var(--accent-dim);
  border-bottom-right-radius: 4px;
  border: 1px solid var(--glass-border);
}

.assistant-bubble {
  background: var(--surface-bg);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--glass-border);
}

.tool-bubble {
  background: color-mix(in srgb, var(--warning) 8%, var(--surface-alt));
  border-bottom-left-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--warning) 20%, var(--glass-border));
  font-family: ui-monospace, monospace;
  font-size: 12px;
  padding: 8px 12px;
}

.reasoning-bubble {
  background: color-mix(in srgb, var(--info) 8%, var(--surface-alt));
  border-bottom-left-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--info) 20%, var(--glass-border));
  font-style: italic;
  color: var(--text-secondary);
}

.msg-text {
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Tool cards ── */

.msg-tools {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-card {
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--glass-highlight);
  transition: border-color 0.2s;
}

.tool-card:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--glass-border));
}

.tool-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary);
  font-size: 12px;
  transition: color 0.2s;
}

.tool-card-header:hover {
  color: var(--accent);
}

.tool-name {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
}

.tool-chevron {
  transition: transform 0.2s;
  color: var(--text-tertiary);
}

.tool-chevron.open {
  transform: rotate(180deg);
}

.tool-card-body {
  border-top: 1px solid var(--glass-border);
  padding: 8px 12px;
  background: var(--surface-bg);
}

.tool-json {
  margin: 0;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre;
  overflow-x: auto;
}

.tool-result-json {
  margin: 0;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Highlight ── */

.msg-highlight {
  position: relative;
}

.msg-highlight .msg-bubble {
  box-shadow: 0 0 0 2px var(--accent), 0 0 20px color-mix(in srgb, var(--accent) 25%, transparent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent-dim) 40%, var(--surface-bg));
}

.msg-highlight .user-bubble {
  background: color-mix(in srgb, var(--accent) 15%, var(--accent-dim));
}

.msg-highlight::before {
  content: "← 被评价的消息";
  position: absolute;
  top: -20px;
  left: 40px;
  font-size: 11px;
  color: var(--accent);
  font-weight: 600;
  white-space: nowrap;
}

.msg-highlight .msg-avatar {
  box-shadow: 0 0 0 2px var(--accent), 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent);
}
</style>
