<script setup lang="ts">
import { computed } from "vue"
import { marked } from "marked"

marked.setOptions({
  breaks: true,
  gfm: true,
})

const props = defineProps<{
  content: string
}>()

const rendered = computed(() => {
  if (!props.content) return ""
  return marked.parse(props.content)
})
</script>

<template>
  <div class="agent-answer" v-html="rendered"></div>
</template>

<style scoped>
.agent-answer {
  line-height: 1.7;
  word-break: break-word;
}
.agent-answer :deep(p) {
  margin: 0 0 8px;
}
.agent-answer :deep(p:last-child) {
  margin-bottom: 0;
}
.agent-answer :deep(code) {
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}
.agent-answer :deep(pre) {
  background: var(--pre-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  overflow-x: auto;
}
.agent-answer :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
  border: none;
}
.agent-answer :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.agent-answer :deep(a:hover) {
  text-decoration: underline;
}
.agent-answer :deep(blockquote) {
  border-left: 3px solid var(--accent);
  margin: 8px 0;
  padding: 8px 12px;
  color: var(--text-secondary);
  background: var(--glass-highlight);
  border-radius: 0 6px 6px 0;
  border-top: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
}
.agent-answer :deep(ul),
.agent-answer :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}
.agent-answer :deep(li) {
  margin: 2px 0;
}
.agent-answer :deep(h1),
.agent-answer :deep(h2),
.agent-answer :deep(h3),
.agent-answer :deep(h4) {
  margin: 12px 0 6px;
  color: var(--text-primary);
}
.agent-answer :deep(h1) { font-size: 18px; }
.agent-answer :deep(h2) { font-size: 16px; }
.agent-answer :deep(h3) { font-size: 15px; }
.agent-answer :deep(h4) { font-size: 14px; }
.agent-answer :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
  font-size: 13px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  overflow: hidden;
}
.agent-answer :deep(th),
.agent-answer :deep(td) {
  border: 1px solid var(--glass-border);
  padding: 6px 10px;
  text-align: left;
}
.agent-answer :deep(th) {
  background: var(--glass-highlight);
  font-weight: 600;
}
.agent-answer :deep(hr) {
  border: none;
  border-top: 1px solid var(--glass-border);
  margin: 12px 0;
}
.agent-answer :deep(strong) {
  color: var(--text-strong);
}
</style>
