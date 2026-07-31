<script setup lang="ts">
import { ref, onMounted } from "vue"
import { fetchMetrics } from "../api/client"
import type { MetricsSummary, MetricsTopItem } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"
import { useAlertStore } from "../stores/alert"

const { t } = useI18nStore()
const alertStore = useAlertStore()

function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

const dateFrom = ref(daysAgo(30))
const dateTo = ref(today())
const loading = ref(false)
const data = ref<MetricsSummary | null>(null)

async function load() {
  loading.value = true
  try {
    data.value = await fetchMetrics({
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
    })
  } catch (e) {
    alertStore.show(e instanceof Error ? e.message : String(e))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function barWidth(item: MetricsTopItem, items: MetricsTopItem[]): string {
  const max = items.length ? items[0].count : 0
  if (!max) return "0%"
  return `${Math.max((item.count / max) * 100, 4)}%`
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms.toFixed(0)}ms`
}
</script>

<template>
  <div class="metrics-page">
    <ManagementNav />

    <main class="metrics-main">
      <div class="metrics-toolbar">
        <div class="metrics-title">{{ t("mgmt_metrics") }}</div>
        <div class="metrics-controls">
          <label class="date-field">
            <span>{{ t("metrics_date_from") }}</span>
            <input v-model="dateFrom" type="date" />
          </label>
          <label class="date-field">
            <span>{{ t("metrics_date_to") }}</span>
            <input v-model="dateTo" type="date" />
          </label>
          <button class="refresh-btn" :disabled="loading" @click="load">
            {{ loading ? t("mgmt_loading") : t("metrics_refresh") }}
          </button>
        </div>
      </div>

      <div v-if="data" class="metrics-content">
        <div class="cards">
          <div class="metric-card">
            <div class="metric-label">{{ t("metrics_llm_calls") }}</div>
            <div class="metric-value">{{ formatNumber(data.llm_call_count) }}</div>
            <div class="metric-sub">
              {{ t("metrics_errors") }}: {{ data.error_count }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">{{ t("metrics_tokens") }}</div>
            <div class="metric-value">{{ formatNumber(data.total_tokens) }}</div>
            <div class="metric-sub">
              {{ t("metrics_prompt") }} {{ formatNumber(data.prompt_tokens) }} /
              {{ t("metrics_completion") }} {{ formatNumber(data.completion_tokens) }}
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-label">{{ t("metrics_avg_duration") }}</div>
            <div class="metric-value">{{ formatMs(data.avg_duration_ms) }}</div>
            <div class="metric-sub">{{ t("metrics_per_call") }}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">{{ t("metrics_entities") }}</div>
            <div class="metric-value entity-counts">
              <span>{{ data.entity_counts.scenes }}</span>
              <span>{{ data.entity_counts.agents }}</span>
              <span>{{ data.entity_counts.tools }}</span>
            </div>
            <div class="metric-sub">
              {{ t("metrics_scenes") }} / {{ t("metrics_agents") }} /
              {{ t("metrics_tools") }}
            </div>
          </div>
        </div>

        <div class="panels">
          <section class="panel">
            <h3>{{ t("metrics_top_scenes") }}</h3>
            <div v-if="data.top_scenes.length" class="bar-list">
              <div v-for="item in data.top_scenes" :key="item.name" class="bar-row">
                <span class="bar-name">{{ item.name }}</span>
                <div class="bar-track">
                  <div class="bar-fill scene" :style="{ width: barWidth(item, data.top_scenes) }"></div>
                </div>
                <span class="bar-count">{{ item.count }}</span>
              </div>
            </div>
            <div v-else class="empty">{{ t("metrics_no_data") }}</div>
          </section>

          <section class="panel">
            <h3>{{ t("metrics_top_agents") }}</h3>
            <div v-if="data.top_agents.length" class="bar-list">
              <div v-for="item in data.top_agents" :key="item.name" class="bar-row">
                <span class="bar-name">{{ item.name }}</span>
                <div class="bar-track">
                  <div class="bar-fill agent" :style="{ width: barWidth(item, data.top_agents) }"></div>
                </div>
                <span class="bar-count">{{ item.count }}</span>
              </div>
            </div>
            <div v-else class="empty">{{ t("metrics_no_data") }}</div>
          </section>

          <section class="panel">
            <h3>{{ t("metrics_top_tools") }}</h3>
            <div v-if="data.top_tools.length" class="bar-list">
              <div v-for="item in data.top_tools" :key="item.name" class="bar-row">
                <span class="bar-name">{{ item.name }}</span>
                <div class="bar-track">
                  <div class="bar-fill tool" :style="{ width: barWidth(item, data.top_tools) }"></div>
                </div>
                <span class="bar-count">{{ item.count }}</span>
              </div>
            </div>
            <div v-else class="empty">{{ t("metrics_no_data") }}</div>
          </section>

          <section class="panel">
            <h3>{{ t("metrics_top_users") }}</h3>
            <div v-if="data.top_users.length" class="bar-list">
              <div v-for="item in data.top_users" :key="item.name" class="bar-row">
                <span class="bar-name">{{ item.name }}</span>
                <div class="bar-track">
                  <div class="bar-fill user" :style="{ width: barWidth(item, data.top_users) }"></div>
                </div>
                <span class="bar-count">{{ item.count }}</span>
              </div>
            </div>
            <div v-else class="empty">{{ t("metrics_no_data") }}</div>
          </section>
        </div>

        <section class="panel model-panel">
          <h3>{{ t("metrics_model_perf") }}</h3>
          <table v-if="data.model_perf.length" class="model-table">
            <thead>
              <tr>
                <th>{{ t("metrics_model") }}</th>
                <th>{{ t("metrics_call_count") }}</th>
                <th>{{ t("metrics_avg_duration") }}</th>
                <th>P50</th>
                <th>P95</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in data.model_perf" :key="m.provider + '/' + m.model">
                <td class="model-name">{{ m.provider }} / {{ m.model }}</td>
                <td>{{ m.call_count }}</td>
                <td>{{ formatMs(m.avg_duration_ms) }}</td>
                <td>{{ formatMs(m.p50_ms) }}</td>
                <td>{{ formatMs(m.p95_ms) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">{{ t("metrics_no_data") }}</div>
        </section>
      </div>

      <div v-else-if="loading" class="loading">{{ t("mgmt_loading") }}</div>
    </main>
  </div>
</template>

<style scoped>
.metrics-page {
  min-height: 100vh;
  background: var(--bg-gradient);
  display: flex;
  flex-direction: column;
}

.metrics-main {
  max-width: 1160px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.metrics-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.metrics-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.metrics-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.date-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.date-field input {
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--glass-highlight);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
}

.refresh-btn {
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.metric-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 18px;
}

.metric-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.entity-counts span {
  margin-right: 14px;
}

.metric-sub {
  font-size: 12px;
  color: var(--text-tertiary, var(--text-secondary));
  margin-top: 6px;
}

.panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.panel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 16px 18px;
}

.panel h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.bar-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-name {
  flex: 0 0 96px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  flex: 1;
  height: 10px;
  background: var(--glass-highlight);
  border-radius: 5px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.4s ease;
}
.bar-fill.scene { background: var(--accent); }
.bar-fill.agent { background: #4caf50; }
.bar-fill.tool  { background: #ff9800; }
.bar-fill.user  { background: #9c27b0; }

.bar-count {
  flex: 0 0 36px;
  text-align: right;
  font-size: 12px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.model-panel {
  overflow-x: auto;
}

.model-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.model-table th,
.model-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.model-table th {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 12px;
}

.model-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.empty {
  color: var(--text-tertiary, var(--text-secondary));
  font-size: 13px;
  padding: 8px 0;
}

.loading {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}
</style>
