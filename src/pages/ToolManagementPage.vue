<script setup lang="ts">
import { ref, onMounted } from "vue"
import {
  fetchManageTools,
  createManageTool,
  updateManageTool,
  deleteManageTool,
} from "../api/client"
import type { ManageTool } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"

const { t, localeVal } = useI18nStore()
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
</script>

<template>
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content">
      <header class="mgmt-header">
        <h1>{{ t("mgmt_tools") }}</h1>
        <button class="btn-primary" @click="openCreate">{{ t("mgmt_new_tool") }}</button>
      </header>

      <div v-if="loading" class="mgmt-loading">{{ t("mgmt_loading") }}</div>
      <div v-else-if="tools.length === 0" class="mgmt-empty">{{ t("mgmt_no_tools") }}</div>
      <table v-else class="mgmt-table">
        <thead>
          <tr>
            <th>{{ t("mgmt_name") }}</th>
            <th>{{ t("mgmt_display_name") }}</th>
            <th>{{ t("mgmt_description") }}</th>
            <th>{{ t("mgmt_endpoint") }}</th>
            <th>{{ t("mgmt_actions") }}</th>
          </tr>
        </thead>
        <tbody>
        <tr v-for="tl in tools" :key="tl.name">
          <td><code>{{ tl.name }}</code></td>
          <td>{{ localeVal(tl.display_name_locale, tl.display_name) }}</td>
          <td class="cell-desc">{{ localeVal(tl.description_locale, tl.description) }}</td>
          <td><code class="cell-url">{{ tl.endpoint_url || t("mgmt_local") }}</code></td>
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
  </div>
</template>

<style scoped>
.mgmt-page {
  color: var(--text-primary);
}
.mgmt-page-content {
  max-width: 960px;
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
  flex: 1;
  margin: 0;
  font-size: 20px;
}
.btn-back {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-back:hover {
  background: var(--surface-raised);
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
</style>
