<script setup lang="ts">
import { ref } from "vue"
import {
  generateToolMetadata,
  saveGeneratedTool,
  updateGeneratedTool,
  executeGeneratedTool,
} from "../api/client"
import type { GeneratedTool } from "../types"

const naturalDescription = ref("")
const generating = ref(false)
const saving = ref(false)
const executing = ref(false)

const generated = ref<GeneratedTool>({
  name: "",
  display_name: "",
  description: "",
  parameters: {},
  source_code: "",
  user_id: "",
  created_at: "",
  updated_at: "",
})
const parametersText = ref("{}")

const trialArgs = ref<Record<string, any>>({})
const trialOutput = ref<{ type: string; data: any }[]>([])
let abortController: AbortController | null = null

const genProgress = ref("")
const genAbortController = ref<AbortController | null>(null)

const fullscreenCode = ref(false)
const fullscreenCodeText = ref("")

function openCodeFullscreen() {
  if (generated.value) {
    fullscreenCodeText.value = generated.value.source_code
  }
  fullscreenCode.value = true
}

function closeCodeFullscreen() {
  if (generated.value) {
    generated.value.source_code = fullscreenCodeText.value
  }
  fullscreenCode.value = false
}

const fullscreenText = ref(false)
const fullscreenTextTitle = ref("")
const fullscreenTextContent = ref("")
let fullscreenTextTarget: "description" | "parameters" | null = null

function openTextFullscreen(title: string, content: string, target: "description" | "parameters") {
  fullscreenTextTitle.value = title
  fullscreenTextContent.value = content
  fullscreenTextTarget = target
  fullscreenText.value = true
}

function closeTextFullscreen() {
  if (fullscreenTextTarget === "description" && generated.value) {
    generated.value.description = fullscreenTextContent.value
  } else if (fullscreenTextTarget === "parameters") {
    parametersText.value = fullscreenTextContent.value
  }
  fullscreenText.value = false
  fullscreenTextTarget = null
}

function formatParametersJson() {
  try {
    const parsed = JSON.parse(fullscreenTextContent.value)
    fullscreenTextContent.value = JSON.stringify(parsed, null, 2)
  } catch {
    alert("Invalid JSON")
  }
}

const editingName = ref<string | null>(null)
const showNL = ref(false)

function handleGenerate() {
  if (!naturalDescription.value.trim()) return
  generating.value = true
  genProgress.value = ""
  trialOutput.value = []
  genAbortController.value = generateToolMetadata(
    naturalDescription.value.trim(),
    (type, data) => {
      if (type === "generating") {
        genProgress.value = data.content_preview || data.message || ""
      } else if (type === "generated") {
        generated.value = data as unknown as GeneratedTool
        parametersText.value = JSON.stringify(
          (generated.value as any).parameters,
          null,
          2,
        )
        editingName.value = null
        initTrialArgs()
      } else if (type === "error") {
        alert(`Generation error: ${data.message}`)
      }
    },
    () => {
      generating.value = false
      genProgress.value = ""
      genAbortController.value = null
    },
    (err) => {
      generating.value = false
      genProgress.value = ""
      genAbortController.value = null
      alert(`Generation failed: ${err.message}`)
    },
  )
}

function handleStopGenerate() {
  genAbortController.value?.abort()
  generating.value = false
  genProgress.value = ""
  genAbortController.value = null
}

function initTrialArgs() {
  if (!generated.value) return
  const props = generated.value.parameters?.properties
  if (!props) return
  trialArgs.value = {}
  for (const [key, schema] of Object.entries(props)) {
    const s = schema as any
    trialArgs.value[key] = s.default ?? (s.type === "boolean" ? false : s.type === "number" || s.type === "integer" ? 0 : "")
  }
}

async function handleSave() {
  if (!generated.value) return
  saving.value = true
  try {
    let parsedParameters: Record<string, any>
    try {
      parsedParameters = JSON.parse(parametersText.value)
    } catch {
      alert("Parameters JSON is invalid")
      saving.value = false
      return
    }
    if (editingName.value) {
      await updateGeneratedTool(editingName.value, {
        display_name: generated.value.display_name,
        description: generated.value.description,
        parameters: parsedParameters,
        source_code: generated.value.source_code,
      })
      alert("Tool updated!")
    } else {
      await saveGeneratedTool({
        name: generated.value.name,
        display_name: generated.value.display_name,
        description: generated.value.description,
        parameters: parsedParameters,
        source_code: generated.value.source_code,
      })
      editingName.value = generated.value.name
      alert("Tool saved!")
    }
  } catch (e: any) {
    alert(`Save failed: ${e.message}`)
  } finally {
    saving.value = false
  }
}

async function handleExecute() {
  if (!generated.value) return
  executing.value = true
  trialOutput.value = []
  abortController = executeGeneratedTool(
    generated.value.name,
    trialArgs.value,
    generated.value.source_code,
    (type, data) => {
      trialOutput.value.push({ type, data })
    },
    () => {
      executing.value = false
      abortController = null
    },
    (err) => {
      executing.value = false
      abortController = null
      alert(`Execution error: ${err.message}`)
    },
  )
}

function handleStop() {
  abortController?.abort()
  executing.value = false
  abortController = null
}

function paramInputType(schema: any): string {
  switch (schema.type) {
    case "integer":
    case "number":
      return "number"
    case "boolean":
      return "checkbox"
    default:
      return "text"
  }
}

function paramLabel(key: string, schema: any): string {
  return schema.description || key
}

function formatOutput(data: any): string {
  if (typeof data === "string") return data
  return JSON.stringify(data, null, 2)
}
</script>

<template>
  <div class="tool-creator">
    <div class="tc-header">
      <h1 class="tc-title">Tool Creator</h1>
      <router-link to="/" class="tc-back">Back to Chat</router-link>
    </div>

    <div class="tc-panels">
      <!-- LEFT: Tool Definition -->
      <div class="tc-panel tc-left">
        <!-- NL Helper -->
        <div class="tc-nl-section">
          <button class="tc-nl-toggle" @click="showNL = !showNL">
            {{ showNL ? 'Hide' : 'Describe in Natural Language' }}
            <span class="tc-nl-arrow">{{ showNL ? '▲' : '▼' }}</span>
          </button>
          <div v-if="showNL" class="tc-nl-body">
            <textarea
              v-model="naturalDescription"
              class="tc-textarea"
              placeholder="Describe what the tool should do in natural language..."
              rows="3"
            />
            <template v-if="!generating">
              <button
                class="btn-generate"
                :disabled="!naturalDescription.trim()"
                @click="handleGenerate"
              >
                Generate Metadata
              </button>
            </template>
            <template v-else>
              <button class="btn-stop" @click="handleStopGenerate">
                Stop Generation
              </button>
              <div v-if="genProgress" class="tc-gen-progress">
                <div class="tc-gen-progress-label">Generating</div>
                <pre class="tc-gen-progress-text">{{ genProgress }}</pre>
              </div>
            </template>
          </div>
        </div>

        <!-- Metadata Form (always visible) -->
        <h2 class="tc-panel-title">Tool Metadata</h2>
        <div class="tc-field">
          <label class="tc-label">Name</label>
          <input v-model="generated.name" type="text" class="tc-input" />
        </div>
        <div class="tc-field">
          <label class="tc-label">Display Name</label>
          <input v-model="generated.display_name" type="text" class="tc-input" />
        </div>
        <div class="tc-field">
          <div class="tc-label-row">
            <label class="tc-label">Description</label>
            <button class="tc-fullscreen-btn" @click="openTextFullscreen('Description', generated.description, 'description')" title="Fullscreen">&#x26F6;</button>
          </div>
          <textarea v-model="generated.description" class="tc-input tc-textarea-sm" rows="3" />
        </div>
        <div class="tc-field">
          <div class="tc-label-row">
            <label class="tc-label">Parameters (JSON Schema)</label>
            <button class="tc-fullscreen-btn" @click="openTextFullscreen('Parameters', parametersText, 'parameters')" title="Fullscreen">&#x26F6;</button>
          </div>
          <textarea v-model="parametersText" class="tc-input tc-textarea-code" rows="8" />
        </div>
        <div class="tc-field">
          <div class="tc-label-row">
            <label class="tc-label">Source Code</label>
            <button class="tc-fullscreen-btn" @click="openCodeFullscreen()" title="Fullscreen">&#x26F6;</button>
          </div>
          <textarea
            v-model="generated.source_code"
            class="tc-input tc-textarea-code-source"
            rows="10"
            spellcheck="false"
          />
        </div>
        <div class="tc-actions">
          <button class="btn-save" :disabled="saving" @click="handleSave">
            {{ saving ? (editingName ? "Updating..." : "Saving...") : (editingName ? "Update Tool" : "Save Tool") }}
          </button>
        </div>

      </div>

      <!-- RIGHT: Trial Area -->
      <div class="tc-panel tc-right">
        <h2 class="tc-panel-title">Trial Area</h2>
        <h3 class="tc-subtitle">Parameters</h3>
        <template v-if="generated.parameters?.properties">
          <div
            v-for="(schema, key) in generated.parameters.properties"
            :key="key"
            class="tc-field"
          >
            <label class="tc-label">{{ paramLabel(String(key), schema) }}</label>
            <input
              v-if="paramInputType(schema) === 'checkbox'"
              v-model="trialArgs[String(key)]"
              type="checkbox"
              class="tc-checkbox"
            />
            <input
              v-else-if="paramInputType(schema) === 'number'"
              v-model.number="trialArgs[String(key)]"
              type="number"
              class="tc-input"
            />
            <input
              v-else
              v-model="trialArgs[String(key)]"
              type="text"
              class="tc-input"
            />
          </div>
        </template>
        <div class="tc-trial-actions">
          <button v-if="!executing" class="btn-run" @click="handleExecute">Run</button>
          <button v-else class="btn-stop" @click="handleStop">Stop</button>
        </div>

        <h3 class="tc-subtitle">Output</h3>
        <div class="tc-output">
          <div
            v-for="(item, idx) in trialOutput"
            :key="idx"
            :class="['tc-output-item', `tc-output-${item.type}`]"
          >
            <span class="tc-output-type">{{ item.type }}</span>
            <pre class="tc-output-data">{{ formatOutput(item.data) }}</pre>
          </div>
          <div v-if="executing && trialOutput.length === 0" class="tc-output-waiting">
            Waiting for output...
          </div>
        </div>
      </div>
    </div>

    <!-- Fullscreen Code Overlay -->
    <Teleport to="body">
      <div v-if="fullscreenCode" class="tc-overlay" @click.self="closeCodeFullscreen()">
        <div class="tc-overlay-content">
          <div class="tc-overlay-header">
            <span class="tc-overlay-title">Source Code</span>
            <button class="tc-fullscreen-close" @click="closeCodeFullscreen()">&#x2715;</button>
          </div>
          <div class="tc-overlay-body">
            <textarea
              v-model="fullscreenCodeText"
              class="tc-overlay-textarea"
              spellcheck="false"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Fullscreen Text Overlay (Description / Parameters) -->
    <Teleport to="body">
      <div v-if="fullscreenText" class="tc-overlay" @click.self="closeTextFullscreen()">
        <div class="tc-overlay-content">
          <div class="tc-overlay-header">
            <span class="tc-overlay-title">{{ fullscreenTextTitle }}</span>
            <div class="tc-overlay-header-actions">
              <button
                v-if="fullscreenTextTitle === 'Parameters'"
                class="tc-format-btn"
                @click="formatParametersJson"
              >
                Format JSON
              </button>
              <button class="tc-fullscreen-close" @click="closeTextFullscreen()">&#x2715;</button>
            </div>
          </div>
          <div class="tc-overlay-body">
            <textarea
              v-model="fullscreenTextContent"
              class="tc-overlay-textarea"
              spellcheck="false"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tool-creator {
  --color-success: var(--success, #22c55e);
  --color-danger: var(--error, #ef4444);
  --color-info: var(--accent, #3b82f6);
  --color-on-accent: #fff;
  min-height: 100vh;
  background: var(--page-bg);
  color: var(--text-primary);
  padding: 24px;
}

.tc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.tc-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.tc-back {
  color: var(--accent);
  text-decoration: none;
  font-size: 14px;
}

.tc-panels {
  display: flex;
  gap: 16px;
  height: calc(100vh - 100px);
}

.tc-panel {
  flex: 1;
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
}

.tc-panel-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

.tc-textarea {
  width: 100%;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 10px;
  resize: vertical;
  font-family: inherit;
}

.tc-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.tc-textarea-sm {
  min-height: 60px;
}

.tc-textarea-code {
  min-height: 120px;
  font-family: monospace;
  font-size: 12px;
}

.tc-textarea-code-source {
  min-height: 200px;
  font-family: monospace;
  font-size: 12px;
}

.tc-actions {
  margin-top: 16px;
}

.btn-save {
  width: 100%;
  padding: 10px 24px;
  background: var(--color-success);
  border: none;
  border-radius: 8px;
  color: var(--color-on-accent);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-generate {
  width: 100%;
  margin-top: 12px;
  padding: 10px 24px;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: var(--accent-text, #fff);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tc-field {
  margin-bottom: 12px;
}

.tc-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tc-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.tc-fullscreen-btn {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 6px;
}

.tc-fullscreen-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}

.tc-input {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  box-sizing: border-box;
}

.tc-input:focus {
  outline: none;
  border-color: var(--accent);
}

.tc-input:disabled {
  opacity: 0.5;
}

.tc-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}

.tc-subtitle {
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0 8px;
}

.tc-trial-actions {
  margin-top: 12px;
}

.btn-run {
  width: 100%;
  padding: 10px 24px;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: var(--accent-text, #fff);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.btn-stop {
  width: 100%;
  padding: 10px 24px;
  background: var(--color-danger);
  border: none;
  border-radius: 8px;
  color: var(--color-on-accent);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.tc-output {
  margin-top: 8px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  min-height: 100px;
  max-height: 300px;
  overflow-y: auto;
}

.tc-output-item {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.tc-output-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.tc-output-type {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.tc-output-tool_progress .tc-output-type {
  background: var(--color-info);
  color: var(--color-on-accent);
}

.tc-output-tool_end .tc-output-type {
  background: var(--color-success);
  color: var(--color-on-accent);
}

.tc-output-error .tc-output-type {
  background: var(--color-danger);
  color: var(--color-on-accent);
}

.tc-output-data {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}

.tc-output-waiting {
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}

.tc-divider {
  height: 1px;
  background: var(--border);
  margin: 20px 0;
}

.tc-nl-section {
  margin-bottom: 16px;
}

.tc-nl-toggle {
  width: 100%;
  padding: 8px 12px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tc-nl-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.tc-nl-arrow {
  font-size: 10px;
}

.tc-nl-body {
  margin-top: 8px;
}

.tc-gen-progress {
  margin-top: 12px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
}

.tc-gen-progress-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.tc-gen-progress-text {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
}

.tc-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tc-overlay-content {
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 90vw;
  height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tc-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.tc-overlay-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tc-format-btn {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  cursor: pointer;
}

.tc-format-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.tc-overlay-title {
  font-size: 16px;
  font-weight: 600;
}

.tc-fullscreen-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.tc-fullscreen-close:hover {
  color: var(--text-primary);
  background: var(--surface-raised);
}

.tc-overlay-body {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.tc-code-full {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  background: #0d1117;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  color: #c9d1d9;
}

.tc-overlay-textarea {
  width: 100%;
  height: 100%;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: monospace;
  font-size: 13px;
  padding: 12px;
  resize: none;
  box-sizing: border-box;
}

.tc-overlay-textarea:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
