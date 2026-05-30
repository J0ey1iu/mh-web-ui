<script setup lang="ts">
import { ref, onMounted } from "vue"
import {
  fetchManageTools,
  createManageTool,
  updateManageTool,
  deleteManageTool,
  generateToolMetadata,
  saveGeneratedTool,
  updateGeneratedTool,
  executeGeneratedTool,
  fetchGeneratedTools,
  deleteGeneratedTool,
} from "../api/client"
import type { ManageTool, GeneratedTool } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"

const { t, localeVal } = useI18nStore()

const activeTab = ref<"manage" | "create">("manage")

// ===== Manage Tools =====
const tools = ref<ManageTool[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editing = ref(false)
const form = ref<Partial<ManageTool>>({
  name: "",
  display_name: "",
  display_name_locale: "",
  description: "",
  description_locale: "",
  parameters: { type: "object", properties: {}, required: [] },
  endpoint_url: "",
})

const localeForm = ref({ display_zh: "", display_en: "", desc_zh: "", desc_en: "" })

function parseLocaleJson(jsonStr: string | undefined): { zh: string; en: string } {
  if (!jsonStr) return { zh: "", en: "" }
  try {
    const parsed = JSON.parse(jsonStr)
    return { zh: parsed.zh ?? "", en: parsed.en ?? "" }
  } catch {
    return { zh: "", en: "" }
  }
}

function composeLocaleJson(zh: string, en: string): string {
  if (!zh && !en) return ""
  return JSON.stringify({ zh, en })
}

function loadLocaleFromForm() {
  const d = parseLocaleJson(form.value.display_name_locale)
  localeForm.value.display_zh = d.zh; localeForm.value.display_en = d.en
  const de = parseLocaleJson(form.value.description_locale)
  localeForm.value.desc_zh = de.zh; localeForm.value.desc_en = de.en
}

function applyLocaleToForm() {
  form.value.display_name_locale = composeLocaleJson(localeForm.value.display_zh, localeForm.value.display_en)
  form.value.description_locale = composeLocaleJson(localeForm.value.desc_zh, localeForm.value.desc_en)
}
const parametersText = ref("{}")
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    tools.value = await fetchManageTools()
  } catch (e) {
    alert("Failed to load tools: " + (e as Error).message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = false
  form.value = { name: "", display_name: "", display_name_locale: "", description: "", description_locale: "", parameters: { type: "object", properties: {}, required: [] }, endpoint_url: "" }
  localeForm.value = { display_zh: "", display_en: "", desc_zh: "", desc_en: "" }
  parametersText.value = JSON.stringify(form.value.parameters, null, 2)
  showDialog.value = true
}

function openEdit(t: ManageTool) {
  editing.value = true
  form.value = { ...t, parameters: { ...t.parameters } }
  parametersText.value = JSON.stringify(t.parameters, null, 2)
  loadLocaleFromForm()
  showDialog.value = true
}

function applyParametersJson() {
  try {
    const parsed = JSON.parse(parametersText.value)
    form.value.parameters = parsed
  } catch {
    alert("Invalid JSON in parameters field")
  }
}

async function save() {
  applyParametersJson()
  applyLocaleToForm()
  saving.value = true
  try {
    if (editing.value && form.value.name) {
      await updateManageTool(form.value.name, form.value)
    } else {
      await createManageTool(form.value)
    }
    showDialog.value = false
    await load()
  } catch (e) {
    alert("Failed to save: " + (e as Error).message)
  } finally {
    saving.value = false
  }
}

function fmtAudit(dt: string | undefined, by: string | undefined): string {
  if (!dt) return "-"
  const t = dt.replace("T", " ").substring(0, 16)
  return by ? `${t} by ${by}` : t
}

async function remove(name: string) {
  if (!confirm(`Delete tool "${name}"?`)) return
  try {
    await deleteManageTool(name)
    await load()
  } catch (e) {
    alert("Failed to delete: " + (e as Error).message)
  }
}

onMounted(load)

// ===== Tool Creator =====
const naturalDescription = ref("")
const generating = ref(false)
const savingCreator = ref(false)
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
const creatorParametersText = ref("{}")

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
    creatorParametersText.value = fullscreenTextContent.value
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

const loadingTools = ref(false)
const savedTools = ref<GeneratedTool[]>([])
const editingName = ref<string | null>(null)
const showNL = ref(false)

async function loadSavedTools() {
  loadingTools.value = true
  try {
    savedTools.value = await fetchGeneratedTools()
  } finally {
    loadingTools.value = false
  }
}

function newTool() {
  generated.value = {
    name: "",
    display_name: "",
    description: "",
    parameters: {},
    source_code: "",
    user_id: "",
    created_at: "",
    updated_at: "",
  }
  creatorParametersText.value = "{}"
  trialOutput.value = []
  trialArgs.value = {}
  editingName.value = null
  naturalDescription.value = ""
}

function loadTool(tool: GeneratedTool) {
  generated.value = { ...tool }
  creatorParametersText.value = JSON.stringify(tool.parameters, null, 2)
  trialOutput.value = []
  editingName.value = tool.name
  initTrialArgs()
}

async function handleDelete(name: string) {
  if (!confirm(`Delete tool "${name}"?`)) return
  try {
    await deleteGeneratedTool(name)
    if (editingName.value === name) newTool()
    await loadSavedTools()
  } catch (e: any) {
    alert(`Delete failed: ${e.message}`)
  }
}

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
        creatorParametersText.value = JSON.stringify(
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
  savingCreator.value = true
  try {
    let parsedParameters: Record<string, any>
    try {
      parsedParameters = JSON.parse(creatorParametersText.value)
    } catch {
      alert("Parameters JSON is invalid")
      savingCreator.value = false
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
    await loadSavedTools()
  } catch (e: any) {
    alert(`Save failed: ${e.message}`)
  } finally {
    savingCreator.value = false
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
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content">
      <header class="mgmt-header">
        <h1>{{ t("mgmt_tools") }}</h1>
        <div class="mgmt-tabs">
          <button :class="['tab-btn', { active: activeTab === 'manage' }]" @click="activeTab = 'manage'">{{ t("mgmt_tab_manage") }}</button>
          <button :class="['tab-btn', { active: activeTab === 'create' }]" @click="activeTab = 'create'">{{ t("mgmt_tab_create") }}</button>
        </div>
      </header>

      <!-- ===== Manage Tools Tab ===== -->
      <div v-if="activeTab === 'manage'">
        <button class="btn-primary" @click="openCreate">{{ t("mgmt_new_tool") }}</button>

        <div v-if="loading" class="mgmt-loading">{{ t("mgmt_loading") }}</div>
        <div v-else-if="tools.length === 0" class="mgmt-empty">{{ t("mgmt_no_tools") }}</div>
        <table v-else class="mgmt-table">
          <thead>
            <tr>
              <th>{{ t("mgmt_name") }}</th>
              <th>{{ t("mgmt_display_name") }}</th>
              <th>{{ t("mgmt_description") }}</th>
              <th>{{ t("mgmt_endpoint") }}</th>
              <th>{{ t("mgmt_created_at") }}</th>
              <th>{{ t("mgmt_updated_at") }}</th>
              <th>{{ t("mgmt_actions") }}</th>
            </tr>
          </thead>
          <tbody>
          <tr v-for="tl in tools" :key="tl.name">
            <td><code>{{ tl.name }}</code></td>
            <td>{{ localeVal(tl.display_name_locale, tl.display_name) }}</td>
            <td class="cell-desc">{{ localeVal(tl.description_locale, tl.description) }}</td>
            <td><code class="cell-url">{{ tl.endpoint_url || t("mgmt_local") }}</code></td>
            <td class="cell-audit">{{ fmtAudit(tl.created_at, tl.created_by) }}</td>
            <td class="cell-audit">{{ fmtAudit(tl.updated_at, tl.updated_by) }}</td>
            <td class="cell-actions">
              <button class="btn-action" @click="openEdit(tl)">{{ t("mgmt_edit") }}</button>
              <button class="btn-action btn-danger" @click="remove(tl.name)">{{ t("mgmt_delete") }}</button>
            </td>
          </tr>
          </tbody>
        </table>

        <Teleport to="body">
          <div v-if="showDialog" class="dialog-overlay" @click.self="showDialog = false">
            <div class="dialog dialog-wide">
              <h2>{{ editing ? t("mgmt_edit_tool") : t("mgmt_new_tool_title") }}</h2>
              <div class="form-group">
                <label>{{ t("mgmt_name") }}</label>
                <input v-model="form.name" :disabled="editing" :placeholder="t('mgmt_placeholder_id')" />
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_display_name") }}</label>
                <input v-model="form.display_name" :placeholder="t('mgmt_placeholder_display_name')" />
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_description") }}</label>
                <textarea v-model="form.description" rows="2"></textarea>
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_parameters") }}</label>
                <textarea v-model="parametersText" rows="6" class="mono" @blur="applyParametersJson"></textarea>
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_endpoint") }}</label>
                <input v-model="form.endpoint_url" :placeholder="t('mgmt_placeholder_endpoint')" />
              </div>
              <details class="locale-section">
                <summary>{{ t("mgmt_translations") }}</summary>
                <div class="locale-field">
                  <div class="locale-field-label">{{ t("mgmt_locale_display") }}</div>
                  <div class="locale-input-row">
                    <label class="locale-lang">zh <input v-model="localeForm.display_zh" placeholder="中文名称" /></label>
                    <label class="locale-lang">en <input v-model="localeForm.display_en" :placeholder="t('mgmt_placeholder_display_name')" /></label>
                  </div>
                </div>
                <div class="locale-field">
                  <div class="locale-field-label">{{ t("mgmt_locale_desc") }}</div>
                  <div class="locale-input-row">
                    <label class="locale-lang">zh <textarea v-model="localeForm.desc_zh" rows="2" placeholder="中文描述"></textarea></label>
                    <label class="locale-lang">en <textarea v-model="localeForm.desc_en" rows="2" :placeholder="t('mgmt_placeholder_desc')"></textarea></label>
                  </div>
                </div>
              </details>
              <div class="dialog-actions">
                <button class="btn-cancel" @click="showDialog = false">{{ t("mgmt_cancel") }}</button>
                <button class="btn-primary" :disabled="saving || !form.name" @click="save">
                  {{ saving ? t("mgmt_saving") : t("mgmt_save") }}
                </button>
              </div>
            </div>
          </div>
        </Teleport>
      </div>

      <!-- ===== Tool Creator Tab ===== -->
      <div v-else class="tc-content">
        <div class="tc-panels">
          <div class="tc-panel tc-left">
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
                <button class="tc-fullscreen-btn" @click="openTextFullscreen('Parameters', creatorParametersText, 'parameters')" title="Fullscreen">&#x26F6;</button>
              </div>
              <textarea v-model="creatorParametersText" class="tc-input tc-textarea-code" rows="8" />
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
              <button class="btn-save" :disabled="savingCreator" @click="handleSave">
                {{ savingCreator ? (editingName ? "Updating..." : "Saving...") : (editingName ? "Update Tool" : "Save Tool") }}
              </button>
            </div>

            <div class="tc-divider" />
            <div class="tc-saved-header">
              <h2 class="tc-panel-title">My Saved Tools</h2>
              <button class="btn-new" @click="newTool">+ New</button>
            </div>
            <div v-if="loadingTools" class="tc-placeholder">Loading...</div>
            <ul v-else-if="savedTools.length" class="tc-tool-list">
              <li
                v-for="tool in savedTools"
                :key="tool.name"
                :class="['tc-tool-item', { active: editingName === tool.name }]"
              >
                <div class="tc-tool-name" @click="loadTool(tool)">
                  <span class="tc-tool-display-name">{{ tool.display_name }}</span>
                  <span class="tc-tool-id">{{ tool.name }}</span>
                </div>
                <button class="tc-btn-delete" @click.stop="handleDelete(tool.name)" title="Delete">x</button>
              </li>
            </ul>
            <div v-else class="tc-placeholder">No saved tools yet.</div>
          </div>

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
            <p v-else class="tc-placeholder">No parameters defined.</p>

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
    </div>
  </div>
</template>

<style scoped>
.mgmt-page {
  color: var(--text-primary);
}
.mgmt-page-content {
  max-width: 1060px;
  margin: 0 auto;
  padding: 24px;
}
.mgmt-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.mgmt-header h1 {
  margin: 0;
  font-size: 20px;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-cancel {
  background: var(--surface-raised);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.mgmt-loading, .mgmt-empty {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}
.mgmt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mgmt-table th {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid var(--border);
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}
.mgmt-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.mgmt-table tr:hover td {
  background: var(--surface-raised);
}
.cell-desc {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-url {
  font-size: 11px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: middle;
}
.cell-actions {
  white-space: nowrap;
}
.cell-audit {
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-secondary);
}
.btn-action {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 4px;
}
.btn-action:hover {
  background: var(--surface-raised);
}
.btn-danger {
  color: #ef4444;
  border-color: #ef4444;
}
.btn-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Tabs */
.mgmt-tabs {
  display: flex;
  gap: 4px;
  background: var(--surface-raised);
  border-radius: 8px;
  padding: 3px;
}
.tab-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover {
  color: var(--text-primary);
}
.tab-btn.active {
  background: var(--surface-bg);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: var(--surface-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  width: 80vw;
  max-width: 800px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.dialog-wide {
  width: 80vw;
  max-width: 800px;
}
.dialog h2 {
  margin: 0 0 20px;
  font-size: 18px;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 600;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.form-group textarea {
  resize: vertical;
}
.form-group .mono {
  font-family: "SF Mono", "Cascadia Code", "Fira Code", monospace;
  font-size: 12px;
}
.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 20px;
}
.locale-section {
  margin: 12px 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
}
.locale-section summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.locale-field {
  margin-bottom: 10px;
}
.locale-field:last-child {
  margin-bottom: 0;
}
.locale-field-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 600;
}
.locale-input-row {
  display: flex;
  gap: 8px;
}
.locale-lang {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--text-muted);
  font-family: inherit;
}
.locale-lang input,
.locale-lang textarea {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  box-sizing: border-box;
}
.locale-lang textarea {
  resize: vertical;
}

/* Tool Creator */
.tc-content {
  min-height: 60vh;
}
.tc-panels {
  display: flex;
  gap: 16px;
  min-height: calc(100vh - 200px);
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
  box-sizing: border-box;
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
  background: var(--success, #22c55e);
  border: none;
  border-radius: 8px;
  color: #fff;
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
.tc-placeholder {
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
  margin-top: 40px;
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
  background: var(--error, #ef4444);
  border: none;
  border-radius: 8px;
  color: #fff;
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
  background: var(--accent);
  color: var(--accent-text, #fff);
}
.tc-output-tool_end .tc-output-type {
  background: var(--success, #22c55e);
  color: #fff;
}
.tc-output-error .tc-output-type {
  background: var(--error, #ef4444);
  color: #fff;
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
.tc-saved-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.tc-saved-header .tc-panel-title {
  margin: 0;
}
.btn-new {
  padding: 4px 12px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: var(--accent-text, #fff);
  font-size: 13px;
  cursor: pointer;
}
.tc-tool-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.tc-tool-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.tc-tool-item:hover {
  background: var(--surface-raised);
}
.tc-tool-item.active {
  background: var(--surface-raised);
  border: 1px solid var(--accent);
}
.tc-tool-name {
  flex: 1;
  min-width: 0;
}
.tc-tool-display-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.tc-tool-id {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tc-btn-delete {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.tc-btn-delete:hover {
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
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
