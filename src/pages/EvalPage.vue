<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth"
import { useI18nStore } from "../stores/i18n"
import { useEvalStore } from "../stores/eval"
import { fetchScenarioDetail, fetchScenarios, getEvalReportUrl } from "../api/client"
import type { EvalInput, ScenarioDetail, ScenarioInfo } from "../types"
import * as XLSX from "xlsx"

const router = useRouter()
const authStore = useAuthStore()
const i18nStore = useI18nStore()
const evalStore = useEvalStore()
const { t, setLocale } = i18nStore
const selectedJob = computed(() => evalStore.selectedJob)

const activeTab = ref<"new" | "history">("new")

// ── Theme ──
const theme = ref(localStorage.getItem("theme") || "light")
const menuOpen = ref(false)

function setTheme(t: string) {
  theme.value = t
  menuOpen.value = false
  document.documentElement.setAttribute("data-theme", t)
  localStorage.setItem("theme", t)
}

document.documentElement.setAttribute("data-theme", theme.value)

// ── Scenarios ──
const scenarios = ref<ScenarioInfo[]>([])
const selectedScenarioId = ref("")
const scenarioDetail = ref<ScenarioDetail | null>(null)
const scenariosLoading = ref(false)

async function loadScenarios() {
  scenariosLoading.value = true
  try {
    scenarios.value = await fetchScenarios()
  } catch {
    scenarios.value = []
  } finally {
    scenariosLoading.value = false
  }
}

async function selectScenario(id: string) {
  selectedScenarioId.value = id
  inputs.value = []
  scenarioDetail.value = null
  if (!id) return
  try {
    scenarioDetail.value = await fetchScenarioDetail(id)
  } catch {
    scenarioDetail.value = null
  }
}

// ── Input builder ──
const inputs = ref<EvalInput[]>([])

const availableAgents = computed(() => {
  return scenarioDetail.value?.agents ?? []
})

function addInput() {
  const firstAgent = availableAgents.value[0]?.name ?? ""
  inputs.value.push({ input_text: "", agent_name: firstAgent })
}

function removeInput(index: number) {
  inputs.value.splice(index, 1)
}

// ── Config fields ──
const maxConcurrency = ref(4)

// ── Batch import ──
const batchError = ref("")

// ── XLSX import ──
function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const data = [
    { input_text: "你好，请介绍一下你自己", agent_name: "" },
    { input_text: "用Python写一个冒泡排序", agent_name: "" },
    { input_text: "翻译成英文：今天天气真好", agent_name: "" },
  ]
  const ws = XLSX.utils.json_to_sheet(data)
  ws["!cols"] = [{ wch: 50 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws, "inputs")
  XLSX.writeFile(wb, "eval_inputs_template.xlsx")
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" })
      const firstAgent = availableAgents.value[0]?.name ?? ""
      const parsed: EvalInput[] = rows
        .map((r) => ({
          input_text: (r.input_text ?? r.input ?? "").toString(),
          agent_name: (r.agent_name ?? r.agent ?? firstAgent).toString() || firstAgent,
        }))
        .filter((r) => r.input_text.trim())
      if (parsed.length > 0) {
        inputs.value = parsed
        batchError.value = ""
      } else {
        batchError.value = "No valid rows found"
      }
    } catch {
      batchError.value = "Invalid xlsx file"
    }
    input.value = ""
  }
  reader.readAsArrayBuffer(file)
}

// ── Submit ──
const submitting = ref(false)

async function handleSubmit() {
  const validInputs = inputs.value.filter((i) => i.input_text.trim())
  if (!selectedScenarioId.value || validInputs.length === 0) return

  submitting.value = true
  try {
    const result = await evalStore.createJob({
      scenario_id: selectedScenarioId.value,
      description: "",
      inputs: validInputs,
      max_concurrency: maxConcurrency.value,
    })
    activeTab.value = "history"
    if (result?.job_id) {
      await evalStore.loadJob(result.job_id)
      if (evalStore.selectedJob?.status === "running") {
        evalStore.startPolling(result.job_id)
      }
    }
  } finally {
    submitting.value = false
  }
}

// ── Job list ──

// ── Job list ──
const expandedJobId = ref<string | null>(null)

function toggleJobDetail(jobId: string) {
  expandedJobId.value = expandedJobId.value === jobId ? null : jobId
  if (expandedJobId.value) {
    loadJobWithPolling(jobId)
  } else {
    evalStore.stopPolling()
  }
}

async function loadJobWithPolling(jobId: string) {
  await evalStore.loadJob(jobId)
  const job = evalStore.selectedJob
  if (job?.status === "running") {
    evalStore.startPolling(jobId)
  }
}

function openReport(jobId: string) {
  window.open(getEvalReportUrl(jobId), "_blank")
}

function formatTime(ts: number | null | undefined): string {
  if (!ts) return "-"
  const d = new Date(ts * 1000)
  return d.toLocaleString()
}

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "-"
  return `${sec.toFixed(2)}s`
}

function statusClass(status: string): string {
  return `status-${status}`
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: t("eval_pending"),
    running: t("eval_running"),
    completed: t("eval_completed"),
    failed: t("eval_failed"),
  }
  return map[status] ?? status
}

// ── Mount ──
onMounted(() => {
  loadScenarios()
  evalStore.loadJobs()
})

onUnmounted(() => {
  evalStore.stopPolling()
})
</script>

<template>
  <div class="eval-page">
    <header class="top-bar">
      <div class="top-bar-left">
        <h1 class="eval-title">{{ t("evaluation") }}</h1>
        <div class="tab-switcher">
          <button
            :class="['tab-btn', { active: activeTab === 'new' }]"
            @click="activeTab = 'new'"
          >
            {{ t("eval_new_job") }}
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'history' }]"
            @click="activeTab = 'history'"
          >
            {{ t("eval_job_list") }}
          </button>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="hamburger-wrap">
        <button class="header-btn" @click="menuOpen = !menuOpen" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div v-if="menuOpen" class="dropdown">
          <div class="dropdown-label">{{ t("theme") }}</div>
          <button class="dropdown-item" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
            {{ t("theme_dark") }}
            <span v-if="theme === 'dark'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'light' }" @click="setTheme('light')">
            {{ t("theme_light") }}
            <span v-if="theme === 'light'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'dusk' }" @click="setTheme('dusk')">
            {{ t("theme_dusk") }}
            <span v-if="theme === 'dusk'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'sepia' }" @click="setTheme('sepia')">
            {{ t("theme_sepia") }}
            <span v-if="theme === 'sepia'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'lemonade' }" @click="setTheme('lemonade')">
            {{ t("theme_lemonade") }}
            <span v-if="theme === 'lemonade'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'eclipse' }" @click="setTheme('eclipse')">
            {{ t("theme_eclipse") }}
            <span v-if="theme === 'eclipse'" class="check">✓</span>
          </button>
          <div class="dropdown-divider"></div>
          <div class="dropdown-label">{{ t("language") }}</div>
          <button class="dropdown-item" :class="{ active: i18nStore.locale === 'zh' }" @click="setLocale('zh')">
            中文
            <span v-if="i18nStore.locale === 'zh'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: i18nStore.locale === 'en' }" @click="setLocale('en')">
            English
            <span v-if="i18nStore.locale === 'en'" class="check">✓</span>
          </button>
          <div class="dropdown-divider"></div>
          <div class="dropdown-user">
            <template v-if="authStore.user">
              <span class="user-name">{{ authStore.user.username }}</span>
              <span class="user-role">{{ authStore.user.roles[0]?.name }}</span>
            </template>
          </div>
          <button class="dropdown-item" @click="router.push('/')">
            {{ t("new_chat") }}
          </button>
        </div>
      </div>
      <div v-if="menuOpen" class="menu-overlay" @click="menuOpen = false"></div>
    </header>

    <div class="eval-content">
      <!-- Error banner -->
      <div v-if="evalStore.error" class="error-toast" @click="evalStore.setError(null)">
        <span class="error-toast-text">{{ evalStore.error }}</span>
        <button class="error-toast-close" @click.stop="evalStore.setError(null)">&times;</button>
      </div>

      <!-- ── Tab: New Job ── -->
      <div v-if="activeTab === 'new'" class="tab-panel">
        <div class="form-card">
          <h2 class="form-section-title">{{ t("eval_scenario") }}</h2>
          <select v-model="selectedScenarioId" class="form-select" @change="selectScenario(selectedScenarioId)">
            <option value="" disabled>{{ scenariosLoading ? 'Loading...' : t("select_scene") }}</option>
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.icon }} {{ s.name }}
            </option>
          </select>
        </div>

        <div v-if="scenarioDetail" class="form-card">
          <h2 class="form-section-title">{{ t("eval_inputs") }}</h2>

          <div
            v-for="(inp, idx) in inputs"
            :key="idx"
            class="input-row"
          >
            <select v-model="inp.agent_name" class="form-select agent-select">
              <option v-for="a in availableAgents" :key="a.name" :value="a.name">
                {{ a.display_name || a.name }}
              </option>
            </select>
            <textarea
              v-model="inp.input_text"
              class="form-textarea"
              :placeholder="t('eval_input_text')"
              rows="2"
            ></textarea>
            <button class="btn-remove" @click="removeInput(idx)" title="Remove">&times;</button>
          </div>

          <button v-if="availableAgents.length > 0" class="btn-add" @click="addInput">
            {{ t("eval_add_input") }}
          </button>
          <p v-else class="empty-hint">{{ t("eval_no_agents_for_scenario") }}</p>

          <details class="batch-import">
            <summary class="batch-summary">{{ t("eval_batch_import") }}</summary>
            <div class="batch-xlsx">
              <button class="btn-outline" @click="downloadTemplate">
                {{ t("eval_batch_import_download") }}
              </button>
              <label class="btn-outline btn-upload">
                {{ t("eval_batch_import_upload") }}
                <input type="file" accept=".xlsx" hidden @change="handleFileUpload" />
              </label>
            </div>
            <span v-if="batchError" class="batch-error">{{ batchError }}</span>
          </details>
        </div>

        <div class="form-card config-card">
          <div class="config-row">
            <label class="config-label">{{ t("eval_max_concurrency") }}</label>
            <input v-model.number="maxConcurrency" type="number" min="1" max="20" class="form-input-num" />
          </div>
        </div>

        <button
          class="btn-submit"
          :disabled="submitting || !selectedScenarioId || inputs.filter(i => i.input_text.trim()).length === 0"
          @click="handleSubmit"
        >
          {{ submitting ? 'Running...' : t("eval_run") }}
        </button>
      </div>

      <!-- ── Tab: Job History ── -->
      <div v-else class="tab-panel">
        <div v-if="evalStore.loading" class="loading-hint">{{ t("loading") }}</div>

        <div v-else-if="evalStore.jobs.length === 0" class="empty-hint">
          {{ t("eval_no_jobs") }}
        </div>

        <div v-else class="job-list">
          <div
            v-for="job in evalStore.jobs"
            :key="job.job_id"
            class="job-item"
          >
            <div class="job-header" @click="toggleJobDetail(job.job_id)">
              <span class="job-id">{{ job.job_id }}</span>
              <span class="job-scenario">{{ job.scenario_id }}</span>
              <span :class="['job-status', statusClass(job.status)]">
                {{ statusLabel(job.status) }}
              </span>
              <span class="job-created">{{ formatTime(job.created_at) }}</span>
              <span class="job-expand-icon">{{ expandedJobId === job.job_id ? '▼' : '▶' }}</span>
            </div>

            <div v-if="expandedJobId === job.job_id" class="job-detail">
              <div v-if="selectedJob?.status === 'running'" class="polling-hint">
                {{ t("eval_running") }}...
              </div>

              <div v-if="selectedJob?.error" class="error-block">
                {{ selectedJob.error }}
              </div>

              <template v-if="selectedJob?.summary">
                <div class="summary-grid">
                  <div class="summary-card">
                    <span class="summary-value green">{{ selectedJob.summary.completed }}</span>
                    <span class="summary-label">{{ t("eval_completed") }}</span>
                  </div>
                  <div class="summary-card">
                    <span class="summary-value red">{{ selectedJob.summary.failed }}</span>
                    <span class="summary-label">{{ t("eval_failed") }}</span>
                  </div>
                  <div class="summary-card">
                    <span class="summary-value yellow">{{ selectedJob.summary.interrupted }}</span>
                    <span class="summary-label">{{ t("eval_interrupted") }}</span>
                  </div>
                  <div class="summary-card">
                    <span class="summary-value">{{ selectedJob.summary.avg_time.toFixed(2) }}s</span>
                    <span class="summary-label">{{ t("eval_avg_time") }}</span>
                  </div>
                  <div class="summary-card">
                    <span class="summary-value">{{ selectedJob.summary.total_tokens.toLocaleString() }}</span>
                    <span class="summary-label">{{ t("eval_total_tokens") }}</span>
                  </div>
                  <div class="summary-card" v-if="selectedJob.summary.total_cost != null">
                    <span class="summary-value cost">${{ selectedJob.summary.total_cost.toFixed(6) }}</span>
                    <span class="summary-label">{{ t("eval_total_cost") }}</span>
                  </div>
                </div>

                <div class="runs-table-wrap">
                  <table class="runs-table">
                    <thead>
                      <tr>
                        <th>{{ t("eval_run_id") }}</th>
                        <th>{{ t("eval_input") }}</th>
                        <th>{{ t("eval_agent") }}</th>
                        <th>{{ t("eval_status") }}</th>
                        <th>{{ t("eval_time") }}</th>
                        <th>LLM</th>
                        <th>{{ t("eval_tools") }}</th>
                        <th>{{ t("eval_tokens") }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in selectedJob.summary.runs" :key="r.run_id">
                        <td class="cell-mono">{{ r.run_id }}</td>
                        <td class="cell-input" :title="r.input_text">{{ r.input_text }}</td>
                        <td>{{ r.agent_metadata_id }}</td>
                        <td>
                          <span :class="['status-badge', statusClass(r.status)]">
                            {{ statusLabel(r.status) }}
                          </span>
                          <span v-if="r.exceeded" class="exceeded-mark">max-iter</span>
                        </td>
                        <td>{{ fmtDuration(r.time_taken) }}</td>
                        <td>{{ r.llm_call_count }}</td>
                        <td>{{ r.tool_call_count }}</td>
                        <td>
                          <template v-if="r.token_usage">
                            {{ (r.token_usage.input_tokens + r.token_usage.output_tokens).toLocaleString() }}
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <button v-if="job.status === 'completed' || job.status === 'failed'" class="btn-report" @click="openReport(job.job_id)">
                  {{ t("eval_view_report") }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eval-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--bg);
  color: var(--text-primary);
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface-bg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.eval-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
}

.tab-switcher {
  display: flex;
  gap: 0;
  background: var(--surface-raised);
  border-radius: 6px;
  overflow: hidden;
}

.tab-btn {
  padding: 6px 16px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: all 0.15s;
}

.tab-btn.active {
  background: var(--accent);
  color: var(--accent-text, #fff);
}

.tab-btn:hover:not(.active) {
  color: var(--text-primary);
  background: var(--border);
}

.spacer {
  flex: 1;
}

.header-btn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-primary);
  border-radius: 4px;
}

.header-btn:hover {
  background: var(--border);
}

.hamburger-wrap {
  position: relative;
}

.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 160px;
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 201;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.dropdown-item:hover {
  background: var(--surface-raised);
}

.dropdown-item.active {
  color: var(--accent);
}

.dropdown-item .check {
  margin-left: auto;
  color: var(--accent);
}

.dropdown-label {
  padding: 6px 14px 2px;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.dropdown-user {
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-user .user-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.dropdown-user .user-role {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
}

.eval-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-card {
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
}

.form-section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--text-primary);
}

.form-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: var(--accent);
}

.input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
}

.agent-select {
  width: 180px;
  flex-shrink: 0;
}

.form-textarea {
  flex: 1;
  padding: 8px 10px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 40px;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-remove {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 6px;
  line-height: 1;
  border-radius: 4px;
  flex-shrink: 0;
}

.btn-remove:hover {
  color: var(--danger-text);
  background: var(--danger-hover);
}

.btn-add {
  padding: 6px 14px;
  background: var(--accent-dim);
  border: 1px dashed var(--accent);
  border-radius: 6px;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
}

.btn-add:hover {
  background: var(--accent);
  color: var(--accent-text, #fff);
}

.config-card {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.form-input-num {
  width: 70px;
  padding: 6px 8px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  text-align: center;
}

.form-input-num:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-submit {
  padding: 10px 24px;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: var(--accent-text, #fff);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  align-self: flex-start;
}

.btn-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-hint,
.empty-hint {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 14px;
}

.polling-hint {
  text-align: center;
  padding: 8px;
  color: var(--accent);
  font-size: 12px;
  background: var(--accent-dim);
  border-radius: 6px;
  margin-bottom: 12px;
}

.error-toast {
  position: fixed;
  top: 52px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--danger);
  color: var(--danger-text);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 9999;
  border: 1px solid var(--danger-hover);
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  max-width: 80vw;
}

.error-toast-text {
  flex: 1;
  word-break: break-word;
}

.error-toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--danger-text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  padding: 0;
}

.error-toast-close:hover {
  opacity: 1;
}

.job-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  background: var(--surface-bg);
}

.job-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.job-header:hover {
  background: var(--surface-raised);
}

.job-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 70px;
}

.job-scenario {
  font-weight: 500;
  min-width: 100px;
}

.job-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  min-width: 70px;
  text-align: center;
}

.status-pending {
  background: var(--surface-raised);
  color: var(--text-muted);
}

.status-running {
  background: var(--accent-dim);
  color: var(--accent);
}

.status-completed {
  background: #064e3b;
  color: #4ade80;
}

.status-failed {
  background: #7f1d1d;
  color: #f87171;
}

.status-interrupted {
  background: #713f12;
  color: #facc15;
}

.job-created {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: auto;
}

.job-expand-icon {
  font-size: 10px;
  color: var(--text-muted);
}

.job-detail {
  padding: 16px;
  border-top: 1px solid var(--border);
  background: var(--surface-raised);
}

.error-block {
  background: #7f1d1d;
  color: #fca5a5;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.summary-card {
  background: var(--surface-bg);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  border: 1px solid var(--border);
}

.summary-value {
  font-size: 1.3rem;
  font-weight: 700;
  display: block;
}

.summary-value.green { color: #4ade80; }
.summary-value.red { color: #f87171; }
.summary-value.yellow { color: #facc15; }
.summary-value.cost { color: #fbbf24; }

.summary-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  display: block;
}

.runs-table-wrap {
  overflow-x: auto;
  margin-bottom: 12px;
}

.runs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.runs-table th {
  text-align: left;
  padding: 8px 6px;
  border-bottom: 2px solid var(--border);
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
}

.runs-table td {
  padding: 8px 6px;
  border-bottom: 1px solid var(--border);
}

.cell-mono {
  font-family: monospace;
  font-size: 11px;
}

.cell-input {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.exceeded-mark {
  font-size: 10px;
  color: #facc15;
  margin-left: 4px;
}

.btn-report {
  padding: 8px 20px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: var(--accent-text, #fff);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-report:hover {
  opacity: 0.9;
}

.batch-import {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.batch-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}

.batch-summary:hover {
  opacity: 0.8;
}

.batch-error {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--danger-text);
  background: var(--danger);
  padding: 4px 10px;
  border-radius: 4px;
}

.batch-xlsx {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--accent);
  border-radius: 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.btn-outline:hover {
  background: var(--accent);
  color: var(--accent-text, #fff);
}

.btn-upload {
  cursor: pointer;
}

@media (max-width: 640px) {
  .eval-content {
    padding: 12px;
  }
  .top-bar-left {
    gap: 12px;
  }
  .eval-title {
    font-size: 1rem;
  }
  .agent-select {
    width: 120px;
  }
  .input-row {
    flex-wrap: wrap;
  }
}
</style>
