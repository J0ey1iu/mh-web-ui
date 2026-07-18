<script lang="ts">
export const demoMock = {
  status: "success" as const,
  progress: JSON.stringify({ message: "Executing command on Windows (PowerShell): echo Hello World" }),
  result: JSON.stringify({
    status: "ok",
    message: "Command completed successfully (1 line of output)",
    stdout: "Hello World\n",
    stderr: "",
    exit_code: 0,
    command: "echo Hello World",
  }),
}

export const demoMockRunning = {
  status: "running" as const,
  progress: JSON.stringify({ message: "Executing command on Unix (bash): find / -name '*.log' 2>/dev/null | head -20" }),
  result: "",
}

export const demoMockStreaming = {
  status: "running" as const,
  progress: JSON.stringify({
    status: "progress",
    type: "stream",
    stream: "stdout",
    content: "Hello World iteration 3",
    partial_stdout: "Hello World iteration 1\nHello World iteration 2\nHello World iteration 3\n",
    partial_stderr: "",
  }),
  result: "",
}

export const demoMockError = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({
    status: "error",
    message: "Command exited with code 127. Check stderr for error details.",
    stdout: "",
    stderr: "bash: somecommand: command not found\n",
    exit_code: 127,
    command: "somecommand",
    suggestion: "Review stderr output and fix the command",
  }),
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface BashResult {
  status: string
  message?: string
  stdout?: string
  stderr?: string
  exit_code?: number
  command?: string
  suggestion?: string
  timed_out?: boolean
}

interface StreamProgress {
  status: string
  type: string
  stream?: string
  content?: string
  partial_stdout?: string
  partial_stderr?: string
  message?: string
}

const parsedResult = computed<BashResult | null>(() => {
  if (!props.tool.result) return null
  try {
    return JSON.parse(props.tool.result) as BashResult
  } catch {
    return null
  }
})

function extractLastJson(raw: string): Record<string, unknown> | null {
  const close = raw.lastIndexOf("}")
  if (close < 0) return null
  const open = raw.lastIndexOf("{", close)
  if (open < 0) return null
  try {
    return JSON.parse(raw.substring(open, close + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

const parsedProgress = computed<StreamProgress | null>(() => {
  if (!props.tool.progress) return null
  const obj = extractLastJson(props.tool.progress)
  if (!obj) return null
  return obj as unknown as StreamProgress
})

const isStreaming = computed(() => {
  const p = parsedProgress.value
  return p?.type === "stream" && (!!p.partial_stdout || !!p.partial_stderr)
})

const initialMessage = computed(() => {
  const p = parsedProgress.value
  if (!p) return null
  if (p.type === "stream") return null
  return p.message ?? null
})

const liveStdout = computed(() => {
  const p = parsedProgress.value
  if (p?.partial_stdout) return p.partial_stdout
  return ""
})

const liveStderr = computed(() => {
  const p = parsedProgress.value
  if (p?.partial_stderr) return p.partial_stderr
  return ""
})

const hasStdout = computed(() => {
  const s = parsedResult.value?.stdout
  return s !== undefined && s !== null && s !== ""
})

const hasStderr = computed(() => {
  const s = parsedResult.value?.stderr
  return s !== undefined && s !== null && s !== ""
})

const isError = computed(() => {
  if (props.tool.status === "error") return true
  if (parsedResult.value?.status === "error") return true
  if (parsedResult.value?.exit_code && parsedResult.value.exit_code !== 0) return true
  return false
})
</script>

<template>
  <div class="bsh" :class="{ running: tool.status === 'running', success: tool.status === 'success' && !isError, error: tool.status === 'error' || isError }">
    <!-- Running state with streaming output -->
    <template v-if="tool.status === 'running'">
      <div class="bsh-card bsh-streaming-card">
        <div class="bsh-loading">
          <span class="bsh-spinner" />
          <span class="bsh-status-label">{{ t("executing") }}</span>
        </div>

        <!-- Show initial message if no stream yet -->
        <div v-if="initialMessage && !isStreaming" class="bsh-command-preview">{{ initialMessage }}</div>

        <!-- Live stdout -->
        <div v-if="liveStdout" class="bsh-section">
          <div class="bsh-section-label">{{ t("stdout") }}</div>
          <pre class="bsh-output bsh-stdout bsh-streaming-output"><code>{{ liveStdout }}</code></pre>
        </div>

        <!-- Live stderr -->
        <div v-if="liveStderr" class="bsh-section">
          <div class="bsh-section-label bsh-stderr-label">{{ t("stderr") }}</div>
          <pre class="bsh-output bsh-stderr bsh-streaming-output"><code>{{ liveStderr }}</code></pre>
        </div>
      </div>
    </template>

    <!-- Result state -->
    <template v-else-if="parsedResult">
      <div class="bsh-card">
        <!-- Header: command + exit code -->
        <div class="bsh-header">
          <div class="bsh-command-line">
            <span class="bsh-prompt">$</span>
            <span class="bsh-command-text">{{ parsedResult.command || "?" }}</span>
          </div>
          <div v-if="parsedResult.exit_code !== undefined" class="bsh-exit-badge" :class="{ zero: parsedResult.exit_code === 0, nonZero: parsedResult.exit_code !== 0 }">
            {{ t("exit_code") }}: {{ parsedResult.exit_code }}
          </div>
        </div>

        <!-- Timed out -->
        <div v-if="parsedResult.timed_out" class="bsh-timed-out">
          {{ parsedResult.message || t("timed_out") }}
        </div>

        <!-- stdout -->
        <div v-if="hasStdout" class="bsh-section">
          <div class="bsh-section-label">{{ t("stdout") }}</div>
          <pre class="bsh-output bsh-stdout"><code>{{ parsedResult.stdout }}</code></pre>
        </div>

        <!-- stderr -->
        <div v-if="hasStderr" class="bsh-section">
          <div class="bsh-section-label bsh-stderr-label">{{ t("stderr") }}</div>
          <pre class="bsh-output bsh-stderr"><code>{{ parsedResult.stderr }}</code></pre>
        </div>

        <!-- Status message -->
        <div v-if="parsedResult.message && !parsedResult.timed_out" class="bsh-message" :class="{ error: isError }">
          {{ parsedResult.message }}
        </div>

        <!-- Suggestion -->
        <div v-if="parsedResult.suggestion" class="bsh-suggestion">
          <span class="bsh-suggestion-icon">?</span>
          <span><strong>{{ t("suggestion") }}:</strong> {{ parsedResult.suggestion }}</span>
        </div>
      </div>
    </template>

    <!-- Error without parsed result -->
    <template v-else-if="tool.status === 'error'">
      <div class="bsh-card bsh-card-error">
        <div class="bsh-error-msg">{{ tool.result || t("shell_not_found") }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bsh { margin: 2px 0; }
.bsh-loading { display: flex; align-items: center; gap: 8px; padding: 0 0 8px; }
.bsh-spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: bshSpin 0.8s linear infinite; flex-shrink: 0; }
.bsh-status-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
.bsh-command-preview { font-size: 11px; color: var(--text-tertiary); font-family: "SF Mono", "Fira Code", monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0 4px; }
.bsh-card { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; background: color-mix(in srgb, var(--surface-bg) 60%, transparent); }
.bsh-streaming-card { border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.bsh.success .bsh-card { border-color: color-mix(in srgb, var(--success) 30%, transparent); }
.bsh.error .bsh-card,
.bsh-card-error { border-color: color-mix(in srgb, var(--error) 30%, transparent); }
.bsh-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.bsh-command-line { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
.bsh-prompt { font-family: "SF Mono", "Fira Code", monospace; font-size: 13px; color: var(--success); font-weight: 600; flex-shrink: 0; }
.bsh-command-text { font-family: "SF Mono", "Fira Code", monospace; font-size: 13px; color: var(--text-primary); word-break: break-all; }
.bsh-exit-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; flex-shrink: 0; white-space: nowrap; }
.bsh-exit-badge.zero { background: color-mix(in srgb, var(--success) 12%, transparent); color: var(--success); }
.bsh-exit-badge.nonZero { background: color-mix(in srgb, var(--error) 12%, transparent); color: var(--error); }
.bsh-timed-out { font-size: 13px; color: var(--error); padding: 6px 0; }
.bsh-section { margin-bottom: 8px; }
.bsh-section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
.bsh-stderr-label { color: var(--error); }
.bsh-output { margin: 0; padding: 8px 10px; border-radius: 6px; font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; max-height: 240px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.bsh-streaming-output { animation: bshFadeIn 0.15s ease; }
.bsh-stdout { background: color-mix(in srgb, var(--surface-bg) 40%, transparent); border: 1px solid var(--border); color: var(--text-primary); }
.bsh-stderr { background: color-mix(in srgb, var(--error) 6%, transparent); border: 1px solid color-mix(in srgb, var(--error) 20%, transparent); color: var(--error); }
.bsh-message { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.bsh-message.error { color: var(--error); }
.bsh-suggestion { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; padding: 6px 8px; background: color-mix(in srgb, var(--accent) 6%, transparent); border-radius: 6px; font-size: 12px; color: var(--text-secondary); line-height: 1.4; }
.bsh-suggestion-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
.bsh-error-msg { font-size: 13px; color: var(--error); padding: 4px 0; }
@keyframes bshSpin { to { transform: rotate(360deg); } }
@keyframes bshFadeIn { from { opacity: 0.6; } to { opacity: 1; } }
</style>
