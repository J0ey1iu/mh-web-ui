<script lang="ts">
const handoffTimelineEvents = [
  { status: "in_progress", type: "handoff_started", message: "Delegating task to code_review" },
  { status: "in_progress", type: "llm_start", message: "Analyzing code changes..." },
  { status: "in_progress", type: "llm_end", message: "Analysis complete, generating review" },
  { status: "in_progress", type: "agent_end", message: "Agent finished processing" },
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
    { status: "in_progress", type: "handoff_started", message: "Delegating task to code_review" },
    { status: "in_progress", type: "llm_start", message: "Analyzing code changes..." },
    { status: "in_progress", type: "llm_end", message: "Generating review comments..." },
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

interface HandoffEvent {
  status: string
  type?: string
  message?: string
  result?: string
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
  return parseConcatenatedJson(props.tool.progress)
})

const stepLabels = computed<Record<string, string>>(() => ({
  handoff_started: t("step_handoff_started"),
  llm_start: t("step_llm_start"),
  llm_end: t("step_llm_end"),
  agent_end: t("step_agent_end"),
  handoff_complete: t("step_handoff_complete"),
}))

const stepClasses: Record<string, string> = {
  handoff_started: "step-delegate",
  llm_start: "step-llm",
  llm_end: "step-llm",
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
            <span class="event-label" :class="stepClasses[ev.type || ev.status]">
              {{ stepLabels[ev.type || ev.status] || ev.status }}
            </span>
            <span v-if="ev.message && !isLong(ev.message)" class="event-msg">{{ ev.message }}</span>
            <div v-else-if="ev.message" class="event-msg long">
              <span>{{ preview(ev.message) }}</span>
              <span class="fade-mask" />
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
