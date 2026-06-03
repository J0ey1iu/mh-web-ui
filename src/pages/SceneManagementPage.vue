<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import {
  fetchManageScenarios,
  fetchManageScenario,
  createManageScenario,
  updateManageScenario,
  deleteManageScenario,
  addScenarioAgent,
  removeScenarioAgent,
  addAgentTool,
  removeAgentTool,
  fetchManageAgents,
  fetchManageTools,
} from "../api/client"
import type { ManageScenario, ManageAgent, ManageTool } from "../types"
import ManagementNav from "../components/ManagementNav.vue"
import { useI18nStore } from "../stores/i18n"
import { useAlertStore } from "../stores/alert"
import SearchSelect from "../components/SearchSelect.vue"

const { t, localeVal } = useI18nStore()
const alertStore = useAlertStore()
const scenarios = ref<ManageScenario[]>([])
const allAgents = ref<ManageAgent[]>([])
const allTools = ref<ManageTool[]>([])
const loading = ref(false)
const showDialog = ref(false)
const editing = ref(false)
const form = ref<Partial<ManageScenario>>({
  id: "",
  name: "",
  name_locale: "",
  icon: "",
  description: "",
  description_locale: "",
  agents: [],
})

const localeForm = ref({ name_zh: "", name_en: "", desc_zh: "", desc_en: "" })

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
  return JSON.stringify({ zh, en }, { ensure_ascii: false } as any)
}

function loadLocaleFromForm() {
  const n = parseLocaleJson(form.value.name_locale)
  localeForm.value.name_zh = n.zh
  localeForm.value.name_en = n.en
  const d = parseLocaleJson(form.value.description_locale)
  localeForm.value.desc_zh = d.zh
  localeForm.value.desc_en = d.en
}

function applyLocaleToForm() {
  form.value.name_locale = composeLocaleJson(localeForm.value.name_zh, localeForm.value.name_en)
  form.value.description_locale = composeLocaleJson(localeForm.value.desc_zh, localeForm.value.desc_en)
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
  } else if (fsTarget === "locale_desc_zh") {
    localeForm.value.desc_zh = fsContent.value
  } else if (fsTarget === "locale_desc_en") {
    localeForm.value.desc_en = fsContent.value
  }
  fsVisible.value = false
  fsTarget = null
}

// detail panel
const detailScenario = ref<ManageScenario | null>(null)
const showDetail = ref(false)
const addAgentName = ref("")
const showAddAgent = ref(false)
const addToolName = ref("")
const showAddTool = ref("")  // agent name

const addAgentOptions = computed(() =>
  unusedAgents().map(a => ({
    value: a.name,
    label: `${localeVal(a.display_name_locale, a.display_name)} (${a.name})`,
  }))
)

const addToolOptions = computed(() => {
  if (!showAddTool.value) return []
  return unusedTools(showAddTool.value).map(tl => ({
    value: tl.name,
    label: `${localeVal(tl.display_name_locale, tl.display_name)} (${tl.name})`,
  }))
})

async function load() {
  loading.value = true
  try {
    const [scenarioResp, agentList, toolList] = await Promise.all([
      fetchManageScenarios({ q: searchQuery.value, page: currentPage.value, page_size: pageSize.value }),
      fetchManageAgents(),
      fetchManageTools(),
    ])
    scenarios.value = scenarioResp.items
    total.value = scenarioResp.total
    allAgents.value = agentList.items
    allTools.value = toolList.items
  } catch (e) {
    alertStore.show("Failed to load: " + (e as Error).message)
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
  form.value = { id: "", name: "", icon: "", description: "", agents: [] }
  localeForm.value = { name_zh: "", name_en: "", desc_zh: "", desc_en: "" }
  showDialog.value = true
}

function openEdit(s: ManageScenario) {
  editing.value = true
  form.value = { ...s, agents: s.agents ? [...s.agents] : [] }
  loadLocaleFromForm()
  showDialog.value = true
}

async function save() {
  applyLocaleToForm()
  saving.value = true
  try {
    if (editing.value && form.value.id) {
      await updateManageScenario(form.value.id, form.value)
    } else {
      await createManageScenario(form.value)
    }
    showDialog.value = false
    await load()
  } catch (e) {
    alertStore.show("Failed to save: " + (e as Error).message)
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  if (!await alertStore.confirm(t("alert_confirm_delete_scenario"))) return
  try {
    await deleteManageScenario(id)
    if (detailScenario.value?.id === id) {
      showDetail.value = false
      detailScenario.value = null
    }
    await load()
  } catch (e) {
    alertStore.show("Failed to delete: " + (e as Error).message)
  }
}

async function openDetail(s: ManageScenario) {
  showAddAgent.value = false
  showAddTool.value = ""
  try {
    detailScenario.value = await fetchManageScenario(s.id)
    showDetail.value = true
  } catch {
    detailScenario.value = s
    showDetail.value = true
  }
}

async function handleAddAgent() {
  if (!detailScenario.value || !addAgentName.value) return
  try {
    detailScenario.value = await addScenarioAgent(detailScenario.value.id, addAgentName.value)
    addAgentName.value = ""
    showAddAgent.value = false
    await load()
  } catch (e) {
    alertStore.show("Failed to add agent: " + (e as Error).message)
  }
}

async function handleRemoveAgent(agentName: string) {
  if (!detailScenario.value || !await alertStore.confirm(t("alert_confirm_remove_agent", { name: agentName }))) return
  try {
    detailScenario.value = await removeScenarioAgent(detailScenario.value.id, agentName)
    await load()
  } catch (e) {
    alertStore.show("Failed to remove agent: " + (e as Error).message)
  }
}

async function handleAddTool(agentName: string) {
  if (!detailScenario.value || !addToolName.value) return
  try {
    detailScenario.value = await addAgentTool(detailScenario.value.id, agentName, addToolName.value)
    addToolName.value = ""
    showAddTool.value = ""
    await load()
  } catch (e) {
    alertStore.show("Failed to add tool: " + (e as Error).message)
  }
}

async function handleRemoveTool(agentName: string, toolName: string) {
  if (!detailScenario.value) return
  if (!await alertStore.confirm(t("alert_confirm_remove_tool", { tool: getToolDisplay(toolName), agent: getAgentDisplay(agentName) }))) return
  try {
    detailScenario.value = await removeAgentTool(detailScenario.value.id, agentName, toolName)
    await load()
  } catch (e) {
    alertStore.show("Failed to remove tool: " + (e as Error).message)
  }
}

function getAgentDisplay(name: string): string {
  const a = allAgents.value.find(x => x.name === name)
  return a ? `${localeVal(a.display_name_locale, a.display_name)} (${name})` : name
}

function getToolDisplay(name: string): string {
  const tl = allTools.value.find(x => x.name === name)
  return tl ? `${localeVal(tl.display_name_locale, tl.display_name)} (${name})` : name
}

function unusedAgents(): ManageAgent[] {
  if (!detailScenario.value) return allAgents.value
  const used = new Set((detailScenario.value.agents ?? []).map(a => a.name))
  return allAgents.value.filter(a => !used.has(a.name))
}

function fmtAudit(dt: string | undefined, by: string | undefined): string {
  if (!dt) return "-"
  const t = dt.replace("T", " ").substring(0, 16)
  return by ? `${t} by ${by}` : t
}

function unusedTools(agentName: string): ManageTool[] {
  if (!detailScenario.value) return allTools.value
  const agent = (detailScenario.value.agents ?? []).find(a => a.name === agentName)
  const used = new Set(agent?.tool_names ?? [])
  return allTools.value.filter(t => !used.has(t.name))
}

onMounted(load)
</script>

<template>
  <div class="mgmt-page">
    <ManagementNav />
    <div class="mgmt-page-content">
      <header class="mgmt-header">
        <h1>{{ t("mgmt_scenes") }}</h1>
        <button class="btn-primary" @click="openCreate">{{ t("mgmt_new_scene") }}</button>
      </header>

      <div class="mgmt-toolbar">
        <input v-model="searchQuery" class="mgmt-search" :placeholder="t('mgmt_search_placeholder')" @keyup.enter="onSearch" />
        <button class="btn-search" @click="onSearch">{{ t("mgmt_search") }}</button>
      </div>

      <div v-if="loading" class="table-wrap">
        <table class="mgmt-table">
          <thead>
            <tr>
              <th>{{ t("mgmt_icon") }}</th>
              <th>{{ t("mgmt_id") }}</th>
              <th>{{ t("mgmt_name") }}</th>
              <th>{{ t("mgmt_description") }}</th>
              <th>{{ t("mgmt_agent_count") }}</th>
              <th>{{ t("mgmt_created_at") }}</th>
              <th>{{ t("mgmt_updated_at") }}</th>
              <th>{{ t("mgmt_actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 5" :key="i" class="mgmt-skeleton-row">
              <td><div class="mgmt-skeleton-cell mgmt-skeleton-cell-icon"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:60%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:50%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:70%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:40%"></div></td>
              <td><div class="mgmt-skeleton-cell mgmt-skeleton-cell-sm" style="width:65%"></div></td>
              <td><div class="mgmt-skeleton-cell mgmt-skeleton-cell-sm" style="width:65%"></div></td>
              <td><div class="mgmt-skeleton-cell" style="width:50%"></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="scenarios.length === 0" class="mgmt-empty">{{ searchQuery ? t("mgmt_no_results") : t("mgmt_no_scenes") }}</div>
      <div v-else>
        <div class="table-wrap">
          <table class="mgmt-table">
            <thead>
              <tr>
                <th>{{ t("mgmt_icon") }}</th>
                <th>{{ t("mgmt_id") }}</th>
                <th>{{ t("mgmt_name") }}</th>
                <th>{{ t("mgmt_description") }}</th>
                <th>{{ t("mgmt_agent_count") }}</th>
                <th>{{ t("mgmt_created_at") }}</th>
                <th>{{ t("mgmt_updated_at") }}</th>
                <th>{{ t("mgmt_actions") }}</th>
              </tr>
            </thead>
          <tbody>
            <tr v-for="s in scenarios" :key="s.id" class="clickable-row" @click="openDetail(s)">
          <td class="cell-icon">{{ s.icon }}</td>
          <td :title="s.id"><code>{{ s.id }}</code></td>
          <td :title="localeVal(s.name_locale, s.name)">{{ localeVal(s.name_locale, s.name) }}</td>
          <td class="cell-desc" :title="localeVal(s.description_locale, s.description)">{{ localeVal(s.description_locale, s.description) }}</td>
          <td :title="String(s.agents?.length ?? 0)">{{ s.agents?.length ?? 0 }}</td>
          <td class="cell-audit" :title="fmtAudit(s.created_at, s.created_by)">{{ fmtAudit(s.created_at, s.created_by) }}</td>
          <td class="cell-audit" :title="fmtAudit(s.updated_at, s.updated_by)">{{ fmtAudit(s.updated_at, s.updated_by) }}</td>
            <td class="cell-actions" @click.stop>
              <button class="btn-action" @click="openEdit(s)">{{ t("mgmt_edit") }}</button>
              <button class="btn-action btn-danger" @click="remove(s.id)">{{ t("mgmt_delete") }}</button>
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
        <div class="dialog">
          <h2>{{ editing ? t("mgmt_edit_scene") : t("mgmt_new_scene_title") }}</h2>
          <div class="form-group">
            <label>{{ t("mgmt_id") }}</label>
            <input v-model="form.id" :disabled="editing" :placeholder="t('mgmt_placeholder_id')" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_name") }}</label>
            <input v-model="form.name" :placeholder="t('mgmt_placeholder_name')" />
          </div>
          <div class="form-group">
            <label>{{ t("mgmt_icon") }}</label>
            <input v-model="form.icon" :placeholder="t('mgmt_placeholder_icon')" />
          </div>
          <div class="form-group">
            <div class="tc-label-row">
              <label>{{ t("mgmt_description") }}</label>
              <button class="tc-fullscreen-btn" @click="openFs(t('mgmt_description'), form.description ?? '', 'description')" :title="t('mgmt_tc_source_code')">&#x26F6;</button>
            </div>
            <textarea v-model="form.description" rows="3"></textarea>
          </div>
          <details class="locale-section">
            <summary>{{ t("mgmt_translations") }}</summary>
            <div class="locale-field">
              <div class="locale-field-label">{{ t("mgmt_locale_name") }}</div>
              <div class="locale-input-row">
                <label class="locale-lang">zh <input v-model="localeForm.name_zh" placeholder="场景名称" /></label>
                <label class="locale-lang">en <input v-model="localeForm.name_en" :placeholder="t('mgmt_placeholder_name')" /></label>
              </div>
            </div>
            <div class="locale-field">
              <div class="locale-field-label">{{ t("mgmt_locale_desc") }}</div>
              <div class="locale-input-row">
                <label class="locale-lang">zh <button class="tc-fullscreen-btn" @click="openFs('zh ' + t('mgmt_locale_desc'), localeForm.desc_zh, 'locale_desc_zh')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.desc_zh" rows="2" placeholder="场景描述"></textarea></label>
                <label class="locale-lang">en <button class="tc-fullscreen-btn" @click="openFs('en ' + t('mgmt_locale_desc'), localeForm.desc_en, 'locale_desc_en')" :title="t('mgmt_tc_source_code')">&#x26F6;</button> <textarea v-model="localeForm.desc_en" rows="2" :placeholder="t('mgmt_placeholder_desc')"></textarea></label>
              </div>
            </div>
          </details>
          <div class="dialog-actions">
            <button class="btn-cancel" @click="showDialog = false">{{ t("mgmt_cancel") }}</button>
            <button class="btn-primary" :disabled="saving || !form.id || !form.name" @click="save">
              {{ saving ? t("mgmt_saving") : t("mgmt_save") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Detail panel -->
    <Teleport to="body">
      <div v-if="showDetail && detailScenario" class="dialog-overlay" @click.self="showDetail = false">
        <div class="dialog dialog-lg">
          <div class="detail-header">
            <span class="detail-icon">{{ detailScenario.icon }}</span>
            <h2>{{ localeVal(detailScenario.name_locale, detailScenario.name) }}</h2>
            <button class="btn-close" @click="showDetail = false">&times;</button>
          </div>
          <div class="detail-meta">
            <div class="detail-meta-row">
              <code class="detail-id" :title="detailScenario.id">ID: {{ detailScenario.id }}</code>
              <span class="badge badge-neutral">{{ (detailScenario.agents ?? []).length }} agents</span>
            </div>
            <p>{{ localeVal(detailScenario.description_locale, detailScenario.description) }}</p>
            <div class="detail-audit">
              <span v-if="detailScenario.created_at"><strong>{{ t("mgmt_created_at") }}:</strong> {{ fmtAudit(detailScenario.created_at, detailScenario.created_by) }}</span>
              <span v-if="detailScenario.updated_at"><strong>{{ t("mgmt_updated_at") }}:</strong> {{ fmtAudit(detailScenario.updated_at, detailScenario.updated_by) }}</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-header">
              <h3>{{ t("mgmt_detail_agents_tools") }}</h3>
              <button class="btn-sm" @click="showAddAgent = !showAddAgent">{{ showAddAgent ? t("mgmt_cancel") : t("mgmt_add_agent") }}</button>
            </div>

            <div v-if="showAddAgent" class="inline-form">
              <SearchSelect v-model="addAgentName" :options="addAgentOptions" :placeholder="t('mgmt_select_agent')" />
              <button class="btn-sm btn-primary" :disabled="!addAgentName" @click="handleAddAgent">{{ t("mgmt_save") }}</button>
            </div>

            <div v-if="!detailScenario.agents || detailScenario.agents.length === 0" class="empty-hint">
              {{ t("mgmt_no_agents_in_scene") }}
            </div>
            <div v-for="a in (detailScenario.agents ?? [])" :key="a.name" class="agent-card">
              <div class="agent-card-header">
                <div class="agent-card-info">
                  <strong>{{ getAgentDisplay(a.name) }}</strong>
                  <span class="badge badge-accent" v-if="(a.tool_names ?? []).length">{{ (a.tool_names ?? []).length }} tools</span>
                </div>
                <button class="btn-sm btn-danger" @click="handleRemoveAgent(a.name)">{{ t("mgmt_remove") }}</button>
              </div>
              <div class="tool-list">
                <span v-for="tn in (a.tool_names ?? [])" :key="tn" class="tool-tag">
                  {{ getToolDisplay(tn) }}
                  <button class="tool-tag-remove" @click="handleRemoveTool(a.name, tn)" :title="t('mgmt_remove')">&times;</button>
                </span>
                <span v-if="!a.tool_names || a.tool_names.length === 0" class="text-muted">{{ t("mgmt_no_tools_assigned") }}</span>
              </div>
              <div v-if="showAddTool === a.name" class="inline-form compact">
                <SearchSelect v-model="addToolName" :options="addToolOptions" :placeholder="t('mgmt_select_tool')" />
                <button class="btn-sm btn-primary" :disabled="!addToolName" @click="handleAddTool(a.name)">{{ t("mgmt_save") }}</button>
                <button class="btn-sm" @click="showAddTool = ''; addToolName = ''">{{ t("mgmt_cancel") }}</button>
              </div>
              <button v-if="showAddTool !== a.name" class="btn-sm" @click="showAddTool = a.name; addToolName = ''">{{ t("mgmt_add_tool") }}</button>
            </div>
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
            <textarea v-model="fsContent" class="tc-overlay-textarea tc-overlay-textarea-text" spellcheck="false" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
  </div>
</template>

<style scoped>
.detail-icon {
  font-size: 28px;
  line-height: 1;
}
.detail-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.detail-id {
  font-size: 12px;
  font-family: var(--font-mono);
  opacity: 0.7;
}
.agent-card-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
</style>


