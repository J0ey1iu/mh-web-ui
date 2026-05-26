<script lang="ts">
const _meta = {
  profiles: [
    { name: "Alice", role: "Software Engineer", experience: "5 years", skills: ["Python", "Rust", "Kubernetes"], avatar: "👩‍💻" },
    { name: "Bob", role: "Product Manager", experience: "8 years", skills: ["Strategy", "Analytics", "UX"], avatar: "👨‍💼" },
    { name: "Charlie", role: "Data Scientist", experience: "3 years", skills: ["ML", "Python", "SQL"], avatar: "🧑‍🔬" },
  ],
  chart_data: { labels: ["Alice", "Bob", "Charlie"], values: [5, 8, 3], label: "Years of Experience" },
  html: '<div style="padding:10px;background:#f0f7ff;border-radius:8px;border:1px solid #b8d4fe;"><h3 style="margin:0 0 8px;color:#1a56db;">Profile Matches</h3><p style="margin:0;color:#374151;">3 candidates matched your search criteria. Click each card for details.</p></div>',
}

export const demoMock = {
  status: "success" as const,
  progress: `{"message":"Fetching profile data..."}`,
  result: JSON.stringify({ result: "Found 3 matching profiles: Alice (SDE, 5yr), Bob (PM, 8yr), Charlie (DS, 3yr).", count: 3 }),
  meta: JSON.stringify(_meta),
}

export const demoMockRunning = {
  status: "running" as const,
  progress: `{"message":"Fetching profile data..."}`,
  result: "",
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface Profile {
  name: string
  role: string
  experience: string
  skills: string[]
  avatar: string
}

interface Meta {
  profiles?: Profile[]
  chart_data?: { labels: string[]; values: number[]; label: string }
  html?: string
}

const meta = computed<Meta | null>(() => {
  if (!props.tool.meta) return null
  try {
    return JSON.parse(props.tool.meta) as Meta
  } catch {
    return null
  }
})

const maxBarValue = computed(() => {
  if (!meta.value?.chart_data) return 0
  return Math.max(...meta.value.chart_data.values, 1)
})
</script>

<template>
  <div class="uim" :class="tool.status">
    <!-- Running state -->
    <template v-if="tool.status === 'running'">
      <div class="uim-loading">
        <span class="uim-spinner" />
        <span>{{ t("fetching") }}</span>
      </div>
    </template>

    <!-- Success state -->
    <template v-else-if="tool.status === 'success' && meta">
      <!-- HTML block from meta -->
      <div v-if="meta.html" class="uim-html" v-html="meta.html" />

      <!-- Bar chart -->
      <div v-if="meta.chart_data" class="uim-chart">
        <div class="uim-chart-title">{{ meta.chart_data.label }}</div>
        <div class="uim-bars">
          <div
            v-for="(value, idx) in meta.chart_data.values"
            :key="meta.chart_data.labels[idx]"
            class="uim-bar-row"
          >
            <span class="uim-bar-label">{{ meta.chart_data.labels[idx] }}</span>
            <div class="uim-bar-track">
              <div
                class="uim-bar-fill"
                :style="{ width: (value / maxBarValue) * 100 + '%' }"
              />
            </div>
            <span class="uim-bar-value">{{ value }} yr</span>
          </div>
        </div>
      </div>

      <!-- Profile cards -->
      <div v-if="meta.profiles" class="uim-profiles">
        <div
          v-for="p in meta.profiles"
          :key="p.name"
          class="uim-profile-card"
        >
          <div class="uim-profile-header">
            <span class="uim-profile-avatar">{{ p.avatar }}</span>
            <div>
              <div class="uim-profile-name">{{ p.name }}</div>
              <div class="uim-profile-role">{{ p.role }}</div>
            </div>
            <span class="uim-profile-exp">{{ p.experience }}</span>
          </div>
          <div class="uim-profile-skills">
            <span
              v-for="sk in p.skills"
              :key="sk"
              class="uim-skill-tag"
            >{{ sk }}</span>
          </div>
        </div>
      </div>

      <!-- No meta fallback -->
      <div v-if="!meta.html && !meta.chart_data && !meta.profiles" class="uim-fallback">
        {{ tool.result || t("no_data") }}
      </div>
    </template>

    <!-- Error state -->
    <template v-else>
      <div class="uim-error">{{ tool.result || t("error") }}</div>
    </template>
  </div>
</template>

<style scoped>
.uim {
  margin: 2px 0;
}
.uim-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
  padding: 8px 0;
}
.uim-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: uimSpin 0.8s linear infinite;
}
.uim-html {
  margin-bottom: 12px;
}
.uim-html :deep(h3) {
  margin: 0 0 6px;
  font-size: 14px;
}
.uim-html :deep(p) {
  margin: 0;
  font-size: 13px;
}
.uim-chart {
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.uim-chart-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.uim-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.uim-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.uim-bar-label {
  width: 60px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: right;
  flex-shrink: 0;
}
.uim-bar-track {
  flex: 1;
  height: 18px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: 4px;
  overflow: hidden;
}
.uim-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, var(--success)));
  border-radius: 4px;
  transition: width 0.4s ease;
}
.uim-bar-value {
  width: 36px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.uim-profiles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.uim-profile-card {
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  transition: border-color 0.2s;
}
.uim-profile-card:hover {
  border-color: var(--accent);
}
.uim-profile-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.uim-profile-avatar {
  font-size: 28px;
  line-height: 1;
}
.uim-profile-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}
.uim-profile-role {
  font-size: 12px;
  color: var(--text-tertiary);
}
.uim-profile-exp {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  padding: 2px 8px;
  border-radius: 12px;
}
.uim-profile-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.uim-skill-tag {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--border);
  padding: 2px 8px;
  border-radius: 10px;
}
.uim-fallback {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 8px 0;
}
.uim-error {
  font-size: 13px;
  color: var(--error);
}
@keyframes uimSpin {
  to { transform: rotate(360deg); }
}
</style>
