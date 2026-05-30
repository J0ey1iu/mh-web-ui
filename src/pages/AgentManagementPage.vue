<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  fetchManageAgents,
  createManageAgent,
  updateManageAgent,
  deleteManageAgent,
} from "../api/client"
import type { ManageAgent } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"

const { t, localeVal } = useI18nStore()
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

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const saving = ref(false)

async function load() {
  loading.value = true
  try {
    const resp = await fetchManageAgents({ q: searchQuery.value, page: currentPage.value, page_size: pageSize.value })
    agents.value = resp.items
    total.value = resp.total
  } catch (e) {
    alert("Failed to load agents: " + (e as Error).message)
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
  form.value = { name: "", display_name: "", display_name_locale: "", description: "", description_locale: "", system_prompt: "", system_prompt_locale: "", endpoint_url: "" }
  localeForm.value = { display_zh: "", display_en: "", desc_zh: "", desc_en: "", prompt_zh: "", prompt_en: "" }
  showDialog.value = true
}

function openEdit(a: ManageAgent) {
  editing.value = true
  form.value = { ...a }
  loadLocaleFromForm()
  showDialog.value = true
}

async function save() {
  applyLocaleToForm()
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
  if (!confirm(`Delete agent "${name}"?`)) return
  try {
    await deleteManageAgent(name)
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
        <h1>{{ t("mgmt_agents") }}</h1>
        <button class="btn-primary" @click="openCreate">{{ t("mgmt_new_agent") }}</button>
      </header>

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
              <label>{{ t("mgmt_description") }}</label>
              <textarea v-model="form.description" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label>{{ t("mgmt_system_prompt") }}</label>
              <textarea v-model="form.system_prompt" rows="6" class="mono"></textarea>
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
              <div class="locale-field">
                <div class="locale-field-label">{{ t("mgmt_locale_prompt") }}</div>
                <div class="locale-input-row">
                  <label class="locale-lang">zh <textarea v-model="localeForm.prompt_zh" rows="3" placeholder="中文系统提示"></textarea></label>
                  <label class="locale-lang">en <textarea v-model="localeForm.prompt_en" rows="3" :placeholder="t('mgmt_placeholder_prompt')"></textarea></label>
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


