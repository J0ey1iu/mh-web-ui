<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth"
import { useI18nStore } from "../stores/i18n"
import SearchSelect from "./SearchSelect.vue"
import { storeToRefs } from "pinia"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { user: authUser } = storeToRefs(authStore)
const i18nStore = useI18nStore()
const { t, setLocale } = i18nStore
const { locale } = storeToRefs(i18nStore)

function hasAnyPermission(prefix: string): boolean {
  const perms = authUser.value?.permissions
  if (!perms) return false
  return perms.some(p => p === "*" || p.startsWith(prefix))
}

const hasScenePermission = computed(() => hasAnyPermission("manage:scene:"))
const hasAgentPermission = computed(() => hasAnyPermission("manage:agent:"))
const hasToolPermission = computed(() => hasAnyPermission("manage:tool:"))
const hasEvalPermission = computed(() => hasAnyPermission("use:eval:"))

const themes = [
  { value: "light", labelKey: "theme_light" },
  { value: "dark", labelKey: "theme_dark" },
  { value: "dusk", labelKey: "theme_dusk" },
  { value: "sepia", labelKey: "theme_sepia" },
  { value: "lemonade", labelKey: "theme_lemonade" },
  { value: "eclipse", labelKey: "theme_eclipse" },
]

const themeOptions = computed(() =>
  themes.map(th => ({ value: th.value, label: t(th.labelKey) }))
)

const currentTheme = ref(localStorage.getItem("theme") || "light")
const scrolled = ref(false)

function setTheme(v: string) {
  currentTheme.value = v
  document.documentElement.setAttribute("data-theme", v)
  localStorage.setItem("theme", v)
}

watch(currentTheme, setTheme)
onMounted(async () => {
  await authStore.checkAuth()
  setTheme(currentTheme.value)
  window.addEventListener("scroll", onScroll, { passive: true })
})

function onScroll() {
  scrolled.value = window.scrollY > 4
}

function isActive(path: string) {
  return route.path.startsWith(path)
}

function toggleLang() {
  setLocale(locale.value === "zh" ? "en" : "zh")
}
</script>

<template>
  <nav class="mgmt-nav" :class="{ scrolled }">
    <div class="mgmt-nav-inner">
      <button class="nav-back" @click="router.push('/')" :title="t('mgmt_back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <div class="nav-tabs">
        <router-link v-if="hasScenePermission" to="/manage/scenes" class="nav-tab" :class="{ active: isActive('/manage/scenes') }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>{{ t("mgmt_scenes") }}</span>
        </router-link>
        <router-link v-if="hasAgentPermission" to="/manage/agents" class="nav-tab" :class="{ active: isActive('/manage/agents') }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span>{{ t("mgmt_agents") }}</span>
        </router-link>
        <router-link v-if="hasToolPermission" to="/manage/tools" class="nav-tab" :class="{ active: isActive('/manage/tools') }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span>{{ t("mgmt_tools") }}</span>
        </router-link>
        <router-link v-if="hasEvalPermission && route.path.startsWith('/manage/eval')" to="/manage/eval" class="nav-tab" :class="{ active: isActive('/manage/eval') }">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <span>{{ t("evaluation") }}</span>
        </router-link>
      </div>

      <div class="nav-controls">
        <SearchSelect v-model="currentTheme" :options="themeOptions" :searchable="false" />
        <button class="nav-lang-btn" @click="toggleLang">{{ locale === "zh" ? "EN" : "中" }}</button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.mgmt-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.mgmt-nav.scrolled {
  border-bottom-color: var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.mgmt-nav-inner {
  max-width: 1160px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 28px;
  height: 56px;
}

.nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-duration);
}
.nav-back:hover {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.05);
}
.nav-back:active { transform: scale(0.95); }

.nav-tabs {
  display: flex;
  gap: 2px;
  flex: 1;
  background: var(--glass-highlight);
  border-radius: 12px;
  padding: 4px;
  border: 1px solid var(--glass-border);
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.nav-tab:hover {
  background: var(--surface-bg);
  color: var(--text-primary);
}
.nav-tab.active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.nav-tab svg {
  flex-shrink: 0;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-select {
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--glass-highlight);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: border-color var(--transition-duration), box-shadow var(--transition-duration);
}
.nav-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.nav-lang-btn {
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  min-width: 36px;
  text-align: center;
  transition: all var(--transition-duration);
}
.nav-lang-btn:hover {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.05);
}
.nav-lang-btn:active { transform: scale(0.95); }

@media (max-width: 768px) {
  .mgmt-nav-inner {
    padding: 0 12px;
    gap: 8px;
  }
  .nav-tab {
    padding: 7px 10px;
    font-size: 12px;
    gap: 4px;
  }
  .nav-tab svg {
    width: 13px;
    height: 13px;
  }
}

@media (max-width: 480px) {
  .nav-tab span {
    display: none;
  }
  .nav-tab {
    padding: 7px 12px;
    gap: 0;
  }
  .nav-tab svg {
    width: 16px;
    height: 16px;
    margin: 0 auto;
  }
  .nav-tabs {
    justify-content: center;
  }
}
</style>
