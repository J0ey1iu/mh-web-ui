<script setup lang="ts">
import { ref, reactive, computed, provide, onMounted, watch } from "vue"
import type { Component } from "vue"
import {
  ensureComponentsLoaded,
  getComponentSources,
  getSourceStatus,
  reloadSource,
  addAndLoadSource,
  unloadSource,
  type SourceLoadState,
} from "../toolComponentLoader"
import {
  getAllRegisteredComponents,
  getRegisteredComponent,
  getComponentDemoMock,
  registryVersion,
  type RegisteredComponentInfo,
} from "../toolCallRegistry"
import type { ToolCallDisplay } from "../types"
import { I18N_KEY } from "../toolContext"
import { useI18nStore } from "../stores/i18n"
import { appConfig } from "../config"
import BaseToolCard from "../components/BaseToolCard.vue"
import ToolCallCard from "../components/ToolCallCard.vue"

const THEMES = ["dark", "light", "dusk", "sepia", "eclipse", "lemonade"] as const

interface MockToolState {
  status: "running" | "success" | "error"
  progress: string[]
  result: string
  meta?: string
}

const sources = ref(getComponentSources())
const theme = ref(localStorage.getItem("theme") || "light")
const themeOpen = ref(false)

const i18nStore = useI18nStore()
provide(I18N_KEY, { locale: computed(() => i18nStore.locale) })
const localeOpen = ref(false)
const LANGUAGES = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
] as const

function setTheme(t: string) {
  theme.value = t
  themeOpen.value = false
  document.documentElement.setAttribute("data-theme", t)
  localStorage.setItem("theme", t)
}

const registeredComponents = ref<RegisteredComponentInfo[]>([])
const sourceStates = reactive<Record<string, SourceLoadState>>({})
const loadingAll = ref(false)
const error = ref<string | null>(null)

const mockStates = reactive<Record<string, MockToolState>>({})

const selectedComponent = ref<string | null>(null)
const sourcesOpen = ref(false)

// --- Source management form ---
const newSourceId = ref("")
const newSourceLabel = ref("")
const newSourceUrl = ref("")
const addingSource = ref(false)

function initSourceStates() {
  for (const src of sources.value) {
    if (!(src.id in sourceStates)) {
      sourceStates[src.id] = "idle"
    }
  }
  // Clean up states for removed sources
  for (const key of Object.keys(sourceStates)) {
    if (!sources.value.some(s => s.id === key)) {
      delete sourceStates[key]
    }
  }
  error.value =
    sources.value
      .map((s) => getSourceStatus(s.id).error)
      .filter(Boolean)
      .join("; ") || null
}

function refreshSrcStates() {
  for (const src of sources.value) {
    sourceStates[src.id] = getSourceStatus(src.id).state
  }
  error.value =
    sources.value
      .map((s) => getSourceStatus(s.id).error)
      .filter(Boolean)
      .join("; ") || null
}

function syncSources() {
  sources.value = getComponentSources()
  initSourceStates()
  refreshSrcStates()
}

async function handleAddSource() {
  const id = newSourceId.value.trim()
  const label = newSourceLabel.value.trim()
  const url = newSourceUrl.value.trim()
  if (!id || !url) return
  addingSource.value = true
  try {
    await addAndLoadSource({ id, label: label || id, url })
    syncSources()
    refreshComponentList()
    newSourceId.value = ""
    newSourceLabel.value = ""
    newSourceUrl.value = ""
  } finally {
    addingSource.value = false
  }
}

async function handleRemoveSource(id: string) {
  unloadSource(id)
  syncSources()
  refreshComponentList()
  if (selectedComponent.value) {
    const stillExists = registeredComponents.value.some(
      (c) => c.name === selectedComponent.value,
    )
    if (!stillExists) selectedComponent.value = null
  }
}

async function handleFetchFromApi() {
  const url = appConfig.apiComponentSources
  if (!url) return
  loadingAll.value = true
  try {
    const res = await fetch(url, { credentials: "include" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const list = await res.json() as { id: string; label: string; url: string }[]
    for (const item of list) {
      try {
        await addAndLoadSource(item)
      } catch {
        // continue with next
      }
    }
    syncSources()
    refreshComponentList()
  } catch (err) {
    console.warn("[ComponentsDemo] Failed to fetch component sources:", err)
  } finally {
    loadingAll.value = false
  }
}

function splitConcatenatedJson(str: string): string[] {
  const result: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "{") {
      if (depth === 0) start = i
      depth++
    } else if (str[i] === "}") {
      depth--
      if (depth === 0 && start >= 0) {
        result.push(str.slice(start, i + 1))
        start = -1
      }
    }
  }
  if (result.length === 0 && str.trim()) result.push(str)
  return result
}

function initMockState(name: string) {
  const demo = getComponentDemoMock(name)
  mockStates[name] = {
    status: demo?.status ?? "success",
    progress: demo?.progress ? splitConcatenatedJson(demo.progress) : [],
    result: demo?.result ?? "",
    meta: demo?.meta,
  }
}

function refreshComponentList() {
  registeredComponents.value = getAllRegisteredComponents()
  for (const c of registeredComponents.value) {
    if (!mockStates[c.name]) {
      initMockState(c.name)
    }
  }
  if (selectedComponent.value) {
    const stillExists = registeredComponents.value.some(
      (c) => c.name === selectedComponent.value,
    )
    if (!stillExists) selectedComponent.value = null
  }
}

function resetToDemoMock(name: string) {
  initMockState(name)
}

function selectComponent(name: string) {
  selectedComponent.value = name
}

watch(registryVersion, () => {
  refreshComponentList()
})

async function loadAll() {
  loadingAll.value = true
  refreshSrcStates()
  await ensureComponentsLoaded()
  syncSources()
  refreshSrcStates()
  refreshComponentList()
  loadingAll.value = false
}

async function handleReloadSource(sourceId: string) {
  sourceStates[sourceId] = "loading"
  await reloadSource(sourceId)
  syncSources()
  refreshSrcStates()
  refreshComponentList()
}

onMounted(async () => {
  document.documentElement.setAttribute("data-theme", theme.value)
  initSourceStates()
  await loadAll()
})

function getComponent(name: string): Component | null {
  return getRegisteredComponent(name) ?? null
}

function makeMockTool(name: string): ToolCallDisplay {
  const state = mockStates[name]
  return {
    id: `mock-${name}`,
    name,
    status: state?.status ?? "success",
    progress: state?.progress?.join("") ?? "",
    result: state?.result ?? "",
    meta: state?.meta,
  }
}

function statusClass(state: SourceLoadState): string {
  switch (state) {
    case "loaded": return "status-ok"
    case "failed": return "status-err"
    case "loading": return "status-busy"
    default: return "status-idle"
  }
}

function beautifyResult(name: string) {
  const raw = mockStates[name]?.result
  if (!raw) return
  try {
    mockStates[name].result = JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // not valid JSON, do nothing
  }
}

function beautifyMeta(name: string) {
  const raw = mockStates[name]?.meta
  if (!raw) return
  try {
    mockStates[name].meta = JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // not valid JSON, do nothing
  }
}

const compCount = computed(() => registeredComponents.value.length)
</script>

<template>
  <div class="demo-root">
    <header class="demo-header">
      <h1>Components</h1>
      <div class="demo-header-actions">
        <div class="select-wrap">
          <button class="demo-btn" @click="themeOpen = !themeOpen">
            <span class="theme-swatch" :style="{ background: 'var(--page-bg)' }" />
            {{ theme }}
          </button>
          <div v-if="themeOpen" class="dropdown">
            <button
              v-for="t in THEMES" :key="t"
              class="dropdown-item"
              :class="{ active: t === theme }"
              @click="setTheme(t)"
            >{{ t }}</button>
          </div>
        </div>
        <div class="select-wrap">
          <button class="demo-btn" @click="localeOpen = !localeOpen">
            {{ i18nStore.locale === "zh" ? "中文" : "English" }}
          </button>
          <div v-if="localeOpen" class="dropdown dropdown-right">
            <button
              v-for="lang in LANGUAGES" :key="lang.value"
              class="dropdown-item"
              :class="{ active: lang.value === i18nStore.locale }"
              @click="i18nStore.setLocale(lang.value); localeOpen = false"
            >{{ lang.label }}</button>
          </div>
        </div>
        <button class="demo-btn" :disabled="loadingAll" @click="handleFetchFromApi">
          {{ loadingAll ? "\u2026" : "API" }}
        </button>
        <button class="demo-btn" :disabled="loadingAll" @click="loadAll">
          {{ loadingAll ? "\u2026" : "\u21bb" }}
        </button>
      </div>
    </header>

    <div class="demo-layout">
      <aside class="demo-sidebar">
        <div class="sidebar-section-header">
          <span>Components</span>
          <span class="sidebar-badge">{{ compCount }}</span>
        </div>
        <div v-if="compCount === 0" class="sidebar-empty">
          No components loaded.
        </div>
        <nav v-else class="comp-list">
          <button
            v-for="comp in registeredComponents"
            :key="comp.name"
            class="comp-list-item"
            :class="{ active: comp.name === selectedComponent }"
            @click="selectComponent(comp.name)"
          >
            <code class="comp-list-name">{{ comp.name }}</code>
            <span class="comp-list-source">{{ comp.sourceId }}</span>
          </button>
        </nav>

        <div class="sidebar-divider" />

        <button class="sidebar-toggle" @click="sourcesOpen = !sourcesOpen">
          <span :class="['toggle-arrow', { open: sourcesOpen }]">&#9654;</span>
          Sources
        </button>
        <div v-if="sourcesOpen" class="source-list">
          <div
            v-for="src in sources"
            :key="src.id"
            class="source-item"
          >
            <span :class="['srci', statusClass(sourceStates[src.id])]" />
            <code class="srcid">{{ src.id }}</code>
            <span class="srclbl">{{ src.label }}</span>
            <button
              class="src-reload"
              :disabled="sourceStates[src.id] === 'loading'"
              title="Reload"
              @click="handleReloadSource(src.id)"
            >&#x21bb;</button>
            <button
              class="src-remove"
              title="Remove"
              @click="handleRemoveSource(src.id)"
            >&times;</button>
          </div>
          <div v-if="error" class="src-error">{{ error }}</div>

          <div class="add-source-form">
            <div class="add-source-title">Add Source</div>
            <input
              v-model="newSourceId"
              class="src-input"
              placeholder="ID (e.g. custom1)"
            />
            <input
              v-model="newSourceLabel"
              class="src-input"
              placeholder="Label (e.g. Custom Components)"
            />
            <input
              v-model="newSourceUrl"
              class="src-input"
              placeholder="URL (//localhost:5173/component/custom.umd.js)"
            />
            <button
              class="add-source-btn"
              :disabled="addingSource || !newSourceId.trim() || !newSourceUrl.trim()"
              @click="handleAddSource"
            >{{ addingSource ? "Adding..." : "Add" }}</button>
          </div>
        </div>
      </aside>

      <main class="demo-center">
        <div v-if="!selectedComponent" class="center-empty">
          <p>Select a component from the sidebar to inspect and test it.</p>
        </div>

        <template v-else>
          <div class="detail-header">
            <div class="detail-title">
              <code class="detail-name">{{ selectedComponent }}</code>
              <span class="detail-source">
                {{ registeredComponents.find(c => c.name === selectedComponent)?.sourceId }}
              </span>
            </div>
            <button
              class="demo-btn-sm reset-btn"
              @click="resetToDemoMock(selectedComponent)"
            >Reset Demo</button>
          </div>

          <div class="preview-area">
            <BaseToolCard
              v-if="getComponent(selectedComponent)"
              :tool="makeMockTool(selectedComponent)"
            >
              <component
                :is="getComponent(selectedComponent)!"
                :tool="makeMockTool(selectedComponent)"
              />
            </BaseToolCard>
            <ToolCallCard v-else :tool="makeMockTool(selectedComponent)" />
          </div>
        </template>
      </main>

      <aside class="demo-right">
        <div v-if="!selectedComponent" class="right-empty">
          <p>No component selected</p>
        </div>
        <template v-else>
          <div class="right-header">Mock Params</div>
          <div class="mock-panel">
            <div class="mock-field">
              <label>Status</label>
              <select v-model="mockStates[selectedComponent].status">
                <option value="running">running</option>
                <option value="success">success</option>
                <option value="error">error</option>
              </select>
            </div>

            <div class="mock-field">
              <label>Progress</label>
              <div class="progress-list">
                <div
                  v-for="i in mockStates[selectedComponent].progress.length"
                  :key="i"
                  class="progress-entry"
                >
                  <input
                    v-model="mockStates[selectedComponent].progress[i - 1]"
                    placeholder='{"event":"step1"}'
                  />
                  <button
                    class="entry-btn"
                    title="Remove"
                    @click="mockStates[selectedComponent].progress.splice(i - 1, 1)"
                  >&times;</button>
                </div>
              </div>
              <button
                class="add-btn"
                @click="mockStates[selectedComponent].progress.push('')"
              >+ Add Entry</button>
            </div>

            <div class="mock-field mock-result-field">
              <div class="mock-field-header">
                <label>Result</label>
                <button
                  class="beautify-btn"
                  title="Format JSON"
                  @click="beautifyResult(selectedComponent)"
                >{ }</button>
              </div>
              <textarea
                v-model="mockStates[selectedComponent].result"
                placeholder='{"data":"value"}'
              ></textarea>
            </div>

            <div class="mock-field mock-meta-field">
              <div class="mock-field-header">
                <label>Meta (UI-only)</label>
                <button
                  class="beautify-btn"
                  title="Format JSON"
                  @click="beautifyMeta(selectedComponent)"
                >{ }</button>
              </div>
              <textarea
                v-model="mockStates[selectedComponent].meta"
                placeholder='{"chart_data": {...}, "html": "..."}'
              ></textarea>
            </div>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.demo-root {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--surface-bg);
}

.demo-header h1 {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.demo-header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.demo-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface-raised);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
}

.demo-btn:hover:not(:disabled) {
  background: var(--accent-dim);
  border-color: var(--accent);
}

.demo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.demo-btn-sm {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-raised);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}

.demo-btn-sm:hover:not(:disabled) {
  background: var(--surface-alt);
}

.demo-btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.select-wrap {
  position: relative;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 120px;
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 201;
  overflow: hidden;
}

.dropdown-right {
  left: auto;
  right: 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 12px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.dropdown-item:hover {
  background: var(--surface-raised);
}

.dropdown-item.active {
  color: var(--accent);
}

.theme-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--border);
  vertical-align: middle;
  margin-right: 2px;
}

/* ===== layout ===== */

.demo-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.demo-sidebar {
  width: 250px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--surface-alt);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-badge {
  font-size: 10px;
  background: var(--surface-raised);
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: 8px;
}

.sidebar-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.comp-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comp-list-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.1s;
}

.comp-list-item:hover {
  background: var(--surface-raised);
}

.comp-list-item.active {
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  padding: 6px 9px;
}

.comp-list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
}

.comp-list-source {
  font-size: 10px;
  color: var(--text-tertiary);
}

.sidebar-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 12px;
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 12px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-toggle:hover {
  color: var(--text-primary);
}

.toggle-arrow {
  font-size: 8px;
  transition: transform 0.15s;
}

.toggle-arrow.open {
  transform: rotate(90deg);
}

.source-list {
  padding: 4px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.srci {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.srci.status-ok { background: var(--success); }
.srci.status-err { background: var(--error); }
.srci.status-busy { background: var(--accent); animation: pulse 0.8s ease-in-out infinite; }
.srci.status-idle { background: var(--text-muted); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.srcid {
  font-weight: 600;
  color: var(--text-strong);
  font-size: 11px;
}

.srclbl {
  color: var(--text-tertiary);
  font-size: 10px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.src-reload,
.src-remove {
  background: none;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 1px 5px;
  font-family: inherit;
}

.src-reload:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.src-remove {
  color: var(--error);
}

.src-error {
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--danger);
  color: var(--danger-text);
  border-radius: 4px;
  font-size: 10px;
}

/* --- add source form --- */

.add-source-form {
  margin-top: 8px;
  padding: 8px;
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-source-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.src-input {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface-alt);
  color: var(--text-primary);
  font-size: 11px;
  font-family: monospace;
  box-sizing: border-box;
  width: 100%;
}

.add-source-btn {
  padding: 4px 0;
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: var(--accent-dim);
  color: var(--accent);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
}

.add-source-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-source-btn:hover:not(:disabled) {
  background: var(--accent);
  color: white;
}

/* ===== center (preview) ===== */

.demo-center {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 24px;
}

.center-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 14px;
}

.center-empty p {
  text-align: center;
  max-width: 280px;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.detail-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.detail-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-strong);
  background: var(--surface-alt);
  padding: 2px 10px;
  border-radius: 5px;
}

.detail-source {
  font-size: 12px;
  color: var(--text-tertiary);
}

.reset-btn {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.reset-btn:hover {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.preview-area {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-bg);
}

/* ===== right (params panel) ===== */

.demo-right {
  flex: 1;
  min-width: 0;
  border-left: 1px solid var(--border);
  background: var(--surface-alt);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.right-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-muted);
  font-size: 13px;
  padding: 20px;
}

.right-header {
  padding: 14px 16px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mock-panel {
  padding: 4px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}

.mock-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.mock-field label {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mock-field select,
.mock-field input,
.mock-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-bg);
  color: var(--text-primary);
  font-size: 12px;
  font-family: monospace;
}

.mock-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.beautify-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  font-family: inherit;
  padding: 1px 5px;
  line-height: 1.4;
}

.beautify-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.mock-result-field,
.mock-meta-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mock-result-field textarea,
.mock-meta-field textarea {
  flex: 1;
  min-height: 80px;
  resize: none;
}

/* progress list */

.progress-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-entry {
  display: flex;
  gap: 4px;
}

.progress-entry input {
  flex: 1;
}

.entry-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  width: 26px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  padding: 0;
}

.entry-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.add-btn {
  background: none;
  border: 1px dashed var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 8px;
  font-family: inherit;
  text-align: center;
}

.add-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
