<script setup lang="ts">
import type { AgentInfo, ScenarioInfo } from "../types"
import { useI18nStore } from "../stores/i18n"

defineProps<{
  scenario: ScenarioInfo | null
  agents: AgentInfo[]
}>()

const emit = defineEmits<{
  select: [agentName: string]
}>()

const { t } = useI18nStore()
</script>

<template>
  <div class="agent-selector">
    <div class="selector-header">
      <span class="scene-icon">{{ scenario?.icon }}</span>
      <h2>{{ scenario?.name ?? "Select Agent" }}</h2>
      <p class="scene-desc">{{ scenario?.description }}</p>
    </div>
    <div class="agent-list">
      <div
        v-for="agent in agents"
        :key="agent.name"
        class="agent-card"
        @click="emit('select', agent.name)"
      >
        <div class="agent-info">
          <h3 class="agent-name">{{ agent.display_name || agent.name }}</h3>
          <p class="agent-desc">{{ agent.description }}</p>
        </div>
        <div class="agent-tools">
          <span
            v-for="tool in agent.tools"
            :key="tool.name"
            class="tool-badge"
          >{{ tool.display_name || tool.name }}</span>
        </div>
      </div>
      <div v-if="agents.length === 0" class="empty-hint">
        {{ t("no_agents") }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-selector {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.selector-header {
  text-align: center;
}
.selector-header .scene-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 8px;
}
.selector-header h2 {
  margin: 0;
  font-size: 22px;
  color: var(--text-strong);
  font-weight: 600;
}
.scene-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.agent-card {
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: border-color var(--transition-duration), background var(--transition-duration), color var(--transition-duration);
}
.agent-card:hover {
  border-color: var(--accent);
  background: var(--surface-raised);
}
.agent-info {
  margin-bottom: 10px;
}
.agent-name {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: capitalize;
}
.agent-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.agent-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tool-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--accent-dim);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  font-family: monospace;
}
.empty-hint {
  text-align: center;
  color: var(--text-muted);
  padding: 32px;
  font-size: 14px;
}
</style>
