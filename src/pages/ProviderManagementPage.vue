<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  fetchManageProviderConfigs,
  createManageProviderConfig,
  updateManageProviderConfig,
  deleteManageProviderConfig,
} from "../api/client"
import type { ManageProvider } from "../types"
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
})

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
      <div v-if="showDialog" class="dialog-overlay" @click.self="showDialog = false">
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
          <div class="dialog-actions">
            <button class="btn-action" @click="showDialog = false">{{ t("mgmt_cancel") }}</button>
            <button class="btn-primary" @click="save" :disabled="!form.name || saving">
              {{ saving ? t("mgmt_saving") : t("mgmt_save") }}
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
</style>