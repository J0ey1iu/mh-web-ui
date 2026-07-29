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
  <BaseToolCard :tool="tool">
    <template #header>
      <span class="tool-icon">{{ statusIcon }}</span>
      <span class="tool-name">{{ (tool as any).displayName || tool.name }}</span>
      <span v-if="tool.status === 'running'" class="tool-spinner" />
      <span class="header-spacer"></span>
      <FeedbackWidget
        v-if="tool.status !== 'running'"
        :session-id="chatStore.currentSessionId ?? ''"
        target-type="tool_call"
        :target-id="tool.id"
      />
    </template>
    <component v-if="component" :is="component" :tool="tool" />
    <template v-else>
      <div v-if="tool.progress" class="tool-progress">{{ tool.progress }}</div>
      <div v-if="tool.result" class="tool-result">{{ tool.result }}</div>
    </template>
  </BaseToolCard>
</template>

<style scoped>
.header-spacer {
  flex: 1;
}

.tool-header .feedback-widget {
  margin-top: 0;
}
</style>
