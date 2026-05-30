<script setup lang="ts">
import type { AgentInfo, ScenarioInfo } from "../types"
import { useI18nStore } from "../stores/i18n"
import SkeletonBlock from "./SkeletonBlock.vue"

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
      <template v-if="scenario">
        <span class="scene-icon">{{ scenario.icon }}</span>
        <h2>{{ scenario.name }}</h2>
        <p class="scene-desc">{{ scenario.description }}</p>
      </template>
      <template v-else>
        <SkeletonBlock variant="circle" width="48px" height="48px" />
        <div style="margin-top:12px"><SkeletonBlock width="60%" height="24px" /></div>
        <div style="margin-top:8px"><SkeletonBlock width="80%" height="14px" /></div>
      </template>
    </div>
    <div class="agent-list">
      <template v-if="agents.length > 0">
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
      </template>
      <template v-else>
        <div v-for="i in 2" :key="i" class="agent-card" style="pointer-events:none">
          <SkeletonBlock width="40%" height="18px" />
          <div style="margin:8px 0"><SkeletonBlock width="80%" height="13px" /></div>
          <div style="display:flex;gap:6px">
            <SkeletonBlock width="60px" height="20px" borderRadius="4px" />
            <SkeletonBlock width="80px" height="20px" borderRadius="4px" />
          </div>
        </div>
        <div class="empty-hint">{{ t("no_agents") }}</div>
      </template>
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
  gap: 10px;
}
.agent-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 18px;
  cursor: pointer;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: border-color var(--transition-duration), box-shadow var(--transition-duration), transform var(--transition-duration), backdrop-filter var(--transition-duration), -webkit-backdrop-filter var(--transition-duration);
}
.agent-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.agent-card:active {
  transform: translateY(0);
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
  border-radius: 6px;
  background: var(--glass-highlight);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  font-family: monospace;
}
.agent-card:hover .tool-badge {
  border-color: var(--accent);
}
.empty-hint {
  text-align: center;
  color: var(--text-muted);
  padding: 32px;
  font-size: 14px;
}
</style>
