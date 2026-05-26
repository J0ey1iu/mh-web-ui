<script setup lang="ts">
import { ref, shallowRef, watch, computed, provide, onMounted, onErrorCaptured } from "vue"
import type { Component } from "vue"
import type { ToolCallComponentProps } from "../types"
import { getRegisteredComponent, registryVersion } from "../toolCallRegistry"
import { ensureComponentsLoaded } from "../toolComponentLoader"
import { I18N_KEY } from "../toolContext"
import { useI18nStore } from "../stores/i18n"
import BaseToolCard from "./BaseToolCard.vue"
import ToolCallCard from "./ToolCallCard.vue"

const props = defineProps<ToolCallComponentProps>()

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
  <BaseToolCard v-if="component" :tool="tool">
    <component :is="component" :tool="tool" />
  </BaseToolCard>
  <ToolCallCard v-else :tool="tool" />
</template>
