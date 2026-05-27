<script setup lang="ts">
import { computed, inject } from "vue"
import type { ToolCallComponentProps } from "../types"
import { FOLDABLE_COLLAPSED_KEY } from "../toolContext"
import { isToolAutoCollapsible } from "../toolCallRegistry"
import FoldableWrapper from "./FoldableWrapper.vue"

const props = defineProps<ToolCallComponentProps>()

const collapsed = inject(FOLDABLE_COLLAPSED_KEY, computed(() => false))
const effectiveCollapsed = computed(() => {
  return isToolAutoCollapsible(props.tool.name) ? collapsed.value : false
})

const statusIcon = computed(() => {
  switch (props.tool.status) {
    case "running": return "\u2699"
    case "success": return "\u2713"
    case "error": return "\u2717"
  }
})
</script>

<template>
  <div :class="['tool-card', tool.status]">
    <FoldableWrapper :collapsed="effectiveCollapsed">
      <template #header>
        <div class="tool-header">
          <slot name="header">
            <span class="tool-icon">{{ statusIcon }}</span>
            <span class="tool-name">{{ (tool as any).displayName || tool.name }}</span>
            <span v-if="tool.status === 'running'" class="tool-spinner" />
          </slot>
        </div>
      </template>
      <slot />
    </FoldableWrapper>
  </div>
</template>

<style>
.tool-card {
  margin: 4px 0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  background: var(--surface-alt);
  border: 1px solid var(--border);
}
.tool-card.running {
  border-color: var(--accent);
}
.tool-card.success {
  border-color: var(--success);
}
.tool-card.error {
  border-color: var(--error);
}
.tool-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tool-icon {
  font-size: 14px;
}
.tool-name {
  font-weight: 600;
  font-family: monospace;
}
.tool-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.tool-progress {
  margin-top: 4px;
  color: var(--text-secondary);
  font-family: monospace;
  font-size: 12px;
}
.tool-result {
  margin-top: 4px;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
</style>
