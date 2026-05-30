<script setup lang="ts">
import { ref, onMounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useI18nStore } from "../stores/i18n"
import { storeToRefs } from "pinia"

const route = useRoute()
const router = useRouter()
const i18nStore = useI18nStore()
const { t, setLocale } = i18nStore
const { locale } = storeToRefs(i18nStore)

const themes = [
  { value: "light", labelKey: "theme_light" },
  { value: "dark", labelKey: "theme_dark" },
  { value: "dusk", labelKey: "theme_dusk" },
  { value: "sepia", labelKey: "theme_sepia" },
  { value: "lemonade", labelKey: "theme_lemonade" },
  { value: "eclipse", labelKey: "theme_eclipse" },
]

const currentTheme = ref(localStorage.getItem("theme") || "light")

function setTheme(v: string) {
  currentTheme.value = v
  document.documentElement.setAttribute("data-theme", v)
  localStorage.setItem("theme", v)
}

watch(currentTheme, setTheme)
onMounted(() => setTheme(currentTheme.value))

function isActive(path: string) {
  return route.path.startsWith(path)
}

function toggleLang() {
  setLocale(locale.value === "zh" ? "en" : "zh")
}
</script>

<template>
  <nav class="mgmt-nav">
    <div class="mgmt-nav-inner">
      <button class="btn-back" @click="router.push('/')">&larr; {{ t("mgmt_back") }}</button>
      <div class="mgmt-nav-tabs">
        <router-link to="/scenes" class="nav-tab" :class="{ active: isActive('/scenes') }">{{ t("mgmt_scenes") }}</router-link>
        <router-link to="/agents" class="nav-tab" :class="{ active: isActive('/agents') }">{{ t("mgmt_agents") }}</router-link>
        <router-link to="/tools" class="nav-tab" :class="{ active: isActive('/tools') }">{{ t("mgmt_tools") }}</router-link>
      </div>
      <div class="mgmt-nav-controls">
        <div class="control-group">
          <label class="control-label">{{ t("theme") }}</label>
          <select v-model="currentTheme" class="control-select">
            <option v-for="th in themes" :key="th.value" :value="th.value">{{ t(th.labelKey) }}</option>
          </select>
        </div>
        <button class="lang-btn" @click="toggleLang">{{ locale === "zh" ? "EN" : "中文" }}</button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.mgmt-nav {
  border-bottom: 1px solid var(--border);
  background: var(--surface-bg);
  position: sticky;
  top: 0;
  z-index: 100;
}
.mgmt-nav-inner {
  max-width: 1060px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  height: 52px;
}
.btn-back {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.btn-back:hover { background: var(--surface-raised); }
.mgmt-nav-tabs {
  display: flex;
  gap: 2px;
  flex: 1;
}
.nav-tab {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.nav-tab:hover { background: var(--surface-raised); color: var(--text-primary); }
.nav-tab.active {
  background: var(--accent);
  color: #fff;
}
.mgmt-nav-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.control-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.control-select {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-raised);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}
.lang-btn {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.lang-btn:hover { background: var(--border); }
</style>
