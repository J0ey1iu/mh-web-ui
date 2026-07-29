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

// used in Teleport template
FeedbackWidget && chatStore

const showFloating = ref(false)
const floatPos = ref({ x: 0, y: 0 })
let floatTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function onWrapperEnter(e: MouseEvent) {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  floatPos.value = { x: e.clientX, y: e.clientY }
  if (floatTimer) clearTimeout(floatTimer)
  floatTimer = setTimeout(() => { showFloating.value = true }, 500)
}

function onWrapperMousemove(e: MouseEvent) {
  // track latest position until popup is shown, then freeze
  if (!showFloating.value) {
    floatPos.value = { x: e.clientX, y: e.clientY }
  }
}

function onWrapperLeave() {
  if (floatTimer) clearTimeout(floatTimer)
  if (showFloating.value) {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { showFloating.value = false }, 300)
  }
}

function onPopupEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

function onPopupLeave() {
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
  <div class="tc-wrapper" @mouseenter="onWrapperEnter" @mousemove="onWrapperMousemove" @mouseleave="onWrapperLeave">
    <BaseToolCard v-if="component" :tool="tool">
      <component :is="component" :tool="tool" />
    </BaseToolCard>
    <ToolCallCard v-else :tool="tool" />
  </div>

  <Teleport to="body">
    <div
      v-if="showFloating && tool.status !== 'running'"
      class="fb-float"
      :style="{ left: floatPos.x + 12 + 'px', top: floatPos.y + 12 + 'px' }"
      @mouseenter="onPopupEnter"
      @mouseleave="onPopupLeave"
    >
      <FeedbackWidget
        :session-id="chatStore.currentSessionId ?? ''"
        target-type="tool_call"
        :target-id="tool.id"
      />
    </div>
  </Teleport>
</template>

<style scoped>
/* feedback uses Teleport floating popup */
</style>
