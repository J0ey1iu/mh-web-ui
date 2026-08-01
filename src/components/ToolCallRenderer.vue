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
import { useChatStore } from "../stores/chat"

const props = defineProps<ToolCallComponentProps>()
const chatStore = useChatStore()

const i18nStore = useI18nStore()
provide(I18N_KEY, { locale: computed(() => i18nStore.locale) })

const renderError = ref<string | null>(null)
const component = shallowRef<Component | null>(null)

const toolHovered = ref(false)

const statusIcon = computed(() => {
  switch (props.tool.status) {
    case "running": return "\u2699"
    case "success": return "\u2713"
    case "error": return "\u2717"
  }
})

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
  <div class="tc-wrapper" @mouseenter="toolHovered = true" @mouseleave="toolHovered = false">
    <BaseToolCard :tool="tool">
      <template #header>
        <div class="tool-header-left">
          <span class="tool-icon">{{ statusIcon }}</span>
          <span class="tool-name">{{ (tool as any).displayName || tool.name }}</span>
          <span v-if="tool.status === 'running'" class="tool-spinner" />
        </div>
      </template>
      <component v-if="component" :is="component" :tool="tool" />
      <template v-else>
        <div v-if="tool.progress" class="tool-progress">{{ tool.progress }}</div>
        <div v-if="tool.result" class="tool-result">{{ tool.result }}</div>
      </template>
      <div
        v-show="toolHovered && tool.status !== 'running'"
        class="fb-footer-wrap"
      >
        <FeedbackWidget
          :session-id="chatStore.currentSessionId ?? ''"
          target-type="tool_call"
          :target-id="tool.id"
          :existing-feedback-type="(chatStore.feedbackState[`tool_call:${props.tool.id}`]?.feedback_type as 'thumbs_up' | 'thumbs_down' | undefined)"
          :existing-feedback-id="chatStore.feedbackState[`tool_call:${props.tool.id}`]?.feedback_id"
        />
      </div>
    </BaseToolCard>
  </div>
</template>

<style>
.tc-wrapper .tool-header {
  flex: 1;
}
</style>

<style scoped>
.tool-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.fb-footer-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

.fb-footer-wrap .feedback-widget {
  margin-top: 0;
}
</style>
