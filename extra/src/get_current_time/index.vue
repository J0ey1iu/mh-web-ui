<script lang="ts">
export const demoMock = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({
    status: "ok",
    iso: "2025-05-19T10:30:00Z",
    weekday: "Monday",
    date: "2025-05-19",
    time: "10:30:00",
    timezone: "Asia/Shanghai (CST, UTC+8)",
  }),
}

export const demoMockRunning = {
  status: "running" as const,
  progress: JSON.stringify({ message: "Fetching current time from time server..." }),
  result: "",
}

export const demoMockError = {
  status: "error" as const,
  progress: "",
  result: "Failed to get current time: network error",
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface TimeResult {
  status: string
  iso?: string
  weekday?: string
  date?: string
  time?: string
  timezone?: string
  message?: string
}

const parsedResult = computed<TimeResult | null>(() => {
  if (!props.tool.result) return null
  try {
    return JSON.parse(props.tool.result) as TimeResult
  } catch {
    return null
  }
})

const progressMessage = computed(() => {
  if (!props.tool.progress) return null
  try {
    const parsed = JSON.parse(props.tool.progress)
    return parsed.message ?? null
  } catch {
    return props.tool.progress
  }
})

const errorMessage = computed(() => {
  if (props.tool.status === "error") return props.tool.result
  if (parsedResult.value?.status === "error") return parsedResult.value.message ?? t("failed_to_get_time")
  return null
})
</script>

<template>
  <div v-if="errorMessage" class="tool-result">{{ errorMessage }}</div>
  <template v-else-if="tool.status === 'running'">
    <div class="time-running">
      <span class="time-dot" />
      <span class="time-status">{{ progressMessage ?? t("fetching_time") }}</span>
    </div>
  </template>
  <template v-else-if="parsedResult">
    <div class="time-card">
      <div class="time-value">{{ parsedResult.time }}</div>
      <div class="time-divider" />
      <div class="time-meta">
        <div class="time-meta-row">
          <span class="time-label">{{ t("date") }}</span>
          <span class="time-info">{{ parsedResult.date }}</span>
        </div>
        <div class="time-meta-row">
          <span class="time-label">{{ t("weekday") }}</span>
          <span class="time-info">{{ parsedResult.weekday }}</span>
        </div>
        <div class="time-meta-row">
          <span class="time-label">{{ t("timezone") }}</span>
          <span class="time-info">{{ parsedResult.timezone }}</span>
        </div>
      </div>
    </div>
  </template>
  <div v-else-if="tool.result" class="tool-result">{{ tool.result }}</div>
</template>

<style scoped>
.time-running {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.time-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: timePulse 1.2s ease-in-out infinite;
}
.time-status {
  font-size: 12px;
  color: var(--text-secondary);
}
.time-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  background: color-mix(in srgb, var(--surface-bg) 60%, transparent);
}
.time-value {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 32px;
  font-weight: 700;
  color: var(--text-strong);
  text-align: center;
  letter-spacing: 2px;
  line-height: 1.2;
  background: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, var(--success)) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.time-divider {
  height: 1px;
  background: var(--border);
  margin: 14px 0;
}
.time-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.time-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.time-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.time-info {
  font-size: 13px;
  color: var(--text-primary);
  font-family: monospace;
}

@keyframes timePulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
</style>
