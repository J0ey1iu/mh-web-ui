<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  fetchManageProviderConfigs,
  createManageProviderConfig,
  updateManageProviderConfig,
  deleteManageProviderConfig,
} from "../api/client"
import type { ManageProvider, ProviderModel } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import SearchSelect from "../components/SearchSelect.vue"
import { useI18nStore } from "../stores/i18n"
import { useAlertStore } from "../stores/alert"

const { t } = useI18nStore()
const alertStore = useAlertStore()

const providerTypes = ["openai", "anthropic"]

const providers = ref<ManageProvider[]>([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const editing = ref(false)
const form = ref<Partial<ManageProvider>>({
  name: "",
  provider_type: "openai",
  api_key: "",
  base_url: "",
  default_model: "",
  description: "",
  models: [],
})

// Model sub-dialog
const showModelDialog = ref(false)
const editingModel = ref(false)
const modelForm = ref<ProviderModel>({ id: "", code: "", display_name: "", max_context: 0 })
const editingModelIndex = ref(-1)

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

async function load() {
  loading.value = true
  try {
    const res = await fetchManageProviderConfigs({ q: searchQuery.value, page: currentPage.value, page_size: pageSize.value })
    providers.value = res.items
    total.value = res.total
  } catch (e) {
    alertStore.show("Failed to load providers: " + (e as Error).message)
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
  form.value = { name: "", provider_type: "openai", api_key: "", base_url: "", default_model: "", description: "" }
  showDialog.value = true
}

function openEdit(p: ManageProvider) {
  editing.value = true
  form.value = { ...p }
  showDialog.value = true
}

async function save() {
  if (!form.value.name) return
  saving.value = true
  try {
    if (editing.value && form.value.name) {
      await updateManageProviderConfig(form.value.name, form.value)
    } else {
      await createManageProviderConfig(form.value)
    }
    showDialog.value = false
    await load()
  } catch (e) {
    alertStore.show("Failed to save: " + (e as Error).message)
  } finally {
    saving.value = false
  }
}

async function remove(name: string) {
  if (!await alertStore.confirm(t("mgmt_confirm_delete"))) return
  try {
    await deleteManageProviderConfig(name)
    await load()
  } catch (e) {
    alertStore.show("Failed to delete: " + (e as Error).message)
  }
}

function fmtAudit(dt: string | undefined, by: string | undefined): string {
  if (!dt) return "-"
  const t = dt.replace("T", " ").substring(0, 16)
  return by ? `${t} by ${by}` : t
}

// Model management
function openAddModel() {
  editingModel.value = false
  editingModelIndex.value = -1
  modelForm.value = { id: "", code: "", display_name: "", max_context: 0 }
  showModelDialog.value = true
}

function openEditModel(idx: number) {
  editingModel.value = true
  editingModelIndex.value = idx
  modelForm.value = { ...(form.value.models ?? [])[idx] }
  showModelDialog.value = true
}

function saveModel() {
  if (!modelForm.value.id) return
  if (editingModel.value && editingModelIndex.value >= 0) {
    const models = form.value.models ?? []
    models[editingModelIndex.value] = { ...modelForm.value }
    form.value.models = [...models]
  } else {
    const models = form.value.models ?? []
    if (models.some((m) => m.id === modelForm.value.id)) {
      alertStore.show(t("mgmt_confirm_delete"))
      return
    }
    form.value.models = [...models, { ...modelForm.value }]
  }
  showModelDialog.value = false
}

function removeModel(idx: number) {
  const models = form.value.models ?? []
  form.value.models = models.filter((_, i) => i !== idx)
}

onMounted(load)
</script>

<template>
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content">
      <header class="mgmt-header">
        <h1>{{ t("mgmt_providers") }}</h1>
        <button class="btn-primary" @click="openCreate">{{ t("mgmt_new_provider") }}</button>
      </header>

      <div class="mgmt-toolbar">
        <input v-model="searchQuery" class="mgmt-search" :placeholder="t('mgmt_search_placeholder')" @keyup.enter="onSearch" />
        <button class="btn-search" @click="onSearch">{{ t("mgmt_search") }}</button>
      </div>

      <div v-if="loading" class="table-wrap">
        <table class="mgmt-table">
          <thead>
            <tr>
              <th>{{ t("mgmt_name") }}</th>
              <th>{{ t("mgmt_provider_type") }}</th>
              <th>{{ t("mgmt_base_url") }}</th>
              <th>{{ t("mgmt_default_model") }}</th>
              <th>{{ t("mgmt_created_at") }}</th>
              <th>{{ t("mgmt_actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 5" :key="i" class="mgmt-skeleton-row">
              <td><div class="mgmt-skeleton-cell" style="width:60%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:40%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:50%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:40%"></div></td>
              <td><div class="mgmt-skeleton-cell mgmt-skeleton-cell-sm" style="width:65%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:50%"></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="providers.length === 0" class="mgmt-empty">{{ searchQuery ? t("mgmt_no_results") : t("mgmt_no_providers") }}</div>
      <div v-else>
        <div class="table-wrap">
          <table class="mgmt-table">
            <thead>
              <tr>
                <th>{{ t("mgmt_name") }}</th>
                <th>{{ t("mgmt_provider_type") }}</th>
                <th>{{ t("mgmt_base_url") }}</th>
                <th>{{ t("mgmt_default_model") }}</th>
                <th>{{ t("mgmt_created_at") }}</th>
                <th>{{ t("mgmt_actions") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in providers" :key="p.name">
                <td :title="p.name"><code>{{ p.name }}</code></td>
                <td><code>{{ p.provider_type }}</code></td>
                <td><code class="cell-url" :title="p.base_url || '-'">{{ p.base_url || '-' }}</code></td>
                <td>{{ p.default_model || '-' }}</td>
                <td class="cell-audit" :title="fmtAudit(p.created_at, p.created_by)">{{ fmtAudit(p.created_at, p.created_by) }}</td>
                <td class="cell-actions">
                  <button class="btn-action" @click="openEdit(p)">{{ t("mgmt_edit") }}</button>
                  <button class="btn-action btn-danger" @click="remove(p.name)">{{ t("mgmt_delete") }}</button>
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
    </div>

    <Teleport to="body">
      <div v-if="showDialog" class="dialog-overlay" @mousedown.self="showDialog = false">
        <div class="dialog dialog-wide">
          <h2>{{ editing ? t("mgmt_edit_provider") : t("mgmt_new_provider_title") }}</h2>
          <div class="form-group">
            <label>{{ t("mgmt_name") }}</label>
            <input v-model="form.name" :placeholder="t('mgmt_placeholder_name')" :disabled="editing" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_provider_type") }}</label>
            <select v-model="form.provider_type" class="mgmt-dialog-select">
              <option v-for="pt in providerTypes" :key="pt" :value="pt">{{ pt }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_api_key") }}</label>
            <input v-model="form.api_key" type="password" :placeholder="t('mgmt_api_key_placeholder')" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_base_url") }}</label>
            <input v-model="form.base_url" :placeholder="t('mgmt_base_url_placeholder')" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_default_model") }}</label>
            <input v-model="form.default_model" :placeholder="t('mgmt_model_placeholder')" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_description") }}</label>
            <textarea v-model="form.description" rows="2"></textarea>
          </div>
          <details class="locale-section" open>
            <summary>{{ t("mgmt_models") }}</summary>
            <div v-if="(form.models ?? []).length === 0" class="mgmt-empty" style="padding:8px 0;font-size:13px">{{ t("mgmt_no_models") }}</div>
            <div v-else class="model-list">
              <div v-for="(m, idx) in form.models" :key="m.id" class="model-item">
                <div class="model-item-info">
                  <strong>{{ m.display_name || m.id }}</strong>
                  <span class="model-item-code"><code>{{ m.code || m.id }}</code></span>
                  <span class="model-item-ctx" v-if="m.max_context > 0">{{ m.max_context.toLocaleString() }} ctx</span>
                </div>
                <div class="model-item-actions">
                  <button class="btn-sm btn-action" @click="openEditModel(idx)">{{ t("mgmt_edit") }}</button>
                  <button class="btn-sm btn-action btn-danger" @click="removeModel(idx)">{{ t("mgmt_delete") }}</button>
                </div>
              </div>
            </div>
            <button class="btn-sm btn-primary" style="margin-top:8px" @click="openAddModel">{{ t("mgmt_add_model") }}</button>
          </details>
          <div class="dialog-actions">
            <button class="btn-action" @click="showDialog = false">{{ t("mgmt_cancel") }}</button>
            <button class="btn-primary" @click="save" :disabled="!form.name || saving">
              {{ saving ? t("mgmt_saving") : t("mgmt_save") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showModelDialog" class="dialog-overlay" @mousedown.self="showModelDialog = false">
        <div class="dialog">
          <h2>{{ editingModel ? t("mgmt_edit_model") : t("mgmt_add_model") }}</h2>
          <div class="form-group">
            <label>{{ t("mgmt_model_id") }}</label>
            <input v-model="modelForm.id" :placeholder="t('mgmt_placeholder_id')" :disabled="editingModel" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_model_code") }}</label>
            <input v-model="modelForm.code" :placeholder="t('mgmt_model_placeholder_code')" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_model_display_name") }}</label>
            <input v-model="modelForm.display_name" :placeholder="t('mgmt_placeholder_display_name')" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_model_max_context") }}</label>
            <input v-model.number="modelForm.max_context" type="number" min="0" :placeholder="t('mgmt_model_placeholder_context')" />
          </div>
          <div class="dialog-actions">
            <button class="btn-action" @click="showModelDialog = false">{{ t("mgmt_cancel") }}</button>
            <button class="btn-primary" @click="saveModel" :disabled="!modelForm.id">
              {{ t("mgmt_save") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.mgmt-dialog-select {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: var(--glass-highlight);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
}
.mgmt-dialog-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.model-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  gap: 8px;
}
.model-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.model-item-code {
  color: var(--text-muted);
  font-size: 12px;
}
.model-item-ctx {
  color: var(--accent);
  font-size: 11px;
  white-space: nowrap;
}
.model-item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  background: var(--glass-highlight);
  color: var(--text-primary);
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-sm:hover { opacity: 0.8; }
</style>