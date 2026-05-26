<script lang="ts">
export const demoMock = {
  status: "success" as const,
  progress: "",
  result: JSON.stringify({
    status: "ok",
    agents: [
      { name: "code_review", description: "Reviews code changes for bugs and style issues" },
      { name: "writing", description: "Improves and refines text content" },
      { name: "research", description: "Searches web and knowledge base for information" },
    ],
  }),
}

export const demoMockRunning = {
  status: "running" as const,
  progress: JSON.stringify({ message: "Searching for available agents..." }),
  result: "",
}

export const demoMockError = {
  status: "error" as const,
  progress: "",
  result: "Failed to discover agents: service unavailable",
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface Agent {
  name: string
  description: string
}

const agents = computed<Agent[]>(() => {
  if (!props.tool.result) return []
  try {
    const data = JSON.parse(props.tool.result)
    if (data?.status === "ok" && Array.isArray(data.agents)) return data.agents
  } catch {}
  return []
})

const PROGRESS_MAX = 200

function isLong(text: string | undefined): boolean {
  return !!text && text.length > PROGRESS_MAX
}

function preview(text: string): string {
  return text.length > PROGRESS_MAX ? text.slice(0, PROGRESS_MAX) + "..." : text
}
</script>

<template>
  <div v-if="tool.status === 'error'" class="tool-result">{{ tool.result }}</div>
  <template v-else>
    <!-- Running progress -->
    <template v-if="tool.progress">
      <span v-if="!isLong(tool.progress)" class="tool-progress">{{ preview(tool.progress) }}</span>
      <pre v-else class="tool-result">{{ preview(tool.progress) }}</pre>
    </template>

    <!-- Searching state -->
    <div v-if="tool.status === 'running' && !tool.progress" class="searching">
      <span class="search-dots">
        <span></span><span></span><span></span>
      </span>
      <span class="search-label">{{ t("discovering") }}</span>
    </div>

    <!-- Agent list -->
    <div v-if="agents.length" class="agents-list">
      <div class="count-badge">{{ t("agents_found", { count: agents.length }) }}</div>
      <div class="agent-rows">
        <div v-for="agent in agents" :key="agent.name" class="agent-row">
          <span class="agent-icon">🤖</span>
          <div class="agent-body">
            <span class="agent-name" :title="agent.name">{{ agent.name }}</span>
            <span v-if="agent.description" class="agent-desc" :title="agent.description">{{ agent.description }}</span>
            <span v-else class="agent-desc empty">{{ t("no_description") }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Fallback raw result -->
    <div v-else-if="tool.result" class="tool-result">{{ tool.result }}</div>
  </template>
</template>

<style scoped>
.searching {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.search-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.search-dots {
  display: inline-flex;
  gap: 3px;
}
.search-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: dotBounce 1.4s ease-in-out infinite both;
}
.search-dots span:nth-child(1) { animation-delay: -0.32s; }
.search-dots span:nth-child(2) { animation-delay: -0.16s; }
.search-dots span:nth-child(3) { animation-delay: 0s; }

@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.count-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.3px;
  margin-bottom: 8px;
}
.agents-list {
  margin-top: 8px;
}
.agent-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agent-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: border-color var(--transition-duration), background var(--transition-duration), color var(--transition-duration);
}
.agent-row:hover {
  border-color: var(--border-hover);
  background: color-mix(in srgb, var(--surface-raised) 95%, var(--accent));
}
.agent-icon {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1.4;
  margin-top: 1px;
}
.agent-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.agent-name {
  font-weight: 600;
  font-family: monospace;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.agent-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.agent-desc.empty {
  color: var(--text-muted);
  font-style: italic;
}
pre {
  margin: 0;
}


</style>
