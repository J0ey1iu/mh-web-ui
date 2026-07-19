<script setup lang="ts">
import { ref, watch, nextTick } from "vue"
import gsap from "gsap"
import type { SlashCommand } from "../types"
import { useI18nStore } from "../stores/i18n"

const props = defineProps<{
  visible: boolean
  commands: SlashCommand[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [command: SlashCommand]
  close: []
  "update:selectedIndex": [index: number]
}>()

const { t } = useI18nStore()
const panelRef = ref<HTMLDivElement | null>(null)

watch(() => props.selectedIndex, (idx) => {
  if (!panelRef.value) return
  const items = panelRef.value.querySelectorAll<HTMLDivElement>(".slash-item")
  items[idx]?.scrollIntoView({ block: "nearest" })
})

watch(() => props.visible, (show) => {
  if (show) {
    nextTick(() => {
      gsap.fromTo(panelRef.value,
        { opacity: 0, y: -8, scaleY: 0.95 },
        { opacity: 1, y: 0, scaleY: 1, duration: 0.15, ease: "power2.out" },
      )
    })
  }
})

function onClick(cmd: SlashCommand) {
  emit("select", cmd)
}
</script>

<template>
  <div
    v-if="visible && commands.length > 0"
    ref="panelRef"
    class="slash-panel"
  >
    <div class="slash-panel-header">{{ t("slash_commands") }}</div>
    <div
      v-for="(cmd, idx) in commands"
      :key="cmd.name"
      :class="['slash-item', { active: idx === selectedIndex }]"
      @click="onClick(cmd)"
      @mouseenter="$emit('update:selectedIndex', idx)"
    >
      <span class="slash-name">/{{ cmd.name }}</span>
      <span class="slash-desc">{{ cmd.displayName }}</span>
    </div>
  </div>
</template>

<style scoped>
.slash-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 4px;
  background: var(--surface-raised);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}
.slash-panel-header {
  padding: 6px 12px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--glass-border);
}
.slash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background var(--transition-duration);
}
.slash-item:hover,
.slash-item.active {
  background: var(--accent-dim);
}
.slash-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.slash-desc {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
