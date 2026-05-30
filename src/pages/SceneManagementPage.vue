<script setup lang="ts">
import { ref, onMounted } from "vue"
import {
  fetchManageScenarios,
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

const { t, localeVal } = useI18nStore()
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
const saving = ref(false)

// detail panel
const detailScenario = ref<ManageScenario | null>(null)
const showDetail = ref(false)
const addAgentName = ref("")
const showAddAgent = ref(false)
const addToolName = ref("")
const showAddTool = ref("")  // agent name

async function load() {
  loading.value = true
  try {
    scenarios.value = await fetchManageScenarios()
    allAgents.value = await fetchManageAgents()
    allTools.value = await fetchManageTools()
  } catch (e) {
    alert("Failed to load: " + (e as Error).message)
  } finally {
    loading.value = false
  }
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
    alert("Failed to save: " + (e as Error).message)
  } finally {
    saving.value = false
  }
}

async function remove(id: string) {
  if (!confirm("Delete this scenario?")) return
  try {
    await deleteManageScenario(id)
    if (detailScenario.value?.id === id) {
      showDetail.value = false
      detailScenario.value = null
    }
    await load()
  } catch (e) {
    alert("Failed to delete: " + (e as Error).message)
  }
}

async function openDetail(s: ManageScenario) {
  showAddAgent.value = false
  showAddTool.value = ""
  try {
    // re-fetch to get latest agents/tools data
    detailScenario.value = (await fetchManageScenarios()).find(x => x.id === s.id) ?? s
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
    alert("Failed to add agent: " + (e as Error).message)
  }
}

async function handleRemoveAgent(agentName: string) {
  if (!detailScenario.value || !confirm(`Remove agent "${agentName}" from this scene?`)) return
  try {
    detailScenario.value = await removeScenarioAgent(detailScenario.value.id, agentName)
    await load()
  } catch (e) {
    alert("Failed to remove agent: " + (e as Error).message)
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
    alert("Failed to add tool: " + (e as Error).message)
  }
}

async function handleRemoveTool(agentName: string, toolName: string) {
  if (!detailScenario.value) return
  try {
    detailScenario.value = await removeAgentTool(detailScenario.value.id, agentName, toolName)
    await load()
  } catch (e) {
    alert("Failed to remove tool: " + (e as Error).message)
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

      <div v-if="loading" class="mgmt-loading">{{ t("mgmt_loading") }}</div>
      <div v-else-if="scenarios.length === 0" class="mgmt-empty">{{ t("mgmt_no_scenes") }}</div>
      <table v-else class="mgmt-table">
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
          <td><code>{{ s.id }}</code></td>
          <td>{{ localeVal(s.name_locale, s.name) }}</td>
          <td class="cell-desc">{{ localeVal(s.description_locale, s.description) }}</td>
          <td>{{ s.agents?.length ?? 0 }}</td>
          <td class="cell-audit">{{ fmtAudit(s.created_at, s.created_by) }}</td>
          <td class="cell-audit">{{ fmtAudit(s.updated_at, s.updated_by) }}</td>
            <td class="cell-actions" @click.stop>
              <button class="btn-action" @click="openEdit(s)">{{ t("mgmt_edit") }}</button>
              <button class="btn-action btn-danger" @click="remove(s.id)">{{ t("mgmt_delete") }}</button>
            </td>
          </tr>
        </tbody>
      </table>

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
            <label>{{ t("mgmt_description") }}</label>
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
                <label class="locale-lang">zh <textarea v-model="localeForm.desc_zh" rows="2" placeholder="场景描述"></textarea></label>
                <label class="locale-lang">en <textarea v-model="localeForm.desc_en" rows="2" :placeholder="t('mgmt_placeholder_desc')"></textarea></label>
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
            <h2>{{ detailScenario.icon }} {{ localeVal(detailScenario.name_locale, detailScenario.name) }}</h2>
            <button class="btn-close" @click="showDetail = false">&times;</button>
          </div>
          <div class="detail-meta">
            <code>ID: {{ detailScenario.id }}</code>
            <p>{{ localeVal(detailScenario.description_locale, detailScenario.description) }}</p>
            <div class="detail-audit">
              <span v-if="detailScenario.created_at"><strong>{{ t("mgmt_created_at") }}:</strong> {{ fmtAudit(detailScenario.created_at, detailScenario.created_by) }}</span>
              <span v-if="detailScenario.updated_at"><strong>{{ t("mgmt_updated_at") }}:</strong> {{ fmtAudit(detailScenario.updated_at, detailScenario.updated_by) }}</span>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-header">
              <h3>{{ t("mgmt_detail_agents_tools") }}</h3>
              <button class="btn-sm" @click="showAddAgent = !showAddAgent">{{ t("mgmt_add_agent") }}</button>
            </div>

            <div v-if="showAddAgent" class="inline-form">
              <select v-model="addAgentName" class="sel">
                <option value="" disabled>{{ t("mgmt_select_agent") }}</option>
                <option v-for="a in unusedAgents()" :key="a.name" :value="a.name">
                  {{ localeVal(a.display_name_locale, a.display_name) }} ({{ a.name }})
                </option>
              </select>
              <button class="btn-sm btn-primary" :disabled="!addAgentName" @click="handleAddAgent">{{ t("mgmt_save") }}</button>
              <button class="btn-sm" @click="showAddAgent = false">{{ t("mgmt_cancel") }}</button>
            </div>

            <div v-if="!detailScenario.agents || detailScenario.agents.length === 0" class="empty-hint">
              {{ t("mgmt_no_agents_in_scene") }}
            </div>
            <div v-for="a in (detailScenario.agents ?? [])" :key="a.name" class="agent-card">
              <div class="agent-card-header">
                <strong>{{ getAgentDisplay(a.name) }}</strong>
                <button class="btn-sm btn-danger" @click="handleRemoveAgent(a.name)">{{ t("mgmt_remove") }}</button>
              </div>
              <div class="tool-list">
                <span v-for="t in (a.tool_names ?? [])" :key="t" class="tool-tag">
                  {{ getToolDisplay(t) }}
                  <button class="tool-tag-remove" @click="handleRemoveTool(a.name, t)">&times;</button>
                </span>
                <span v-if="!a.tool_names || a.tool_names.length === 0" class="text-muted">{{ t("mgmt_no_tools_assigned") }}</span>
              </div>
              <div v-if="showAddTool === a.name" class="inline-form compact">
                <select v-model="addToolName" class="sel">
                  <option value="" disabled>{{ t("mgmt_select_tool") }}</option>
                  <option v-for="tl in unusedTools(a.name)" :key="tl.name" :value="tl.name">
                    {{ localeVal(tl.display_name_locale, tl.display_name) }} ({{ tl.name }})
                  </option>
                </select>
                <button class="btn-sm btn-primary" :disabled="!addToolName" @click="handleAddTool(a.name)">{{ t("mgmt_save") }}</button>
                <button class="btn-sm" @click="showAddTool = ''; addToolName = ''">{{ t("mgmt_cancel") }}</button>
              </div>
              <button v-if="showAddTool !== a.name" class="btn-sm" @click="showAddTool = a.name; addToolName = ''">{{ t("mgmt_add_tool") }}</button>
            </div>
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
.btn-back:hover { background: var(--surface-raised); }
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
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-cancel {
  background: var(--surface-raised);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-sm {
  background: var(--surface-raised);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.btn-sm:hover { background: var(--border); }
.btn-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
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
.mgmt-table tr:hover td { background: var(--surface-raised); }
.clickable-row { cursor: pointer; }
.cell-icon { font-size: 20px; }
.cell-desc {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-actions { white-space: nowrap; }
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
.btn-action:hover { background: var(--surface-raised); }
.btn-danger { color: #ef4444; border-color: #ef4444; }
.btn-danger:hover { background: rgba(239, 68, 68, 0.1); }
.cell-audit { white-space: nowrap; font-size: 12px; color: var(--text-secondary); }

/* Detail panel */
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
  width: 75vw;
  max-width: 720px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
.dialog-lg {
  width: 80vw;
  max-width: 800px;
}
.dialog h2 { margin: 0; font-size: 18px; }
.form-group { margin-bottom: 16px; }
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
.form-group textarea { resize: vertical; }
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
.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.detail-header h2 { flex: 1; }
.detail-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}
.detail-meta p { margin: 4px 0 0; }
.detail-audit { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
.detail-section {
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.section-header h3 { margin: 0; font-size: 14px; flex: 1; }
.inline-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.inline-form.compact { margin-top: 4px; margin-bottom: 4px; }
.sel {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 12px;
  min-width: 180px;
}
.inline-form input {
  flex: 1;
  min-width: 140px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 12px;
}
.agent-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--surface-raised);
}
.agent-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.agent-card-header strong { flex: 1; font-size: 13px; }
.tool-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.tool-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--accent-dim);
  border-radius: 12px;
  font-size: 11px;
  color: var(--text-primary);
}
.tool-tag-remove {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}
.tool-tag-remove:hover { color: #ef4444; }
.text-muted { color: var(--text-muted); font-size: 12px; }
.empty-hint {
  color: var(--text-muted);
  font-size: 12px;
  padding: 8px 0;
}
</style>
