<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue"

const props = defineProps<{
  collapsed?: boolean
  collapseDelay?: number
}>()

const emit = defineEmits<{
  toggle: []
}>()

const expanded = ref(!props.collapsed)
const wasEverExpanded = ref(!props.collapsed)
const body = ref<HTMLDivElement | null>(null)
let collapseTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.collapsed, (val) => {
  if (val && expanded.value) {
    if (wasEverExpanded.value && props.collapseDelay) {
      collapseTimer = setTimeout(() => doCollapse(), props.collapseDelay)
    } else {
      doCollapse()
    }
  } else if (!val && collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
})

onUnmounted(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
})

function toggle() {
  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
  if (expanded.value) doCollapse()
  else doExpand()
  emit("toggle")
}

onMounted(() => {
  if (expanded.value) {
    setBodyHeightAuto()
  } else {
    const el = body.value
    if (el) el.style.height = "0"
  }
})

function setBodyHeightAuto() {
  const el = body.value
  if (!el) return
  el.style.height = ""
}

function doExpand() {
  const el = body.value
  if (!el) return
  wasEverExpanded.value = true
  expanded.value = true
  el.style.height = "0"
  nextTick(() => {
    requestAnimationFrame(() => {
      el.style.height = el.scrollHeight + "px"
      el.addEventListener(
        "transitionend",
        () => {
          if (expanded.value) el.style.height = ""
        },
        { once: true },
      )
    })
  })
}

function doCollapse() {
  const el = body.value
  if (!el) return
  if (el.style.height === "" || el.style.height === "auto") {
    el.style.height = el.scrollHeight + "px"
  }
  expanded.value = false
  requestAnimationFrame(() => {
    el.style.height = "0"
  })
}

defineExpose({ toggle })
</script>

<template>
  <div class="foldable">
    <div class="foldable-header" @click="toggle">
      <span class="chevron" :class="{ expanded }">▶</span>
      <slot name="header" />
    </div>
    <div ref="body" class="foldable-body">
      <div class="foldable-inner">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.foldable-header {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.chevron {
  font-size: 10px;
  transition: transform var(--transition-duration);
  flex-shrink: 0;
  color: var(--text-muted);
}
.chevron.expanded {
  transform: rotate(90deg);
}
.foldable-body {
  overflow: hidden;
  transition: height var(--transition-duration) ease;
}
.foldable-inner {
  overflow: hidden;
}
</style>
