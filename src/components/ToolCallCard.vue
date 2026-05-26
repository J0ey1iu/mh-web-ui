<script setup lang="ts">
import type { ToolCallComponentProps } from "../types"
import BaseToolCard from "./BaseToolCard.vue"

defineProps<ToolCallComponentProps>()
</script>

<template>
  <BaseToolCard :tool="tool">
    <div v-if="tool.progress" class="tool-progress">{{ tool.progress }}</div>
    <div v-if="tool.result" class="tool-result">{{ tool.result }}</div>
  </BaseToolCard>
</template>
