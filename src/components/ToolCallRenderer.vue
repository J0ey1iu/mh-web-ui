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
  <div class="tc-wrapper">
    <BaseToolCard v-if="component" :tool="tool">
      <component :is="component" :tool="tool" />
    </BaseToolCard>
    <ToolCallCard v-else :tool="tool" />
    <div class="feedback-hover">
      <FeedbackWidget
        v-if="tool.status !== 'running'"
        :session-id="chatStore.currentSessionId ?? ''"
        target-type="tool_call"
        :target-id="tool.id"
      />
    </div>
  </div>
</template>

<style scoped>
.tc-wrapper .feedback-hover {
  opacity: 0;
  height: 0;
  overflow: hidden;
  transition: opacity 0.25s ease, height 0.25s ease;
  transition-delay: 0.6s;
}

.tc-wrapper:hover .feedback-hover {
  opacity: 1;
  height: 36px;
  transition-delay: 0.1s;
}
</style>
