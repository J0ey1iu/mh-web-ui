<script setup lang="ts">
import { inject, computed } from "vue"
import { FOLDABLE_COLLAPSED_KEY } from "../toolContext"
import FoldableWrapper from "./FoldableWrapper.vue"
import { useI18nStore } from "../stores/i18n"

defineProps<{
  text: string
}>()

const { t } = useI18nStore()
const collapsed = inject(FOLDABLE_COLLAPSED_KEY, computed(() => false))
</script>

<template>
  <div class="reasoning-block">
    <FoldableWrapper :collapsed="collapsed">
      <template #header>
        <span class="reasoning-label">{{ t("reasoning") }}</span>
        <span class="reasoning-length">{{ text.length }} tokens</span>
      </template>
      <div class="reasoning-inner">{{ text }}</div>
    </FoldableWrapper>
  </div>
</template>

<style scoped>
.reasoning-block {
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-raised);
}
.reasoning-block :deep(.foldable-header) {
  padding: 6px 10px;
  width: 100%;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
}
.reasoning-block :deep(.foldable-header:hover) {
  background: var(--border);
}
.reasoning-label {
  font-weight: 600;
  color: var(--text-tertiary);
}
.reasoning-length {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}
.reasoning-inner {
  padding: 6px 10px 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-tertiary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
