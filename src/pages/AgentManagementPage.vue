<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue"
import {
  fetchManageAgents,
  createManageAgent,
  updateManageAgent,
  deleteManageAgent,
  fetchManageProviderConfigs,
} from "../api/client"
import type { ManageAgent, ManageProvider } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"
import { useAlertStore } from "../stores/alert"
import SearchSelect from "../components/SearchSelect.vue"

const { t, localeVal } = useI18nStore()
const alertStore = useAlertStore()

const providers = ref<ManageProvider[]>([])

const providerOptions = computed(() =>
  providers.value.map(p => ({ value: p.name, label: p.name }))
)

const selectedProvider = computed(() =>
  providers.value.find(p => p.name === form.value.provider)
)

const modelOptions = computed(() => {
  const p = selectedProvider.value
  if (!p || !p.models || p.models.length === 0) return []
  return p.models.map(m => ({
    value: m.code || m.id,
    label: m.display_name || m.code || m.id,
  })
)})

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
  provider: "openai",
  model: "",
  llm_config: {},
  agent_type: "simple",
})

watch(() => form.value.provider, () => {
  const opts = modelOptions.value
  if (opts.length > 0 && !opts.some(o => o.value === form.value.model)) {
    form.value.model = opts[0].value
  }
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

/* Agent type config registry — add new types here */
interface AgentTypeSettingField {
  key: string
  labelKey: string
  type: "number" | "string"
  placeholderKey?: string
  min?: number
  max?: number
  step?: number
}

interface AgentTypeConfig {
  value: string
  labelKey: string
  settingsKey?: string
  settingsTitleKey?: string
  settingsFields?: AgentTypeSettingField[]
}

const agentTypeConfigs: Record<string, AgentTypeConfig> = {
  simple: { value: "simple", labelKey: "mgmt_agent_type_simple" },
  dummy: { value: "dummy", labelKey: "mgmt_agent_type_dummy" },
  compacting: {
    value: "compacting",
    labelKey: "mgmt_agent_type_compacting",
    settingsKey: "compaction",
    settingsTitleKey: "mgmt_compaction_settings",
    settingsFields: [
      { key: "prompt_token_threshold", labelKey: "mgmt_compaction_threshold", type: "number", placeholderKey: "mgmt_compaction_threshold_placeholder", min: 0 },
      { key: "keep_recent", labelKey: "mgmt_compaction_keep_recent", type: "number", placeholderKey: "mgmt_compaction_keep_recent_placeholder", min: 0 },
    ],
  },
}

const agentSettings = ref<Record<string, any>>({})

const currentAgentTypeConfig = computed(() => agentTypeConfigs[form.value.agent_type ?? "simple"] ?? agentTypeConfigs.simple)

const agentTypeOptions = computed(() =>
  Object.values(agentTypeConfigs).map(c => ({ value: c.value, label: t(c.labelKey) }))
)

function loadAgentSettingsFromForm() {
  const config = currentAgentTypeConfig.value
  if (config.settingsKey && config.settingsFields) {
    const raw = (form.value as any)[config.settingsKey] ?? {}
    const loaded: Record<string, any> = {}
    for (const field of config.settingsFields) {
      loaded[field.key] = raw[field.key] ?? undefined
    }
    agentSettings.value = loaded
  } else {
    agentSettings.value = {}
  }
}

function applyAgentSettingsToForm() {
  for (const c of Object.values(agentTypeConfigs)) {
    if (c.settingsKey) {
      delete (form.value as any)[c.settingsKey]
    }
  }
  const config = currentAgentTypeConfig.value
  if (config.settingsKey && config.settingsFields) {
    const c: Record<string, any> = {}
    for (const field of config.settingsFields) {
      const val = agentSettings.value[field.key]
      if (val !== undefined && val !== null && val !== "") {
        c[field.key] = field.type === "number" ? Number(val) : val
      }
    }
    if (Object.keys(c).length > 0) {
      (form.value as any)[config.settingsKey] = c
    }
  }
}

watch(() => form.value.agent_type, () => {
  agentSettings.value = {}
  loadAgentSettingsFromForm()
})

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
    const res = await fetchManageProviderConfigs({ page_size: 100 })
    providers.value = res.items
  } catch {
    providers.value = [{ name: "openai", provider_type: "openai" }, { name: "anthropic", provider_type: "anthropic" }] as ManageProvider[]
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
  form.value = { name: "", display_name: "", display_name_locale: "", description: "", description_locale: "", system_prompt: "", system_prompt_locale: "", provider: "openai", model: "", llm_config: {}, agent_type: "simple" }
  localeForm.value = { display_zh: "", display_en: "", desc_zh: "", desc_en: "", prompt_zh: "", prompt_en: "" }
  llmConfigStr.value = ""
  agentSettings.value = {}
  showDialog.value = true
}

function openEdit(a: ManageAgent) {
  editing.value = true
  form.value = { ...a }
  llmConfigStr.value = a.llm_config ? JSON.stringify(a.llm_config, null, 2) : ""
  loadLocaleFromForm()
  loadAgentSettingsFromForm()
  showDialog.value = true
}

async function save() {
  applyLocaleToForm()
  applyAgentSettingsToForm()
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
        <button class="btn-primary" @click="openCreate">{{ t("mgmt_new_agent") }}</button>
      </header>

      <!-- ===== Manage Agents ===== -->
      <div>
        <div class="mgmt-toolbar">
          <input v-model="searchQuery" class="mgmt-search" :placeholder="t('mgmt_search_placeholder')" @keyup.enter="onSearch" />
          <button class="btn-search" @click="onSearch">{{ t("mgmt_search") }}</button>
        </div>

        <div v-if="loading" class="table-wrap">
          <table class="mgmt-table">
            <thead>
              <tr>
                <th>{{ t("mgmt_name") }}</th>
                <th>{{ t("mgmt_display_name") }}</th>
                <th>{{ t("mgmt_description") }}</th>
                <th>{{ t("mgmt_created_at") }}</th>
                <th>{{ t("mgmt_updated_at") }}</th>
                <th>{{ t("mgmt_actions") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in 5" :key="i" class="mgmt-skeleton-row">
                <td><div class="mgmt-skeleton-cell" style="width:60%"></div></td>
                <td><div class="mgmt-skeleton-cell" style="width:50%"></div></td>
                <td><div class="mgmt-skeleton-cell" style="width:70%"></div></td>
                <td><div class="mgmt-skeleton-cell" style="width:50%"></div></td>
                <td><div class="mgmt-skeleton-cell mgmt-skeleton-cell-sm" style="width:65%"></div></td>
                <td><div class="mgmt-skeleton-cell mgmt-skeleton-cell-sm" style="width:65%"></div></td>
                <td><div class="mgmt-skeleton-cell" style="width:50%"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="agents.length === 0" class="mgmt-empty">{{ searchQuery ? t("mgmt_no_results") : t("mgmt_no_agents") }}</div>
        <div v-else>
          <div class="table-wrap">
            <table class="mgmt-table">
              <thead>
                <tr>
                  <th>{{ t("mgmt_name") }}</th>
                  <th>{{ t("mgmt_display_name") }}</th>
                  <th>{{ t("mgmt_description") }}</th>
                  <th>{{ t("mgmt_created_at") }}</th>
                  <th>{{ t("mgmt_updated_at") }}</th>
                  <th>{{ t("mgmt_actions") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in agents" :key="a.name">
              <td :title="a.name"><code>{{ a.name }}</code></td>
              <td :title="localeVal(a.display_name_locale, a.display_name)">{{ localeVal(a.display_name_locale, a.display_name) }}</td>
              <td class="cell-desc" :title="localeVal(a.description_locale, a.description)">{{ localeVal(a.description_locale, a.description) }}</td>
              <td class="cell-audit" :title="fmtAudit(a.created_at, a.created_by)">{{ fmtAudit(a.created_at, a.created_by) }}</td>
              <td class="cell-audit" :title="fmtAudit(a.updated_at, a.updated_by)">{{ fmtAudit(a.updated_at, a.updated_by) }}</td>
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
          <div v-if="showDialog" class="dialog-overlay" @mousedown.self="showDialog = false">
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
                <label>{{ t("mgmt_provider") }}</label>
                <SearchSelect v-model="form.provider" :options="providerOptions" :searchable="false" />
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_model") }}</label>
                <SearchSelect v-model="form.model" :options="modelOptions" :searchable="true" :placeholder="t('mgmt_model_placeholder')" />
              </div>
              <div class="form-group">
                <label>{{ t("mgmt_agent_type") }}</label>
                <SearchSelect v-model="form.agent_type" :options="agentTypeOptions" :searchable="false" />
              </div>
              <template v-if="currentAgentTypeConfig.settingsFields">
                <details class="locale-section" open>
                  <summary>{{ t(currentAgentTypeConfig.settingsTitleKey!) }}</summary>
                  <div class="form-group" v-for="field in currentAgentTypeConfig.settingsFields" :key="field.key">
                    <label>{{ t(field.labelKey) }}</label>
                    <input
                      v-if="field.type === 'number'"
                      v-model.number="agentSettings[field.key]"
                      type="number"
                      :min="field.min"
                      :max="field.max"
                      :step="field.step ?? 1"
                      :placeholder="field.placeholderKey ? t(field.placeholderKey) : ''"
                    />
                    <input
                      v-else
                      v-model="agentSettings[field.key]"
                      :placeholder="field.placeholderKey ? t(field.placeholderKey) : ''"
                    />
                  </div>
                </details>
              </template>
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
          <div v-if="fsVisible" class="tc-overlay" @mousedown.self="closeFs">
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

