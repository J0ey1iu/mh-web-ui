<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  fetchManageTools,
  createManageTool,
  updateManageTool,
  deleteManageTool,
  generateToolMetadata,
  saveGeneratedTool,
  updateGeneratedTool,
  executeGeneratedTool,
} from "../api/client"
import type { ManageTool, GeneratedTool } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"

const { t, localeVal } = useI18nStore()

const activeTab = ref<"manage" | "create">("manage")

// ===== Manage Tools =====
const tools = ref<ManageTool[]>([])
const loading = ref(false)

const searchQuery = ref("")
const currentPage = ref(1)
const pageSize = ref(15)
const total = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

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
  source_code: "",
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

// ===== Management Dialog Fullscreen =====
const mgmtFs = ref(false)
const mgmtFsTitle = ref("")
const mgmtFsContent = ref("")
let mgmtFsTarget: "description" | "parameters" | "source_code" | "locale_desc_zh" | "locale_desc_en" | null = null

function openMgmtFs(title: string, content: string, target: "description" | "parameters" | "source_code" | "locale_desc_zh" | "locale_desc_en") {
  mgmtFsTitle.value = title
  mgmtFsContent.value = content
  mgmtFsTarget = target
  mgmtFs.value = true
}

function closeMgmtFs() {
  if (mgmtFsTarget === "description" && form.value) {
    form.value.description = mgmtFsContent.value
  } else if (mgmtFsTarget === "parameters") {
    parametersText.value = mgmtFsContent.value
  } else if (mgmtFsTarget === "source_code" && form.value) {
    form.value.source_code = mgmtFsContent.value
  } else if (mgmtFsTarget === "locale_desc_zh") {
    localeForm.value.desc_zh = mgmtFsContent.value
  } else if (mgmtFsTarget === "locale_desc_en") {
    localeForm.value.desc_en = mgmtFsContent.value
  }
  mgmtFs.value = false
  mgmtFsTarget = null
}

function formatMgmtFsJson() {
  try {
    const parsed = JSON.parse(mgmtFsContent.value)
    mgmtFsContent.value = JSON.stringify(parsed, null, 2)
  } catch {
    alert(t("mgmt_tc_invalid_json"))
  }
}

async function load() {
  loading.value = true
  try {
    const resp = await fetchManageTools({ q: searchQuery.value, page: currentPage.value, page_size: pageSize.value })
    tools.value = resp.items
    total.value = resp.total
  } catch (e) {
    alert("Failed to load tools: " + (e as Error).message)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  currentPage.value = 1
  load()
}

function goToPage(page: number) {
  currentPage.value = page
  load()
}

function onPageSizeChange() {
  currentPage.value = 1
  load()
}

function openCreate() {
  editing.value = false
  form.value = { name: "", display_name: "", display_name_locale: "", description: "", description_locale: "", parameters: { type: "object", properties: {}, required: [] }, endpoint_url: "", source_code: "" }
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
let fullscreenTextTarget: "description" | "parameters" | "natural_desc" | null = null

function openTextFullscreen(title: string, content: string, target: "description" | "parameters" | "natural_desc") {
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
  } else if (fullscreenTextTarget === "natural_desc") {
    naturalDescription.value = fullscreenTextContent.value
  }
  fullscreenText.value = false
  fullscreenTextTarget = null
}

function formatParametersJson() {
  try {
    const parsed = JSON.parse(fullscreenTextContent.value)
    fullscreenTextContent.value = JSON.stringify(parsed, null, 2)
  } catch {
    alert(t("mgmt_tc_invalid_json"))
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
        creatorParametersText.value = JSON.stringify(
          (generated.value as any).parameters,
          null,
          2,
        )
        editingName.value = null
        initTrialArgs()
      } else if (type === "error") {
        alert(t("mgmt_tc_generation_error") + ": " + data.message)
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
      alert(t("mgmt_tc_generation_failed") + ": " + err.message)
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
      alert(t("mgmt_tc_invalid_json"))
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
      alert(t("mgmt_tc_tool_updated"))
    } else {
      await saveGeneratedTool({
        name: generated.value.name,
        display_name: generated.value.display_name,
        description: generated.value.description,
        parameters: parsedParameters,
        source_code: generated.value.source_code,
      })
      editingName.value = generated.value.name
      alert(t("mgmt_tc_tool_saved"))
    }
  } catch (e: any) {
    alert(t("mgmt_tc_save_failed") + ": " + e.message)
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
      alert(t("mgmt_tc_execution_error") + ": " + err.message)
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
        <button v-if="activeTab === 'manage'" class="btn-primary" @click="openCreate">{{ t("mgmt_new_tool") }}</button>
      </header>

      <!-- ===== Manage Tools Tab ===== -->
      <div v-if="activeTab === 'manage'">
        <div class="mgmt-toolbar">
          <input v-model="searchQuery" class="mgmt-search" :placeholder="t('mgmt_search_placeholder')" @keyup.enter="onSearch" />
          <button class="btn-search" @click="onSearch">{{ t("mgmt_search") }}</button>
        </div>

        <div v-if="loading" class="mgmt-loading">{{ t("mgmt_loading") }}</div>
        <div v-else-if="tools.length === 0" class="mgmt-empty">{{ searchQuery ? t("mgmt_no_results") : t("mgmt_no_tools") }}</div>
        <div v-else>
          <div class="table-wrap">
            <table class="mgmt-table">
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
          </div>
          <div class="mgmt-pagination">
            <button class="btn-page" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">{{ t("mgmt_prev_page") }}</button>
            <span class="mgmt-page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button class="btn-page" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">{{ t("mgmt_next_page") }}</button>
            <select v-model.number="pageSize" class="mgmt-page-size" @change="onPageSizeChange">
              <option :value="10">10</option>
              <option :value="15">15</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </div>
        </div>

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
                <div class="tc-label-row">
                  <label>{{ t("mgmt_description") }}</label>
                  <button class="tc-fullscreen-btn" @click="openMgmtFs(t('mgmt_description'), form.description ?? '', 'description')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                </div>
                <textarea v-model="form.description" rows="2"></textarea>
              </div>
              <div class="form-group">
                <div class="tc-label-row">
                  <label>{{ t("mgmt_parameters") }}</label>
                  <button class="tc-fullscreen-btn" @click="openMgmtFs(t('mgmt_parameters'), parametersText, 'parameters')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                </div>
                <textarea v-model="parametersText" rows="6" class="mono" @blur="applyParametersJson"></textarea>
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_endpoint") }}</label>
                <input v-model="form.endpoint_url" :placeholder="t('mgmt_placeholder_endpoint')" />
              </div>
              <div class="form-group">
                <div class="tc-label-row">
                  <label>{{ t("mgmt_tc_source_code") }}</label>
                  <button class="tc-fullscreen-btn" @click="openMgmtFs(t('mgmt_tc_source_code'), form.source_code ?? '', 'source_code')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                </div>
                <textarea v-model="form.source_code" rows="6" class="mono" spellcheck="false" :placeholder="t('mgmt_tc_source_code_placeholder')" />
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
                    <label class="locale-lang">zh <button class="tc-fullscreen-btn" @click="openMgmtFs('zh ' + t('mgmt_locale_desc'), localeForm.desc_zh, 'locale_desc_zh')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.desc_zh" rows="2" placeholder="中文描述"></textarea></label>
                    <label class="locale-lang">en <button class="tc-fullscreen-btn" @click="openMgmtFs('en ' + t('mgmt_locale_desc'), localeForm.desc_en, 'locale_desc_en')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.desc_en" rows="2" :placeholder="t('mgmt_placeholder_desc')"></textarea></label>
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

        <!-- Mgmt Dialog Fullscreen Overlay -->
        <Teleport to="body">
          <div v-if="mgmtFs" class="tc-overlay" @click.self="closeMgmtFs()">
            <div class="tc-overlay-content">
              <div class="tc-overlay-header">
                <span class="tc-overlay-title">{{ mgmtFsTitle }}</span>
                <div class="tc-overlay-header-actions">
                  <button v-if="mgmtFsTarget === 'parameters'" class="tc-format-btn" @click="formatMgmtFsJson">{{ t("mgmt_tc_format_json") }}</button>
                  <button class="tc-fullscreen-close" @click="closeMgmtFs()">&#x2715;</button>
                </div>
              </div>
              <div class="tc-overlay-body">
                <textarea v-model="mgmtFsContent" class="tc-overlay-textarea" spellcheck="false" />
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
                <span class="tc-nl-toggle-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tc-nl-icon">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {{ t("mgmt_tc_describe_nl") }}
                </span>
                <span class="tc-nl-arrow">{{ showNL ? '▲' : '▼' }}</span>
              </button>
              <div v-if="showNL" class="tc-nl-body">
                <div class="tc-label-row">
                  <span></span>
                  <button class="tc-fullscreen-btn" @click="openTextFullscreen(t('mgmt_tc_describe_nl'), naturalDescription, 'natural_desc')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                </div>
                <textarea
                  v-model="naturalDescription"
                  class="tc-textarea"
                  :placeholder="t('mgmt_tc_describe_placeholder')"
                  rows="3"
                />
                <template v-if="!generating">
                  <button
                    class="btn-generate"
                    :disabled="!naturalDescription.trim()"
                    @click="handleGenerate"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    {{ t("mgmt_tc_generate_metadata") }}
                  </button>
                </template>
                <template v-else>
                  <button class="btn-stop" @click="handleStopGenerate">
                    {{ t("mgmt_tc_stop_generation") }}
                  </button>
                  <div v-if="genProgress" class="tc-gen-progress">
                    <div class="tc-gen-progress-label">{{ t("mgmt_tc_generating") }}</div>
                    <pre class="tc-gen-progress-text">{{ genProgress }}</pre>
                  </div>
                </template>
              </div>
            </div>

            <h2 class="tc-panel-title">{{ t("mgmt_tc_tool_metadata") }}</h2>
            <div class="tc-field">
              <label class="tc-label">{{ t("mgmt_name") }}</label>
              <input v-model="generated.name" type="text" class="tc-input" />
            </div>
            <div class="tc-field">
              <label class="tc-label">{{ t("mgmt_display_name") }}</label>
              <input v-model="generated.display_name" type="text" class="tc-input" />
            </div>
            <div class="tc-field">
              <div class="tc-label-row">
                <label class="tc-label">{{ t("mgmt_description") }}</label>
                <button class="tc-fullscreen-btn" @click="openTextFullscreen(t('mgmt_description'), generated.description, 'description')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
              </div>
              <textarea v-model="generated.description" class="tc-input tc-textarea-sm" rows="3" />
            </div>
            <div class="tc-field">
              <div class="tc-label-row">
                <label class="tc-label">{{ t("mgmt_tc_params_json_schema") }}</label>
                <button class="tc-fullscreen-btn" @click="openTextFullscreen(t('mgmt_tc_params_json_schema'), creatorParametersText, 'parameters')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
              </div>
              <textarea v-model="creatorParametersText" class="tc-input tc-textarea-code" rows="8" />
            </div>
            <div class="tc-field">
              <div class="tc-label-row">
                <label class="tc-label">{{ t("mgmt_tc_source_code") }}</label>
                <button class="tc-fullscreen-btn" @click="openCodeFullscreen()" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
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
                {{ savingCreator ? (editingName ? t("mgmt_tc_updating") : t("mgmt_saving")) : (editingName ? t("mgmt_tc_update_tool") : t("mgmt_tc_save_tool")) }}
              </button>
            </div>

          </div>

          <div class="tc-panel tc-right">
            <h2 class="tc-panel-title">{{ t("mgmt_tc_trial_area") }}</h2>
            <h3 class="tc-subtitle">{{ t("mgmt_parameters") }}</h3>
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
              <button v-if="!executing" class="btn-run" @click="handleExecute">{{ t("mgmt_tc_run") }}</button>
              <button v-else class="btn-stop" @click="handleStop">{{ t("stop") }}</button>
            </div>

            <h3 class="tc-subtitle">{{ t("mgmt_tc_output") }}</h3>
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
                {{ t("mgmt_tc_waiting_output") }}
              </div>
            </div>
          </div>
        </div>

        <!-- Fullscreen Code Overlay -->
        <Teleport to="body">
          <div v-if="fullscreenCode" class="tc-overlay" @click.self="closeCodeFullscreen()">
            <div class="tc-overlay-content">
              <div class="tc-overlay-header">
                <span class="tc-overlay-title">{{ t("mgmt_tc_source_code") }}</span>
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
                    v-if="fullscreenTextTarget === 'parameters'"
                    class="tc-format-btn"
                    @click="formatParametersJson"
                  >
                    {{ t("mgmt_tc_format_json") }}
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
/* Tool Creator */
.tc-content {
  min-height: 60vh;
}
.tc-panels {
  display: flex;
  gap: 18px;
  min-height: calc(100vh - 220px);
}
.tc-panel {
  flex: 1;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  overflow-y: auto;
}
.tc-panel-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 18px;
  letter-spacing: -0.2px;
}
.tc-textarea {
  width: 100%;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 10px 12px;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
  line-height: 1.5;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tc-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.tc-textarea::placeholder { color: var(--text-muted); }
.tc-textarea-sm {
  min-height: 64px;
}
.tc-textarea-code {
  min-height: 120px;
  font-family: "SF Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, monospace;
  font-size: 12px;
}
.tc-textarea-code-source {
  min-height: 200px;
  font-family: "SF Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, monospace;
  font-size: 12px;
}
.tc-actions {
  margin-top: 18px;
}
.btn-save {
  width: 100%;
  padding: 10px 24px;
  background: var(--success, #22c55e);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-save:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-save:active:not(:disabled) { transform: translateY(0); }
.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
.btn-generate {
  width: 100%;
  margin-top: 12px;
  padding: 10px 24px;
  background: var(--accent);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-generate:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-generate:active:not(:disabled) { transform: translateY(0); }
.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
.tc-field {
  margin-bottom: 14px;
}
.tc-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}
.tc-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tc-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.tc-input:disabled {
  opacity: 0.5;
}
.tc-input::placeholder { color: var(--text-muted); }
.tc-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
}
.tc-subtitle {
  font-size: 14px;
  font-weight: 700;
  margin: 20px 0 10px;
  color: var(--text-primary);
}
.tc-trial-actions {
  margin-top: 16px;
}
.btn-run {
  width: 100%;
  padding: 10px 24px;
  background: var(--accent);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-run:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-run:active { transform: translateY(0); }
.btn-stop {
  width: 100%;
  padding: 10px 24px;
  background: var(--error, #ef4444);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-stop:hover { opacity: 0.9; }
.tc-output {
  margin-top: 10px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 12px;
  min-height: 100px;
  max-height: 320px;
  overflow-y: auto;
}
.tc-output-item {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--glass-border);
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
  padding: 2px 8px;
  border-radius: 5px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.tc-output-tool_progress .tc-output-type {
  background: var(--accent);
  color: #fff;
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
  line-height: 1.5;
}
.tc-output-waiting {
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
  padding: 24px;
}
.tc-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 24px 0;
}
.tc-nl-section {
  margin-bottom: 20px;
}
.tc-nl-toggle {
  width: 100%;
  padding: 10px 14px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.15s;
  font-family: inherit;
}
.tc-nl-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--glass-highlight);
}
.tc-nl-toggle-text {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tc-nl-icon {
  flex-shrink: 0;
  opacity: 0.6;
}
.tc-nl-arrow {
  font-size: 10px;
  opacity: 0.5;
  transition: transform 0.15s;
}
.tc-nl-body {
  margin-top: 10px;
}
.tc-gen-progress {
  margin-top: 12px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 12px;
}
.tc-gen-progress-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tc-gen-progress-label::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: tc-pulse 1.2s ease-in-out infinite;
}
@keyframes tc-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}
.tc-gen-progress-text {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
  line-height: 1.5;
}
@media (max-width: 768px) {
  .tc-panels {
    flex-direction: column;
  }
  .tc-panel {
    min-height: auto;
  }
}
</style>
