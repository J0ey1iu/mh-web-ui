<script lang="ts">
export const demoMock = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({ status: "ok", expression: "2 ** 10", result: 1024 }),
}

export const demoMockRunning = {
  status: "running" as const,
  progress: JSON.stringify({ message: "Evaluating: 2 ** 10" }),
  result: "",
}

export const demoMockError = {
  status: "error" as const,
  progress: "",
  result: JSON.stringify({ status: "error", expression: "1 / 0", message: "Division by zero" }),
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface CalcResult {
  status: string
  expression?: string
  result?: number
  message?: string
}

const parsedResult = computed<CalcResult | null>(() => {
  if (!props.tool.result) return null
  try {
    return JSON.parse(props.tool.result) as CalcResult
  } catch {
    return null
  }
})

const expression = computed(() => {
  if (parsedResult.value?.expression) return parsedResult.value.expression
  if (props.tool.progress) {
    const m = props.tool.progress.match(/"message"\s*:\s*"Evaluating:\s*(.+?)"/)
    if (m) return m[1]
  }
  return ""
})

const resultValue = computed(() => parsedResult.value?.result)

const resultDisplay = computed(() => {
  const r = resultValue.value
  if (r === null || r === undefined) return null
  if (Number.isInteger(r)) return r.toLocaleString()
  return parseFloat(r.toFixed(12)).toString()
})

const isLongExpression = computed(() => expression.value.length > 28)

const errorMessage = computed(() => {
  if (parsedResult.value?.status === "error") {
    return parsedResult.value.message ?? t("calculation_failed")
  }
  return null
})
</script>

<template>
  <div class="calc" :class="tool.status">
    <!-- Running state -->
    <template v-if="tool.status === 'running'">
      <div class="calc-indicator">
        <span class="calc-dot" />
        <span class="calc-status">{{ t("calculating") }}</span>
      </div>
      <div class="calc-display">
        <div class="calc-expression" :class="{ long: isLongExpression }">
          {{ expression || "\u00a0" }}<span class="calc-cursor" />
        </div>
      </div>
    </template>

    <!-- Success state -->
    <template v-else-if="tool.status === 'success' && errorMessage">
      <div class="calc-display">
        <div class="calc-expression">{{ expression }}</div>
        <div class="calc-divider" />
        <div class="calc-error">
          <span class="calc-error-icon">!</span>
          {{ errorMessage }}
        </div>
      </div>
    </template>

    <template v-else-if="tool.status === 'success'">
      <div class="calc-display">
        <div class="calc-expression" :class="{ long: isLongExpression }">{{ expression }}</div>
        <div class="calc-divider" />
        <div class="calc-result-wrap">
          <span class="calc-equals">{{ t("equals") }}</span>
          <span v-if="resultDisplay !== null" class="calc-result">{{ resultDisplay }}</span>
          <span v-else class="calc-result raw">{{ parsedResult?.result }}</span>
        </div>
      </div>
    </template>

    <!-- Error state -->
    <template v-else>
      <div class="calc-display">
        <div class="calc-expression">{{ expression }}</div>
        <div class="calc-divider" />
        <div class="calc-error">
          <span class="calc-error-icon">!</span>
          {{ tool.result || t("calculation_failed") }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.calc {
  margin: 2px 0;
}
.calc.running {
  animation: calcGlow 2s ease-in-out infinite;
}
.calc-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.calc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: calcPulse 1.2s ease-in-out infinite;
}
.calc-status {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 500;
}
.calc-display {
  background: color-mix(in srgb, var(--surface-bg) 60%, transparent);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
}
.calc.running .calc-display {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 6%, transparent);
}
.calc.success .calc-display {
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
}
.calc.error .calc-display {
  border-color: color-mix(in srgb, var(--error) 30%, transparent);
}
.calc-expression {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  word-break: break-all;
  min-height: 1.5em;
}
.calc-expression.long {
  font-size: 12px;
}
.calc-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--accent);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: calcBlink 0.9s step-end infinite;
}
.calc-divider {
  height: 1px;
  background: var(--border);
  margin: 10px 0;
}
.calc-result-wrap {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.calc-equals {
  font-size: 16px;
  color: var(--text-muted);
  font-weight: 300;
  flex-shrink: 0;
}
.calc-result {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-strong);
  line-height: 1.2;
  letter-spacing: -0.5px;
  word-break: break-all;
}
.calc-result.raw {
  font-size: 16px;
  font-weight: 400;
  color: var(--text-secondary);
  letter-spacing: 0;
}
.calc.success .calc-result {
  background: linear-gradient(
    135deg,
    var(--success) 0%,
    color-mix(in srgb, var(--success) 70%, var(--accent)) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.calc-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--error);
  line-height: 1.5;
}
.calc-error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--error) 15%, transparent);
  color: var(--error);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

@keyframes calcGlow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
@keyframes calcPulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
@keyframes calcBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
