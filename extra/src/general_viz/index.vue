<script lang="ts">
const _sampleMeta = {
  html: `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Visualization</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--mh-bg,#f8fafc);color:var(--mh-text,#1e293b);padding:20px;transition:background .15s,color .15s}
h1{font-size:18px;margin:0 0 16px;color:var(--mh-text,#0f172a)}
.card{background:var(--mh-card,#fff);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:16px;margin-bottom:12px;border:1px solid var(--mh-border,#e2e8f0)}
.bar{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-label{width:80px;font-size:12px;font-weight:600;text-align:right;flex-shrink:0;color:var(--mh-text,#64748b)}
.bar-track{flex:1;height:22px;background:var(--mh-border,#e2e8f0);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;background:linear-gradient(90deg,var(--mh-accent,#3b82f6),color-mix(in srgb,var(--mh-accent,#3b82f6) 70%,#fff));border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;color:#fff;font-size:11px;font-weight:600;transition:width .6s ease;min-width:0}
.summary{font-size:13px;color:var(--mh-text,#64748b);margin-top:8px}
</style></head><body>
<h1>Monthly Sales Overview</h1>
<div class="card">
<div class="bar"><span class="bar-label">Jan</span><div class="bar-track"><div class="bar-fill" style="width:65%">6.5k</div></div></div>
<div class="bar"><span class="bar-label">Feb</span><div class="bar-track"><div class="bar-fill" style="width:78%">7.8k</div></div></div>
<div class="bar"><span class="bar-label">Mar</span><div class="bar-track"><div class="bar-fill" style="width:92%">9.2k</div></div></div>
<div class="bar"><span class="bar-label">Apr</span><div class="bar-track"><div class="bar-fill" style="width:55%">5.5k</div></div></div>
<div class="bar"><span class="bar-label">May</span><div class="bar-track"><div class="bar-fill" style="width:100%">10k</div></div></div>
</div>
<div class="summary">Total: 39k | Best month: May (10k) | Average: 7.8k</div>
</body></html>`,
}

export const demoMock = {
  status: "success" as const,
  progress: JSON.stringify({ message: "Generating visualization... (1520 chars)" }),
  result: "可视化已完成，已生成HTML页面并推送到用户跟前，用户可以直接查看。原始描述：展示最近5个月的销售数据，用条形图表示",
  meta: JSON.stringify(_sampleMeta),
}

export const demoMockRunning = {
  status: "running" as const,
  progress: JSON.stringify({ message: "Generating visualization... (340 chars)" }),
  result: "",
}

export const demoMockError = {
  status: "error" as const,
  progress: "",
  result: "可视化生成失败，请稍后重试。",
}
</script>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
import type { ToolCallDisplay } from "../types"
import { useToolI18n } from "../composables/useToolI18n"
import messages from "./locales"

const { t } = useToolI18n(messages)

const props = defineProps<{ tool: ToolCallDisplay }>()

interface Meta {
  html?: string
}

const meta = computed<Meta | null>(() => {
  if (!props.tool.meta) return null
  try {
    return JSON.parse(props.tool.meta) as Meta
  } catch {
    return null
  }
})

const htmlContent = computed(() => meta.value?.html ?? "")

const wrapRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

function toggleFullscreen() {
  if (isFullscreen.value) {
    document.exitFullscreen()
  } else if (wrapRef.value) {
    wrapRef.value.requestFullscreen()
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

const progressMessage = computed(() => {
  if (!props.tool.progress) return ""
  const matches = props.tool.progress.match(/\{[^}]*\}/g)
  if (matches && matches.length > 0) {
    try {
      const parsed = JSON.parse(matches[matches.length - 1])
      return parsed.message || props.tool.progress
    } catch {}
  }
  return props.tool.progress
})

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange)
})
</script>

<template>
  <div class="gviz" :class="tool.status">
    <template v-if="tool.status === 'running'">
      <div class="gviz-loading">
        <span class="gviz-spinner" />
        <span>{{ progressMessage || t("loading") }}</span>
      </div>
    </template>

    <template v-else-if="tool.status === 'success' && htmlContent">
      <div ref="wrapRef" class="gviz-iframe-wrap">
        <button class="gviz-fullscreen-btn" @click="toggleFullscreen">
          <template v-if="isFullscreen">✕</template>
          <template v-else>⛶</template>
        </button>
        <iframe
          :srcdoc="htmlContent"
          class="gviz-iframe"
          sandbox="allow-scripts"
          title="visualization"
        />
      </div>
    </template>

    <template v-else-if="tool.status === 'success'">
      <div class="gviz-fallback">{{ t("no_data") }}</div>
    </template>

    <template v-else>
      <div class="gviz-error">{{ tool.result || t("error") }}</div>
    </template>
  </div>
</template>

<style scoped>
.gviz { margin: 2px 0; }
.gviz-loading { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-tertiary); padding: 8px 0; }
.gviz-spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: gvizSpin 0.8s linear infinite; }
.gviz-iframe-wrap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; transition: border-color var(--transition-duration); position: relative; }
.gviz.success .gviz-iframe-wrap { border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
.gviz-iframe-wrap:fullscreen { border-radius: 0; background: #000; padding: 0; }
.gviz-iframe-wrap:fullscreen .gviz-iframe { height: 100vh; }
.gviz-fullscreen-btn { position: absolute; top: 8px; right: 8px; z-index: 10; width: 28px; height: 28px; border: none; border-radius: 6px; background: color-mix(in srgb, var(--surface-bg) 80%, transparent); color: var(--text-secondary); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity var(--transition-duration), background var(--transition-duration); }
.gviz-iframe-wrap:hover .gviz-fullscreen-btn,
.gviz-iframe-wrap:fullscreen .gviz-fullscreen-btn { opacity: 1; }
.gviz-fullscreen-btn:hover { background: var(--surface-bg); color: var(--text-primary); }
.gviz.success .gviz-iframe-wrap { border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
.gviz-iframe { width: 100%; height: 360px; border: none; display: block; }
.gviz-fallback { font-size: 13px; color: var(--text-secondary); padding: 8px 0; }
.gviz-error { font-size: 13px; color: var(--error); display: flex; align-items: center; gap: 6px; padding: 8px 0; }
.gviz-error::before { content: "!"; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error); font-size: 11px; font-weight: 700; flex-shrink: 0; }
@keyframes gvizSpin { to { transform: rotate(360deg); } }
</style>
