<script setup lang="ts">
import { ref, shallowRef, watch, computed, provide, onMounted, onErrorCaptured } from "vue"
import type { Component } from "vue"
import type { ToolCallComponentProps } from "../types"
import { getRegisteredComponent, registryVersion } from "../toolCallRegistry"
import { ensureComponentsLoaded } from "../toolComponentLoader"
import { I18N_KEY } from "../toolContext"
import { useI18nStore } from "../stores/i18n"
import FeedbackWidget from "./FeedbackWidget.vue"
import BaseToolCard from "./BaseToolCard.vue"
import ToolCallCard from "./ToolCallCard.vue"
import { useChatStore } from "../stores/chat"

const props = defineProps<ToolCallComponentProps>()
const chatStore = useChatStore()

const i18nStore = useI18nStore()
provide(I18N_KEY, { locale: computed(() => i18nStore.locale) })

const renderError = ref<string | null>(null)
const component = shallowRef<Component | null>(null)

// used in template
FeedbackWidget && chatStore

const showFloating = ref(false)
const floatPos = ref({ x: 0, y: 0 })
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const floatStyle = computed(() => ({
  left: floatPos.value.x + 12 + "px",
  top: floatPos.value.y + 12 + "px",
}))

function onWrapperMouseover(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const related = e.relatedTarget as Node | null

  // just entered the wrapper from outside
  if (!related || !target.contains(related)) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
    if (!showFloating.value) {
      floatPos.value = { x: e.clientX, y: e.clientY }
    }
    if (showTimer) clearTimeout(showTimer)
    showTimer = setTimeout(() => { showFloating.value = true }, 500)
  }
  // update position while tracking, freeze once shown
  if (!showFloating.value) {
    floatPos.value = { x: e.clientX, y: e.clientY }
  }
}

function onWrapperMouseout(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const related = e.relatedTarget as Node | null

  // left the wrapper entirely (not just moved to a child)
  if (!related || !target.contains(related)) {
    if (showTimer) clearTimeout(showTimer)
    if (showFloating.value) {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => { showFloating.value = false }, 300)
    }
  }
}

function onPopupMouseenter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function onPopupMouseleave() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { showFloating.value = false }, 200)
}

function updateComponent() {
  if (renderError.value) {
    component.value = null
    return
  }
  component.value = getRegisteredComponent(props.tool.name) ?? null
}

watch(registryVersion, updateComponent, { immediate: true })
watch(renderError, updateComponent)

onMounted(async () => {
  if (component.value) return
  await ensureComponentsLoaded()
})

onErrorCaptured((err) => {
  renderError.value = String(err)
  return false
})
</script>

<template>
  <div
    class="tc-wrapper"
    @mouseover="onWrapperMouseover"
    @mouseout="onWrapperMouseout"
  >
    <BaseToolCard v-if="component" :tool="tool">
      <component :is="component" :tool="tool" />
    </BaseToolCard>
    <ToolCallCard v-else :tool="tool" />

    <div
      v-if="showFloating && tool.status !== 'running'"
      class="fb-float"
      :style="floatStyle"
      @mouseenter="onPopupMouseenter"
      @mouseleave="onPopupMouseleave"
    >
      <FeedbackWidget
        :session-id="chatStore.currentSessionId ?? ''"
        target-type="tool_call"
        :target-id="tool.id"
      />
    </div>
  </div>
</template>

<style scoped>
.fb-float {
  position: fixed;
  z-index: 500;
  pointer-events: auto;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 6px 8px;
  box-shadow: var(--glass-shadow);
}

.fb-float .feedback-widget {
  margin-top: 0;
}
</style>
