<script lang="ts">
const handoffTimelineEvents = [
  { status: "handoff_started", type: "handoff_started", message: "Delegating task to code_review", target_agent: "code_review", task: "Review the latest PR changes", context: "PR #42: refactor auth module" },
  { status: "progress", type: "agent_start", message: "Agent started processing the delegated task" },
  { status: "progress", type: "llm_start", message: "Analyzing code changes...", tool_count: 3, message_count: 6 },
  { status: "progress", type: "llm_generating", message: "Generating...", content: "I'll review the code changes in PR #42. Let me start by reading the modified files to understand what was changed...", char_count: 120 },
  { status: "progress", type: "llm_end", message: "Analysis complete, generating review", tool_calls: ["read_file", "search_code"], usage: { prompt_tokens: 1200, completion_tokens: 80, total_tokens: 1280 } },
  { status: "progress", type: "execution_start", message: "Executing: read_file, search_code", tools: [{ name: "read_file", args: '{"path":"src/auth.ts"}' }, { name: "search_code", args: '{"query":"validateToken"}' }] },
  { status: "progress", type: "tool_start", message: "Tool started: read_file", tool_name: "read_file", tool_args: '{"path":"src/auth.ts"}' },
  { status: "progress", type: "tool_end", message: "Tool read_file completed: function validateToken...", tool_name: "read_file", tool_result: "function validateToken(token: string): boolean { return token.length > 0 }", is_error: false },
  { status: "progress", type: "tool_start", message: "Tool started: search_code", tool_name: "search_code", tool_args: '{"query":"validateToken"}' },
  { status: "progress", type: "tool_end", message: "Tool search_code completed: Found 3 references...", tool_name: "search_code", tool_result: "Found 3 references in auth.ts, middleware.ts, api.ts", is_error: false },
  { status: "progress", type: "execution_end", message: "read_file => function validate... | search_code => Found 3 references...", results: [{ name: "read_file", result: "function validateToken(token: string): boolean..." }, { name: "search_code", result: "Found 3 references in auth.ts, middleware.ts, api.ts" }] },
  { status: "progress", type: "agent_end", message: "Code review completed: 3 issues found", time_taken: 4.2, exceeded: false, interrupted: false },
  { status: "handoff_complete", type: "handoff_complete", message: "Handoff complete" },
].map((e) => JSON.stringify(e)).join("")

export const demoMock = {
  status: "success",
  progress: handoffTimelineEvents,
  result: JSON.stringify({ result: "Code review completed: 3 issues found, 2 suggestions made", message: "All checks passed" }),
}

export const demoMockRunning = {
  status: "running",
  progress: [
    { status: "handoff_started", type: "handoff_started", message: "Delegating task to code_review", target_agent: "code_review", task: "Review the latest PR changes" },
    { status: "progress", type: "agent_start", message: "Agent started processing the delegated task" },
    { status: "progress", type: "llm_start", message: "Analyzing code changes...", tool_count: 3, message_count: 6 },
    { status: "progress", type: "llm_generating", message: "Generating...", content: "I'll review the code changes in PR #42. Let me start by reading the modified files to understand what was changed...", char_count: 120 },
    { status: "progress", type: "llm_end", message: "Generating review comments...", tool_calls: ["read_file", "search_code"], usage: { prompt_tokens: 1200, completion_tokens: 80, total_tokens: 1280 } },
    { status: "progress", type: "execution_start", message: "Executing: read_file, search_code", tools: [{ name: "read_file", args: '{"path":"src/auth.ts"}' }, { name: "search_code", args: '{"query":"validateToken"}' }] },
    { status: "progress", type: "tool_start", message: "Tool started: read_file", tool_name: "read_file", tool_args: '{"path":"src/auth.ts"}' },
  ].map((e) => JSON.stringify(e)).join(""),
  result: "",
}

export const demoMockError = {
  status: "error",
  progress: "",
  result: "Handoff failed: target agent not available",
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface ToolInfo {
  name: string
  args: string
}

interface ResultInfo {
  name: string
  result: string
}

interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface HandoffEvent {
  status: string
  type?: string
  message?: string
  target_agent?: string
  task?: string
  context?: string
  tool_count?: number
  message_count?: number
  tool_calls?: string[]
  reasoning?: string
  usage?: TokenUsage
  tools?: ToolInfo[]
  results?: ResultInfo[]
  tool_name?: string
  tool_args?: string
  tool_result?: string
  is_error?: boolean
  time_taken?: number
  exceeded?: boolean
  interrupted?: boolean
  error?: string
  result?: string
  content?: string
  char_count?: number
}

function parseConcatenatedJson(raw: string): HandoffEvent[] {
  const events: HandoffEvent[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === "{") {
      if (depth === 0) start = i
      depth++
    } else if (ch === "}") {
      depth--
      if (depth === 0 && start !== -1) {
        try {
          events.push(JSON.parse(raw.slice(start, i + 1)))
        } catch {}
        start = -1
      }
    }
  }
  return events
}

const progressEvents = computed<HandoffEvent[]>(() => {
  if (!props.tool.progress) return []
  const raw = parseConcatenatedJson(props.tool.progress)
  return deduplicateEvents(raw)
})

const COLLAPSIBLE_TYPES = new Set(["llm_generating"])

function deduplicateEvents(events: HandoffEvent[]): HandoffEvent[] {
  const result: HandoffEvent[] = []
  for (const ev of events) {
    const t = ev.type || ""
    if (
      COLLAPSIBLE_TYPES.has(t) &&
      result.length > 0 &&
      result[result.length - 1].type === t
    ) {
      result[result.length - 1] = ev
    } else {
      result.push(ev)
    }
  }
  return result
}

const stepLabels = computed<Record<string, string>>(() => ({
  handoff_started: t("step_handoff_started"),
  agent_start: t("step_agent_start"),
  llm_start: t("step_llm_start"),
  llm_generating: t("step_llm_generating"),
  llm_end: t("step_llm_end"),
  execution_start: t("step_execution_start"),
  execution_end: t("step_execution_end"),
  tool_start: t("step_tool_start"),
  tool_end: t("step_tool_end"),
  agent_end: t("step_agent_end"),
  handoff_complete: t("step_handoff_complete"),
  interrupted: t("step_unknown"),
}))

const stepClasses: Record<string, string> = {
  handoff_started: "step-delegate",
  agent_start: "step-agent",
  llm_start: "step-llm",
  llm_generating: "step-llm",
  llm_end: "step-llm",
  execution_start: "step-exec",
  execution_end: "step-exec",
  tool_start: "step-tool",
  tool_end: "step-tool",
  agent_end: "step-agent",
  handoff_complete: "step-complete",
}

const PREVIEW_MAX = 200

function isLong(text: string | undefined): boolean {
  return !!text && text.length > PREVIEW_MAX
}

function preview(text: string): string {
  return text.length > PREVIEW_MAX ? text.slice(0, PREVIEW_MAX) + "..." : text
}

const finalResult = computed(() => {
  if (!props.tool.result) return ""
  try {
    const parsed = JSON.parse(props.tool.result)
    return parsed.result || parsed.message || props.tool.result
  } catch {
    return props.tool.result
  }
})

function formatTime(seconds: number | undefined): string {
  if (seconds == null) return ""
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}${t("seconds")}`
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(0)
  return `${m}m${s}${t("seconds")}`
}

function formatTokenUsage(usage: TokenUsage | undefined): string {
  if (!usage) return ""
  return `${usage.prompt_tokens}+${usage.completion_tokens}=${usage.total_tokens}`
}

function hasDetails(ev: HandoffEvent): boolean {
  return !!(
    ev.target_agent ||
    ev.task ||
    ev.tool_count != null ||
    ev.tool_calls?.length ||
    ev.reasoning ||
    ev.usage ||
    ev.tools?.length ||
    ev.results?.length ||
    ev.tool_name ||
    ev.tool_result ||
    ev.time_taken != null ||
    ev.exceeded ||
    ev.interrupted ||
    ev.error ||
    ev.is_error ||
    ev.content ||
    ev.char_count != null
  )
}

function truncateArgs(args: string): string {
  try {
    const parsed = JSON.parse(args)
    const str = JSON.stringify(parsed)
    return str.length > 150 ? str.slice(0, 150) + "..." : str
  } catch {
    return args.length > 150 ? args.slice(0, 150) + "..." : args
  }
}
</script>

<template>
  <div v-if="tool.status === 'error'" class="tool-result">{{ tool.result }}</div>
  <template v-else>
    <div class="handoff-events">
      <div>
        <div v-for="(ev, i) in progressEvents" :key="i" class="event-row">
          <div class="event-dot-wrapper">
            <span
              class="event-dot"
              :class="{
                running: tool.status === 'running' && i === progressEvents.length - 1,
                done: tool.status === 'success' || i < progressEvents.length - 1,
              }"
            />
            <span v-if="i < progressEvents.length - 1" class="event-line" />
          </div>
          <div class="event-body">
            <div class="event-header">
              <span class="event-label" :class="stepClasses[ev.type || ev.status]">
                {{ stepLabels[ev.type || ev.status] || ev.status }}
              </span>
              <span v-if="ev.time_taken != null" class="event-meta-tag">{{ formatTime(ev.time_taken) }}</span>
              <span v-if="ev.usage" class="event-meta-tag usage">{{ formatTokenUsage(ev.usage) }} tokens</span>
              <span v-if="ev.exceeded" class="event-meta-tag warn">{{ t("exceeded") }}</span>
              <span v-if="ev.interrupted" class="event-meta-tag warn">{{ t("interrupted") }}</span>
              <span v-if="ev.is_error" class="event-meta-tag error">{{ t("error") }}</span>
              <span v-if="ev.error && !ev.is_error" class="event-meta-tag error">{{ ev.error }}</span>
            </div>
            <span v-if="ev.message && !isLong(ev.message)" class="event-msg">{{ ev.message }}</span>
            <div v-else-if="ev.message" class="event-msg long">
              <span>{{ preview(ev.message) }}</span>
              <span class="fade-mask" />
            </div>
            <div v-if="hasDetails(ev)" class="event-details">
              <div v-if="ev.content && ev.type === 'llm_generating'" class="detail-block llm-stream">
                <pre class="detail-pre streaming">{{ ev.content }}</pre>
                <span class="stream-cursor" />
              </div>
              <div v-if="ev.reasoning" class="detail-block">
                <div class="detail-block-title">{{ t("reasoning") }}</div>
                <pre class="detail-pre">{{ ev.reasoning }}</pre>
              </div>
              <div v-if="ev.target_agent" class="detail-row">
                <span class="detail-key">{{ t("target_agent") }}</span>
                <span class="detail-val">{{ ev.target_agent }}</span>
              </div>
              <div v-if="ev.task" class="detail-row">
                <span class="detail-key">{{ t("task") }}</span>
                <span class="detail-val">{{ preview(ev.task) }}</span>
              </div>
              <div v-if="ev.tool_count != null" class="detail-row">
                <span class="detail-key">{{ t("tool_count") }}</span>
                <span class="detail-val">{{ ev.tool_count }}</span>
                <span v-if="ev.message_count != null" class="detail-sep">|</span>
                <span v-if="ev.message_count != null" class="detail-key">{{ t("message_count") }}</span>
                <span v-if="ev.message_count != null" class="detail-val">{{ ev.message_count }}</span>
              </div>
              <div v-if="ev.tool_calls && ev.tool_calls.length" class="detail-row">
                <span class="detail-key">{{ t("tool_calls") }}</span>
                <span class="detail-val">{{ ev.tool_calls.join(", ") }}</span>
              </div>
              <div v-if="ev.tools && ev.tools.length" class="detail-block">
                <div class="detail-block-title">{{ t("tools_list") }}</div>
                <div v-for="(t, ti) in ev.tools" :key="ti" class="detail-sub-row">
                  <code class="detail-code name">{{ t.name }}</code>
                  <code v-if="t.args && t.args !== '{}'" class="detail-code args">{{ truncateArgs(t.args) }}</code>
                </div>
              </div>
              <div v-if="ev.tool_name && !ev.tools" class="detail-row">
                <span class="detail-key">{{ t("tool_args") }}</span>
                <code v-if="ev.tool_args && ev.tool_args !== '{}'" class="detail-code">{{ truncateArgs(ev.tool_args) }}</code>
              </div>
              <div v-if="ev.tool_result" class="detail-block">
                <div class="detail-block-title">{{ t("tool_result") }}</div>
                <pre class="detail-pre">{{ ev.tool_result }}</pre>
              </div>
              <div v-if="ev.results && ev.results.length" class="detail-block">
                <div class="detail-block-title">{{ t("results") }}</div>
                <div v-for="(r, ri) in ev.results" :key="ri" class="detail-sub-row">
                  <code class="detail-code name">{{ r.name }}</code>
                  <pre class="detail-pre inline">{{ preview(r.result) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tool.status === 'success' && finalResult" class="handoff-result">
      <div class="result-header">
        <span class="result-icon">✓</span>
        <span class="result-title">{{ t("result") }}</span>
      </div>
      <pre class="tool-result">{{ finalResult }}</pre>
    </div>
  </template>
</template>

<style scoped>
.handoff-events {
  margin-top: 4px;
}
.event-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.event-dot-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 12px;
  min-height: 28px;
}
.event-dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-hover);
  flex-shrink: 0;
  margin-top: 5px;
  transition: background var(--transition-duration) ease;
}
.event-dot.running {
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  animation: pulseDot 1.6s ease-in-out infinite;
}
.event-dot.done {
  background: var(--success);
}
.event-line {
  width: 1.5px;
  flex: 1;
  background: var(--border);
  min-height: 16px;
  margin-top: 4px;
  opacity: 0.6;
}
.event-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 8px;
  padding-top: 2px;
  flex: 1;
}
.event-label {
  display: inline-flex;
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 1px 6px;
  border-radius: 4px;
  margin-bottom: 3px;
  line-height: 1.4;
  color: var(--text-primary);
  background: var(--surface-raised);
  border: 1px solid var(--border);
}
.event-label.step-delegate {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 20%, transparent);
}
.event-label.step-llm {
  color: var(--text-tertiary);
  background: color-mix(in srgb, var(--text-tertiary) 10%, transparent);
  border-color: color-mix(in srgb, var(--text-tertiary) 20%, transparent);
}
.event-label.step-agent {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border-color: color-mix(in srgb, var(--success) 20%, transparent);
}
.event-label.step-complete {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border-color: color-mix(in srgb, var(--success) 20%, transparent);
}
.event-label.step-exec {
  color: var(--warning, #d97706);
  background: color-mix(in srgb, var(--warning, #d97706) 10%, transparent);
  border-color: color-mix(in srgb, var(--warning, #d97706) 20%, transparent);
}
.event-label.step-tool {
  color: var(--info, #7c3aed);
  background: color-mix(in srgb, var(--info, #7c3aed) 10%, transparent);
  border-color: color-mix(in srgb, var(--info, #7c3aed) 20%, transparent);
}
.event-header {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 3px;
}
.event-meta-tag {
  font-size: 10px;
  font-weight: 500;
  padding: 0 4px;
  border-radius: 3px;
  color: var(--text-tertiary);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  line-height: 1.5;
  white-space: nowrap;
}
.event-meta-tag.usage {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 18%, transparent);
}
.event-meta-tag.warn {
  color: var(--warning, #d97706);
  background: color-mix(in srgb, var(--warning, #d97706) 10%, transparent);
  border-color: color-mix(in srgb, var(--warning, #d97706) 20%, transparent);
}
.event-meta-tag.error {
  color: var(--danger, #dc2626);
  background: color-mix(in srgb, var(--danger, #dc2626) 10%, transparent);
  border-color: color-mix(in srgb, var(--danger, #dc2626) 20%, transparent);
}
.event-msg {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.45;
  word-break: break-word;
}
.event-msg.long {
  position: relative;
}
.fade-mask {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 18px;
  background: linear-gradient(transparent, var(--surface-alt));
  pointer-events: none;
}
.event-details {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.detail-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 11px;
}
.detail-key {
  color: var(--text-tertiary);
  font-weight: 500;
}
.detail-val {
  color: var(--text-secondary);
}
.detail-sep {
  color: var(--border-hover);
  margin: 0 2px;
}
.detail-block {
  margin-top: 2px;
  padding: 4px 6px;
  background: var(--surface-alt);
  border-radius: 4px;
  border: 1px solid var(--border);
}
.detail-block-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 3px;
}
.detail-sub-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 2px;
}
.detail-code {
  font-size: 10.5px;
  font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace;
  background: var(--surface-raised);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  word-break: break-all;
  line-height: 1.45;
}
.detail-code.name {
  color: var(--accent);
  font-weight: 600;
  flex-shrink: 0;
}
.detail-code.args {
  color: var(--text-tertiary);
}
.detail-pre {
  font-size: 10.5px;
  font-family: "SF Mono", "Cascadia Code", "JetBrains Mono", ui-monospace, monospace;
  color: var(--text-secondary);
  margin: 2px 0 0;
  padding: 3px 5px;
  background: var(--surface-raised);
  border-radius: 3px;
  border: 1px solid var(--border);
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.45;
  max-height: 120px;
  overflow-y: auto;
}
.detail-pre.inline {
  margin: 0;
  flex: 1;
  min-width: 0;
}
.detail-pre.streaming {
  max-height: 200px;
  color: var(--text-primary);
}
.llm-stream {
  position: relative;
}
.stream-cursor {
  display: inline-block;
  width: 6px;
  height: 12px;
  background: var(--accent);
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: blinkCursor 0.8s step-end infinite;
}
@keyframes blinkCursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.handoff-result {
  margin-top: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-raised);
  padding: 8px 10px;
  transition: border-color var(--transition-duration);
}
.handoff-result:hover {
  border-color: var(--border-hover);
}
.result-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.result-icon {
  font-size: 12px;
  color: var(--success);
}
.result-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: var(--success);
  text-transform: uppercase;
}
pre {
  margin: 0;
}

@keyframes pulseDot {
  0%, 100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 8%, transparent);
    transform: scale(1.15);
  }
}


</style>
