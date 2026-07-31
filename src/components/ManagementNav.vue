<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "../stores/auth"
import { useI18nStore } from "../stores/i18n"
import SearchSelect from "./SearchSelect.vue"
import BrandingHeader from "./BrandingHeader.vue"
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
const hasFeedbackPermission = computed(() => hasAnyPermission("manage:feedback:"))
const hasMetricsPermission = computed(() => hasAnyPermission("manage:metrics:"))

const themes = [
  { value: "light", labelKey: "theme_light" },
  { value: "dark", labelKey: "theme_dark" },
]

const themeOptions = computed(() =>
  themes.map(th => ({ value: th.value, label: t(th.labelKey) }))
)

const currentTheme = ref(localStorage.getItem("theme") || "light")

function setTheme(v: string) {
  currentTheme.value = v
  document.documentElement.setAttribute("data-theme", v)
  localStorage.setItem("theme", v)
}

watch(currentTheme, setTheme)
onMounted(async () => {
  await authStore.checkAuth()
  setTheme(currentTheme.value)
})

function isActive(path: string) {
  return route.path.startsWith(path)
}

function toggleLang() {
  setLocale(locale.value === "zh" ? "en" : "zh")
}
</script>

<template>
  <nav class="mgmt-nav">
    <div class="sidebar-top">
      <BrandingHeader />
      <button class="nav-back" @click="router.back()" :title="t('mgmt_back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
    </div>

    <div class="sidebar-tabs">
      <router-link v-if="hasMetricsPermission" to="/manage/metrics" class="sidebar-tab" :class="{ active: isActive('/manage/metrics') }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>
        </svg>
        <span>{{ t("mgmt_metrics") }}</span>
      </router-link>
      <router-link v-if="hasScenePermission" to="/manage/scenes" class="sidebar-tab" :class="{ active: isActive('/manage/scenes') }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span>{{ t("mgmt_scenes") }}</span>
      </router-link>
      <router-link v-if="hasAgentPermission" to="/manage/agents" class="sidebar-tab" :class="{ active: isActive('/manage/agents') }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span>{{ t("mgmt_agents") }}</span>
      </router-link>
      <router-link v-if="hasToolPermission" to="/manage/tools" class="sidebar-tab" :class="{ active: isActive('/manage/tools') }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
        <span>{{ t("mgmt_tools") }}</span>
      </router-link>
      <router-link v-if="hasFeedbackPermission" to="/manage/feedback" class="sidebar-tab" :class="{ active: isActive('/manage/feedback') }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>{{ t("feedback_management") }}</span>
      </router-link>
      <router-link v-if="hasAgentPermission" to="/manage/providers" class="sidebar-tab" :class="{ active: isActive('/manage/providers') }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span>{{ t("mgmt_providers") }}</span>
      </router-link>
    </div>

    <div class="sidebar-controls">
      <SearchSelect v-model="currentTheme" :options="themeOptions" :searchable="false" />
      <button class="nav-lang-btn" @click="toggleLang">{{ locale === "zh" ? "EN" : "中" }}</button>
    </div>
  </nav>
</template>

<style scoped>
.mgmt-nav {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 220px;
  display: flex;
  flex-direction: column;
  background: var(--page-bg);
  border-right: 1px solid var(--glass-border);
  z-index: 200;
}

.sidebar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--glass-border);
}

.nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
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

.sidebar-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.sidebar-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.sidebar-tab:hover {
  background: var(--glass-highlight);
  color: var(--text-primary);
}
.sidebar-tab.active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}
.sidebar-tab svg {
  flex-shrink: 0;
}

.sidebar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-top: 1px solid var(--glass-border);
}
.sidebar-controls .nav-select {
  flex: 1;
  min-width: 0;
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
  flex-shrink: 0;
  transition: all var(--transition-duration);
}
.nav-lang-btn:hover {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.05);
}
.nav-lang-btn:active { transform: scale(0.95); }

/* 中屏：收窄为纯图标列 */
@media (max-width: 900px) {
  .mgmt-nav {
    width: 64px;
  }
  .sidebar-top {
    justify-content: center;
    padding: 14px 0;
  }
  .sidebar-top :deep(.branding-title) {
    display: none;
  }
  .nav-back {
    display: none;
  }
  .sidebar-tabs {
    padding: 12px 8px;
  }
  .sidebar-tab {
    justify-content: center;
    padding: 12px 0;
    gap: 0;
  }
  .sidebar-tab span {
    display: none;
  }
  .sidebar-controls {
    justify-content: center;
    padding: 14px 0;
  }
  .sidebar-controls .nav-select {
    display: none;
  }
}

/* 窄屏：折叠为顶部横条（品牌 + 横排药丸 tab） */
@media (max-width: 600px) {
  .mgmt-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: auto;
    width: auto;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--glass-border);
  }
  .sidebar-top {
    padding: 10px 12px;
  }
  .sidebar-tabs {
    flex-direction: row;
    gap: 4px;
    padding: 0 12px 10px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .mgmt-nav ::-webkit-scrollbar {
    display: none;
  }
  .sidebar-tab {
    padding: 8px 14px;
    gap: 6px;
  }
  .sidebar-tab span {
    display: inline;
  }
  .sidebar-controls {
    display: none;
  }
}
</style>
