<script setup lang="ts">
withDefaults(defineProps<{
  width?: string
  height?: string
  borderRadius?: string
  variant?: 'text' | 'circle'
}>(), {
  variant: 'text',
  width: '100%',
  height: '16px',
  borderRadius: '4px',
})
</script>

<template>
  <div
    class="skeleton"
    :class="variant === 'circle' ? 'skeleton-circle' : 'skeleton-block'"
    :style="{
      width: variant === 'circle' ? height : width,
      height,
      borderRadius: variant === 'circle' ? '50%' : borderRadius,
    }"
  />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    110deg,
    var(--glass-highlight) 25%,
    var(--glass-border) 50%,
    var(--glass-highlight) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  flex-shrink: 0;
  border-radius: inherit;
}
.skeleton-block {
  min-height: 8px;
}
.skeleton-circle {
  aspect-ratio: 1;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
