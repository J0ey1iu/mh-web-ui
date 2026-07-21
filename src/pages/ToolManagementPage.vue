<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  fetchManageTools,
  createManageTool,
  updateManageTool,
  deleteManageTool,
} from "../api/client"
import type { ManageTool } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"
import { useAlertStore } from "../stores/alert"
import SearchSelect from "../components/SearchSelect.vue"

const { t, localeVal } = useI18nStore()
const alertStore = useAlertStore()

// ===== Manage Tools =====
const tools = ref<ManageTool[]>([])
const loading = ref(false)

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
    alertStore.show(t("mgmt_tc_invalid_json"))
  }
}

async function load() {
  loading.value = true
  try {
    const resp = await fetchManageTools({ q: searchQuery.value, page: currentPage.value, page_size: pageSize.value })
    tools.value = resp.items
    total.value = resp.total
  } catch (e) {
    alertStore.show("Failed to load tools: " + (e as Error).message)
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
    alertStore.show("Invalid JSON in parameters field")
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
  if (!await alertStore.confirm(t("alert_confirm_delete_tool", { name }))) return
  try {
    await deleteManageTool(name)
    await load()
  } catch (e) {
    alertStore.show("Failed to delete: " + (e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content">
      <header class="mgmt-header">
        <h1>{{ t("mgmt_tools") }}</h1>
        <button class="btn-primary" @click="openCreate">{{ t("mgmt_new_tool") }}</button>
      </header>

      <!-- ===== Manage Tools ===== -->
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
                <th>{{ t("mgmt_endpoint") }}</th>
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
            <td :title="tl.name"><code>{{ tl.name }}</code></td>
            <td :title="localeVal(tl.display_name_locale, tl.display_name)">{{ localeVal(tl.display_name_locale, tl.display_name) }}</td>
            <td class="cell-desc" :title="localeVal(tl.description_locale, tl.description)">{{ localeVal(tl.description_locale, tl.description) }}</td>
            <td><code class="cell-url" :title="tl.endpoint_url || t('mgmt_local')">{{ tl.endpoint_url || t("mgmt_local") }}</code></td>
            <td class="cell-audit" :title="fmtAudit(tl.created_at, tl.created_by)">{{ fmtAudit(tl.created_at, tl.created_by) }}</td>
            <td class="cell-audit" :title="fmtAudit(tl.updated_at, tl.updated_by)">{{ fmtAudit(tl.updated_at, tl.updated_by) }}</td>
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
            <SearchSelect v-model.number="pageSize" :options="pageSizeOptions" :searchable="false" @change="onPageSizeChange" />
          </div>
        </div>

        <Teleport to="body">
          <div v-if="showDialog" class="dialog-overlay" @mousedown.self="showDialog = false">
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
          <div v-if="mgmtFs" class="tc-overlay" @mousedown.self="closeMgmtFs()">
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

    </div>
  </div>
</template>

<style scoped>
/* Tool-specific creator styles (trial area, output) */
.tc-textarea-code-source {
  min-height: 200px;
  font-family: var(--font-mono);
  font-size: 12px;
}
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
</style>
