<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  fetchManageAgents,
  createManageAgent,
  updateManageAgent,
  deleteManageAgent,
  fetchProviders,
  generateAgentMetadata,
  saveGeneratedAgent,
  updateGeneratedAgent,
  executeAgentTrial,
} from "../api/client"
import type { GeneratedAgent, ManageAgent } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"
import { useAlertStore } from "../stores/alert"
import SearchSelect from "../components/SearchSelect.vue"

const { t, localeVal } = useI18nStore()
const alertStore = useAlertStore()

const activeTab = ref<"manage" | "create">("manage")

const providers = ref<string[]>([])

const providerOptions = computed(() =>
  providers.value.map(p => ({ value: p, label: p }))
)

const agents = ref<ManageAgent[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editing = ref(false)
const form = ref<Partial<ManageAgent>>({
  name: "",
  display_name: "",
  display_name_locale: "",
  description: "",
  description_locale: "",
  system_prompt: "",
  system_prompt_locale: "",
  endpoint_url: "",
  provider: "openai",
  model: "",
  llm_config: {},
})

const localeForm = ref({
  display_zh: "", display_en: "",
  desc_zh: "", desc_en: "",
  prompt_zh: "", prompt_en: "",
})

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
  const p = parseLocaleJson(form.value.system_prompt_locale)
  localeForm.value.prompt_zh = p.zh; localeForm.value.prompt_en = p.en
}

function applyLocaleToForm() {
  form.value.display_name_locale = composeLocaleJson(localeForm.value.display_zh, localeForm.value.display_en)
  form.value.description_locale = composeLocaleJson(localeForm.value.desc_zh, localeForm.value.desc_en)
  form.value.system_prompt_locale = composeLocaleJson(localeForm.value.prompt_zh, localeForm.value.prompt_en)
}

const searchQuery = ref("")
const currentPage = ref(1)
const pageSize = ref(15)
const total = ref(0)

const pageSizeOptions = [
  { value: 10, label: "10" },
  { value: 15, label: "15" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
]

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const saving = ref(false)

const llmConfigStr = ref("")

// Fullscreen overlay
const fsVisible = ref(false)
const fsTitle = ref("")
const fsContent = ref("")
let fsTarget: string | null = null

function openFs(title: string, content: string, target: string) {
  fsTitle.value = title
  fsContent.value = content
  fsTarget = target
  fsVisible.value = true
}

function closeFs() {
  if (fsTarget === "description") {
    form.value.description = fsContent.value
  } else if (fsTarget === "system_prompt") {
    form.value.system_prompt = fsContent.value
  } else if (fsTarget === "llm_config") {
    llmConfigStr.value = fsContent.value
  } else if (fsTarget === "locale_desc_zh") {
    localeForm.value.desc_zh = fsContent.value
  } else if (fsTarget === "locale_desc_en") {
    localeForm.value.desc_en = fsContent.value
  } else if (fsTarget === "locale_prompt_zh") {
    localeForm.value.prompt_zh = fsContent.value
  } else if (fsTarget === "locale_prompt_en") {
    localeForm.value.prompt_en = fsContent.value
  }
  fsVisible.value = false
  fsTarget = null
}

async function loadProviders() {
  try {
    providers.value = await fetchProviders()
  } catch {
    providers.value = ["openai", "anthropic"]
  }
}

async function load() {
  loading.value = true
  try {
    const resp = await fetchManageAgents({ q: searchQuery.value, page: currentPage.value, page_size: pageSize.value })
    agents.value = resp.items
    total.value = resp.total
  } catch (e) {
    alertStore.show("Failed to load agents: " + (e as Error).message)
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
  form.value = { name: "", display_name: "", display_name_locale: "", description: "", description_locale: "", system_prompt: "", system_prompt_locale: "", endpoint_url: "", provider: "openai", model: "", llm_config: {} }
  localeForm.value = { display_zh: "", display_en: "", desc_zh: "", desc_en: "", prompt_zh: "", prompt_en: "" }
  llmConfigStr.value = ""
  showDialog.value = true
}

function openEdit(a: ManageAgent) {
  editing.value = true
  form.value = { ...a }
  llmConfigStr.value = a.llm_config ? JSON.stringify(a.llm_config, null, 2) : ""
  loadLocaleFromForm()
  showDialog.value = true
}

async function save() {
  applyLocaleToForm()
  if (llmConfigStr.value.trim()) {
    try {
      form.value.llm_config = JSON.parse(llmConfigStr.value)
    } catch {
      alertStore.show("Invalid JSON in model config")
      return
    }
  } else {
    form.value.llm_config = {}
  }
  saving.value = true
  try {
    if (editing.value && form.value.name) {
      await updateManageAgent(form.value.name, form.value)
    } else {
      await createManageAgent(form.value)
    }
    showDialog.value = false
    await load()
  } catch (e) {
    alertStore.show("Failed to save: " + (e as Error).message)
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
  if (!await alertStore.confirm(t("alert_confirm_delete_agent", { name }))) return
  try {
    await deleteManageAgent(name)
    await load()
  } catch (e) {
    alertStore.show("Failed to delete: " + (e as Error).message)
  }
}

// ===== Agent Creator =====
const naturalDescription = ref("")
const generating = ref(false)
const savingCreator = ref(false)

const generated = ref<GeneratedAgent>({
  name: "",
  display_name: "",
  description: "",
  system_prompt: "",
  provider: "openai",
  model: "",
  llm_config: {},
  user_id: "",
  created_at: "",
  updated_at: "",
})
const creatorLlmConfigStr = ref("")

const genProgress = ref("")
const genAbortController = ref<AbortController | null>(null)

const showNL = ref(false)
const editingName = ref<string | null>(null)

// ===== Trial chat =====
const trialMessages = ref<{ role: "user" | "assistant"; content: string }[]>([])
const trialInput = ref("")
const executing = ref(false)
let trialAbort: AbortController | null = null

const creatorFsVisible = ref(false)
const creatorFsTitle = ref("")
const creatorFsContent = ref("")
let creatorFsTarget: "description" | "system_prompt" | "llm_config" | "natural_desc" | null = null

function openCreatorFs(title: string, content: string, target: "description" | "system_prompt" | "llm_config" | "natural_desc") {
  creatorFsTitle.value = title
  creatorFsContent.value = content
  creatorFsTarget = target
  creatorFsVisible.value = true
}

function closeCreatorFs() {
  if (creatorFsTarget === "description" && generated.value) {
    generated.value.description = creatorFsContent.value
  } else if (creatorFsTarget === "system_prompt" && generated.value) {
    generated.value.system_prompt = creatorFsContent.value
  } else if (creatorFsTarget === "llm_config") {
    creatorLlmConfigStr.value = creatorFsContent.value
  } else if (creatorFsTarget === "natural_desc") {
    naturalDescription.value = creatorFsContent.value
  }
  creatorFsVisible.value = false
  creatorFsTarget = null
}

function formatLlmConfigJson() {
  try {
    const parsed = JSON.parse(creatorFsContent.value)
    creatorFsContent.value = JSON.stringify(parsed, null, 2)
  } catch {
    alertStore.show(t("mgmt_tc_invalid_json"))
  }
}

function handleGenerate() {
  if (!naturalDescription.value.trim()) return
  generating.value = true
  genProgress.value = ""
  genAbortController.value = generateAgentMetadata(
    naturalDescription.value.trim(),
    (type, data) => {
      if (type === "generating") {
        genProgress.value = data.content_preview || data.message || ""
      } else if (type === "generated") {
        generated.value = data as unknown as GeneratedAgent
        creatorLlmConfigStr.value = generated.value.llm_config
          ? JSON.stringify(generated.value.llm_config, null, 2)
          : ""
        editingName.value = null
      } else if (type === "error") {
        alertStore.show(t("mgmt_tc_generation_error") + ": " + data.message)
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
      alertStore.show(t("mgmt_tc_generation_failed") + ": " + err.message)
    },
  )
}

function handleStopGenerate() {
  genAbortController.value?.abort()
  generating.value = false
  genProgress.value = ""
  genAbortController.value = null
}

async function handleSave() {
  if (!generated.value) return
  savingCreator.value = true
  try {
    let parsedLlmConfig: Record<string, any> = {}
    if (creatorLlmConfigStr.value.trim()) {
      try {
        parsedLlmConfig = JSON.parse(creatorLlmConfigStr.value)
      } catch {
        alertStore.show(t("mgmt_tc_invalid_json"))
        savingCreator.value = false
        return
      }
    }
    if (editingName.value) {
      await updateGeneratedAgent(editingName.value, {
        display_name: generated.value.display_name,
        description: generated.value.description,
        system_prompt: generated.value.system_prompt,
        provider: generated.value.provider,
        model: generated.value.model,
        llm_config: parsedLlmConfig,
      })
      alertStore.show(t("mgmt_tc_agent_updated"))
    } else {
      await saveGeneratedAgent({
        name: generated.value.name,
        display_name: generated.value.display_name,
        description: generated.value.description,
        system_prompt: generated.value.system_prompt,
        provider: generated.value.provider,
        model: generated.value.model,
        llm_config: parsedLlmConfig,
      })
      editingName.value = generated.value.name
      alertStore.show(t("mgmt_tc_agent_saved"))
    }
  } catch (e: any) {
    alertStore.show(t("mgmt_tc_save_failed") + ": " + e.message)
  } finally {
    savingCreator.value = false
  }
}

function handleTrialSend() {
  if (!trialInput.value.trim() || !generated.value) return
  const msg = trialInput.value.trim()
  trialInput.value = ""
  trialMessages.value.push({ role: "user", content: msg })

  executing.value = true
  let parsedLlmConfig: Record<string, any> = {}
  if (creatorLlmConfigStr.value.trim()) {
    try {
      parsedLlmConfig = JSON.parse(creatorLlmConfigStr.value)
    } catch { /* ignore */ }
  }

  trialAbort = executeAgentTrial(
    generated.value.name,
    msg,
    generated.value.system_prompt,
    generated.value.provider,
    generated.value.model,
    parsedLlmConfig,
    (type, data) => {
      if (type === "chunk") {
        const last = trialMessages.value[trialMessages.value.length - 1]
        if (last && last.role === "assistant") {
          last.content += data.content
        } else {
          trialMessages.value.push({ role: "assistant", content: data.content })
        }
      } else if (type === "error") {
        trialMessages.value.push({ role: "assistant", content: "Error: " + data.message })
      }
    },
    () => {
      executing.value = false
      trialAbort = null
    },
    (err) => {
      executing.value = false
      trialAbort = null
      trialMessages.value.push({ role: "assistant", content: "Error: " + err.message })
    },
  )
}

function handleTrialStop() {
  trialAbort?.abort()
  executing.value = false
  trialAbort = null
}

onMounted(() => {
  loadProviders()
  load()
})
</script>

<template>
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content">
      <header class="mgmt-header">
        <h1>{{ t("mgmt_agents") }}</h1>
        <div class="mgmt-tabs">
          <button :class="['tab-btn', { active: activeTab === 'manage' }]" @click="activeTab = 'manage'">{{ t("mgmt_tab_manage") }}</button>
          <button :class="['tab-btn', { active: activeTab === 'create' }]" @click="activeTab = 'create'">{{ t("mgmt_tab_create") }}</button>
        </div>
        <button v-if="activeTab === 'manage'" class="btn-primary" @click="openCreate">{{ t("mgmt_new_agent") }}</button>
      </header>

      <!-- ===== Manage Agents Tab ===== -->
      <div v-if="activeTab === 'manage'">
        <div class="mgmt-toolbar">
          <input v-model="searchQuery" class="mgmt-search" :placeholder="t('mgmt_search_placeholder')" @keyup.enter="onSearch" />
          <button class="btn-search" @click="onSearch">{{ t("mgmt_search") }}</button>
        </div>

        <div v-if="loading" class="mgmt-loading">{{ t("mgmt_loading") }}</div>
        <div v-else-if="agents.length === 0" class="mgmt-empty">{{ searchQuery ? t("mgmt_no_results") : t("mgmt_no_agents") }}</div>
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
                <tr v-for="a in agents" :key="a.name">
              <td><code>{{ a.name }}</code></td>
              <td>{{ localeVal(a.display_name_locale, a.display_name) }}</td>
              <td class="cell-desc">{{ localeVal(a.description_locale, a.description) }}</td>
              <td><code class="cell-url">{{ a.endpoint_url || t("mgmt_local") }}</code>
                <span v-if="!a.endpoint_url" class="badge badge-neutral" style="margin-left:6px">{{ t("mgmt_local") }}</span>
              </td>
              <td class="cell-audit">{{ fmtAudit(a.created_at, a.created_by) }}</td>
              <td class="cell-audit">{{ fmtAudit(a.updated_at, a.updated_by) }}</td>
              <td class="cell-actions">
                <button class="btn-action" @click="openEdit(a)">{{ t("mgmt_edit") }}</button>
                <button class="btn-action btn-danger" @click="remove(a.name)">{{ t("mgmt_delete") }}</button>
              </td>
            </tr>
          </tbody>
        </table>
          </div>
          <div class="mgmt-pagination">
            <button class="btn-page" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">{{ t("mgmt_prev_page") }}</button>
            <span class="mgmt-page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button class="btn-page" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">{{ t("mgmt_next_page") }}</button>
            <SearchSelect v-model.number="pageSize" :options="pageSizeOptions" :searchable="false" @change="onPageSizeChange" />
          </div>
        </div>

        <Teleport to="body">
          <div v-if="showDialog" class="dialog-overlay" @click.self="showDialog = false">
            <div class="dialog dialog-wide">
              <h2>{{ editing ? t("mgmt_edit_agent") : t("mgmt_new_agent_title") }}</h2>
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
                  <button class="tc-fullscreen-btn" @click="openFs(t('mgmt_description'), form.description ?? '', 'description')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                </div>
                <textarea v-model="form.description" rows="2"></textarea>
              </div>
              <div class="form-group">
                <div class="tc-label-row">
                  <label>{{ t("mgmt_system_prompt") }}</label>
                  <button class="tc-fullscreen-btn" @click="openFs(t('mgmt_system_prompt'), form.system_prompt ?? '', 'system_prompt')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                </div>
                <textarea v-model="form.system_prompt" rows="6" class="mono"></textarea>
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_endpoint") }}</label>
                <input v-model="form.endpoint_url" :placeholder="t('mgmt_placeholder_endpoint')" />
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_provider") }}</label>
                <SearchSelect v-model="form.provider" :options="providerOptions" :searchable="false" />
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_model") }}</label>
                <input v-model="form.model" :placeholder="t('mgmt_model_placeholder')" />
              </div>
              <details class="locale-section">
                <summary>{{ t("mgmt_llm_config") }}</summary>
                <div class="form-group">
                  <div class="tc-label-row">
                    <span></span>
                    <button class="tc-fullscreen-btn" @click="openFs(t('mgmt_llm_config'), llmConfigStr, 'llm_config')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                  </div>
                  <textarea v-model="llmConfigStr" rows="4" class="mono" :placeholder="t('mgmt_llm_config_placeholder')"></textarea>
                </div>
              </details>
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
                    <label class="locale-lang">zh <button class="tc-fullscreen-btn" @click="openFs('zh ' + t('mgmt_locale_desc'), localeForm.desc_zh, 'locale_desc_zh')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.desc_zh" rows="2" placeholder="中文描述"></textarea></label>
                    <label class="locale-lang">en <button class="tc-fullscreen-btn" @click="openFs('en ' + t('mgmt_locale_desc'), localeForm.desc_en, 'locale_desc_en')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.desc_en" rows="2" :placeholder="t('mgmt_placeholder_desc')"></textarea></label>
                  </div>
                </div>
                <div class="locale-field">
                  <div class="locale-field-label">{{ t("mgmt_locale_prompt") }}</div>
                  <div class="locale-input-row">
                    <label class="locale-lang">zh <button class="tc-fullscreen-btn" @click="openFs('zh ' + t('mgmt_locale_prompt'), localeForm.prompt_zh, 'locale_prompt_zh')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.prompt_zh" rows="3" placeholder="中文系统提示"></textarea></label>
                    <label class="locale-lang">en <button class="tc-fullscreen-btn" @click="openFs('en ' + t('mgmt_locale_prompt'), localeForm.prompt_en, 'locale_prompt_en')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.prompt_en" rows="3" :placeholder="t('mgmt_placeholder_prompt')"></textarea></label>
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

        <Teleport to="body">
          <div v-if="fsVisible" class="tc-overlay" @click.self="closeFs">
            <div class="tc-overlay-content">
              <div class="tc-overlay-header">
                <span class="tc-overlay-title">{{ fsTitle }}</span>
                <div class="tc-overlay-header-actions">
                  <button class="tc-fullscreen-close" @click="closeFs">&#x2715;</button>
                </div>
              </div>
              <div class="tc-overlay-body">
                <textarea
                  v-model="fsContent"
                  :class="fsTarget === 'system_prompt' || fsTarget === 'llm_config' || fsTarget?.startsWith('locale_prompt') ? 'tc-overlay-textarea' : 'tc-overlay-textarea tc-overlay-textarea-text'"
                  spellcheck="false"
                />
              </div>
            </div>
          </div>
        </Teleport>
      </div>

      <!-- ===== Agent Creator Tab ===== -->
      <div v-else class="tc-content">
        <div class="tc-panels">
          <div class="tc-panel tc-left">
            <div class="tc-nl-section">
              <button class="tc-nl-toggle" @click="showNL = !showNL">
                <span class="tc-nl-toggle-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tc-nl-icon">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {{ t("mgmt_ac_describe_nl") }}
                </span>
                <span class="tc-nl-arrow">{{ showNL ? '▲' : '▼' }}</span>
              </button>
              <div v-if="showNL" class="tc-nl-body">
                <div class="tc-label-row">
                  <span></span>
                  <button class="tc-fullscreen-btn" @click="openCreatorFs(t('mgmt_ac_describe_nl'), naturalDescription, 'natural_desc')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
                </div>
                <textarea
                  v-model="naturalDescription"
                  class="tc-textarea"
                  :placeholder="t('mgmt_ac_describe_placeholder')"
                  rows="3"
                />
                <template v-if="!generating">
                  <button class="btn-generate" :disabled="!naturalDescription.trim()" @click="handleGenerate">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    {{ t("mgmt_ac_generate_metadata") }}
                  </button>
                </template>
                <template v-else>
                  <button class="btn-stop" @click="handleStopGenerate">{{ t("mgmt_tc_stop_generation") }}</button>
                  <div v-if="genProgress" class="tc-gen-progress">
                    <div class="tc-gen-progress-label">{{ t("mgmt_tc_generating") }}</div>
                    <pre class="tc-gen-progress-text">{{ genProgress }}</pre>
                  </div>
                </template>
              </div>
            </div>

            <h2 class="tc-panel-title">{{ t("mgmt_ac_agent_metadata") }}</h2>
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
                <button class="tc-fullscreen-btn" @click="openCreatorFs(t('mgmt_description'), generated.description, 'description')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
              </div>
              <textarea v-model="generated.description" class="tc-input tc-textarea-sm" rows="3" />
            </div>
            <div class="tc-field">
              <div class="tc-label-row">
                <label class="tc-label">{{ t("mgmt_system_prompt") }}</label>
                <button class="tc-fullscreen-btn" @click="openCreatorFs(t('mgmt_system_prompt'), generated.system_prompt, 'system_prompt')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
              </div>
              <textarea v-model="generated.system_prompt" class="tc-input tc-textarea-code" rows="8" />
            </div>
            <div class="tc-field">
              <label class="tc-label">{{ t("mgmt_provider") }}</label>
              <input v-model="generated.provider" type="text" class="tc-input" />
            </div>
            <div class="tc-field">
              <label class="tc-label">{{ t("mgmt_model") }}</label>
              <input v-model="generated.model" type="text" class="tc-input" :placeholder="t('mgmt_model_placeholder')" />
            </div>
            <div class="tc-field">
              <div class="tc-label-row">
                <label class="tc-label">{{ t("mgmt_llm_config") }}</label>
                <button class="tc-fullscreen-btn" @click="openCreatorFs(t('mgmt_llm_config'), creatorLlmConfigStr, 'llm_config')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
              </div>
              <textarea v-model="creatorLlmConfigStr" class="tc-input tc-textarea-code" rows="4" :placeholder="t('mgmt_llm_config_placeholder')" />
            </div>
            <div class="tc-actions">
              <button class="btn-save" :disabled="savingCreator || !generated.name" @click="handleSave">
                {{ savingCreator ? (editingName ? t("mgmt_tc_updating") : t("mgmt_saving")) : (editingName ? t("mgmt_ac_update_agent") : t("mgmt_ac_save_agent")) }}
              </button>
            </div>
          </div>

          <div class="tc-panel tc-right">
            <h2 class="tc-panel-title">{{ t("mgmt_tc_trial_area") }}</h2>
            <div class="ta-messages">
              <div v-if="trialMessages.length === 0" class="ta-empty">{{ t("mgmt_ac_trial_empty") }}</div>
              <div v-for="(m, i) in trialMessages" :key="i" :class="['ta-msg', `ta-msg-${m.role}`]">
                <div class="ta-msg-label">{{ m.role === 'user' ? t('mgmt_ac_trial_you') : t('mgmt_ac_trial_agent') }}</div>
                <div class="ta-msg-content">{{ m.content }}</div>
              </div>
              <div v-if="executing && trialMessages[trialMessages.length - 1]?.role === 'user'" class="ta-msg ta-msg-assistant">
                <div class="ta-msg-label">{{ t("mgmt_ac_trial_agent") }}</div>
                <div class="ta-msg-content ta-msg-thinking">{{ t("mgmt_tc_waiting_output") }}</div>
              </div>
            </div>
            <div class="ta-input-row">
              <input v-model="trialInput" class="ta-input" :placeholder="t('mgmt_ac_trial_placeholder')" :disabled="executing" @keyup.enter="handleTrialSend" />
              <button v-if="!executing" class="btn-send" :disabled="!trialInput.trim() || !generated.name" @click="handleTrialSend">{{ t("send") }}</button>
              <button v-else class="btn-stop" @click="handleTrialStop">{{ t("stop") }}</button>
            </div>
          </div>
        </div>

        <!-- Creator Fullscreen Overlays -->
        <Teleport to="body">
          <div v-if="creatorFsVisible" class="tc-overlay" @click.self="closeCreatorFs()">
            <div class="tc-overlay-content">
              <div class="tc-overlay-header">
                <span class="tc-overlay-title">{{ creatorFsTitle }}</span>
                <div class="tc-overlay-header-actions">
                  <button v-if="creatorFsTarget === 'llm_config'" class="tc-format-btn" @click="formatLlmConfigJson">{{ t("mgmt_tc_format_json") }}</button>
                  <button class="tc-fullscreen-close" @click="closeCreatorFs()">&#x2715;</button>
                </div>
              </div>
              <div class="tc-overlay-body">
                <textarea
                  v-model="creatorFsContent"
                  :class="creatorFsTarget === 'system_prompt' || creatorFsTarget === 'llm_config' ? 'tc-overlay-textarea' : 'tc-overlay-textarea tc-overlay-textarea-text'"
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
/* Trial chat area */
.ta-messages {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 200px;
  max-height: 400px;
}
.ta-empty {
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  padding: 48px 16px;
}
.ta-msg {
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.ta-msg-user {
  background: var(--accent-dim);
  align-self: flex-end;
  max-width: 85%;
}
.ta-msg-assistant {
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  align-self: flex-start;
  max-width: 85%;
}
.ta-msg-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.ta-msg-content {
  white-space: pre-wrap;
  word-break: break-word;
}
.ta-msg-thinking {
  color: var(--text-muted);
  font-style: italic;
}
.ta-input-row {
  display: flex;
  gap: 8px;
}
.ta-input {
  flex: 1;
  padding: 9px 12px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.ta-input:focus {
  outline: none;
  border-color: var(--accent);
}
.ta-input:disabled {
  opacity: 0.5;
}
.btn-send {
  padding: 9px 18px;
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-send:hover:not(:disabled) { opacity: 0.9; }
.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

