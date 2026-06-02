<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue"
import { useI18nStore } from "../stores/i18n"
import { useEvalStore } from "../stores/eval"
import { fetchScenarioDetail, fetchScenarios, getEvalReportUrl } from "../api/client"
import type { EvalInput, ScenarioDetail, ScenarioInfo } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import SearchSelect from "../components/SearchSelect.vue"
import * as XLSX from "xlsx"

const i18nStore = useI18nStore()
const evalStore = useEvalStore()
const { t } = i18nStore
const selectedJob = computed(() => evalStore.selectedJob)

const activeTab = ref<"new" | "history">("new")

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

const scenarioOptions = computed(() =>
  scenarios.value.map(s => ({ value: s.id, label: `${s.icon} ${s.name}` }))
)

const agentOptions = computed(() =>
  availableAgents.value.map(a => ({ value: a.name, label: a.display_name || a.name }))
)

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
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content eval-content">
      <header class="mgmt-header">
        <h1>{{ t("evaluation") }}</h1>
        <div class="mgmt-tabs">
          <button :class="['tab-btn', { active: activeTab === 'new' }]" @click="activeTab = 'new'">
            {{ t("eval_new_job") }}
          </button>
          <button :class="['tab-btn', { active: activeTab === 'history' }]" @click="activeTab = 'history'">
            {{ t("eval_job_list") }}
          </button>
        </div>
      </header>

      <!-- Error banner -->
      <div v-if="evalStore.error" class="eval-error" @click="evalStore.setError(null)">
        <span class="eval-error-text">{{ evalStore.error }}</span>
        <button class="eval-error-close" @click.stop="evalStore.setError(null)">&times;</button>
      </div>

      <!-- ── Tab: New Job ── -->
      <div v-if="activeTab === 'new'" class="tab-panel">
        <div class="form-card">
          <h2 class="form-section-title">{{ t("eval_scenario") }}</h2>
          <SearchSelect v-model="selectedScenarioId" :options="scenarioOptions" :placeholder="scenariosLoading ? 'Loading...' : t('select_scene')" @change="selectScenario" />
        </div>

        <div v-if="scenarioDetail" class="form-card">
          <h2 class="form-section-title">{{ t("eval_inputs") }}</h2>

          <div
            v-for="(inp, idx) in inputs"
            :key="idx"
            class="input-row"
          >
            <SearchSelect v-model="inp.agent_name" :options="agentOptions" :searchable="false" />
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
        <div v-if="evalStore.loading" class="job-list">
          <div v-for="i in 3" :key="i" class="job-item" style="pointer-events:none">
            <div class="job-header">
              <span class="job-id"><span class="mgmt-skeleton-cell" style="width:80px;height:12px"></span></span>
              <span class="job-scenario"><span class="mgmt-skeleton-cell" style="width:100px;height:12px"></span></span>
              <span class="job-status"><span class="mgmt-skeleton-cell" style="width:60px;height:16px;border-radius:4px"></span></span>
              <span class="job-created"><span class="mgmt-skeleton-cell" style="width:120px;height:12px"></span></span>
              <span class="job-expand-icon"><span class="mgmt-skeleton-cell" style="width:12px;height:12px"></span></span>
            </div>
          </div>
        </div>

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
.eval-content {
  max-width: 1160px;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
}

.form-section-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 14px;
  color: var(--text-primary);
}

.form-select {
  width: 100%;
  padding: 9px 12px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.form-select option {
  background: var(--glass-bg);
  color: var(--text-primary);
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
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
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
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
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
  padding: 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  background: var(--accent-dim);
  border-radius: 8px;
  margin-bottom: 14px;
}

.eval-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  margin-bottom: 16px;
  transition: background 0.15s;
}
.eval-error:hover {
  background: rgba(239, 68, 68, 0.15);
}

.eval-error-text {
  flex: 1;
  word-break: break-word;
}

.eval-error-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #ef4444;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  padding: 0 2px;
  border-radius: 4px;
  transition: opacity 0.15s;
}
.eval-error-close:hover { opacity: 1; }

.job-item {
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
  background: var(--glass-bg);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.job-item:hover {
  border-color: var(--border-hover);
}

.job-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  cursor: pointer;
  transition: background 0.15s;
}

.job-header:hover {
  background: var(--glass-highlight);
}

.job-id {
  font-family: var(--font-mono);
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
  background: var(--glass-highlight);
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
  padding: 20px;
  border-top: 1px solid var(--glass-border);
  background: var(--glass-highlight);
}

.error-block {
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  margin-bottom: 14px;
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}

.summary-card {
  background: var(--glass-bg);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
  border: 1px solid var(--glass-border);
  transition: border-color 0.15s;
}
.summary-card:hover {
  border-color: var(--border-hover);
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
  border-bottom: 2px solid var(--glass-border);
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
}

.runs-table td {
  padding: 8px 6px;
  border-bottom: 1px solid var(--glass-border);
}

.cell-mono {
  font-family: var(--font-mono);
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
  border-top: 1px solid var(--glass-border);
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
