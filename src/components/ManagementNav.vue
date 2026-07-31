<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"
import { useRoute } from "vue-router"
import { useAuthStore } from "../stores/auth"
import { useI18nStore } from "../stores/i18n"
import BrandingHeader from "./BrandingHeader.vue"
import { storeToRefs } from "pinia"

const route = useRoute()
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

function toggleTheme() {
  setTheme(currentTheme.value === "dark" ? "light" : "dark")
}

function toggleLang() {
  setLocale(locale.value === "zh" ? "en" : "zh")
}

function isActive(path: string) {
  return route.path.startsWith(path)
}
</script>

<template>
  <nav class="mgmt-nav">
    <div class="sidebar-top">
      <BrandingHeader />
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
      <button
        class="nav-icon-btn"
        :aria-pressed="currentTheme === 'dark'"
        :title="currentTheme === 'dark' ? t('theme_light') : t('theme_dark')"
        @click="toggleTheme"
      >
        <svg
          v-if="currentTheme === 'dark'"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      </button>
      <button class="nav-icon-btn lang" :aria-pressed="locale === 'en'" @click="toggleLang">
        <span class="lang-label">{{ locale === "zh" ? "EN" : "中" }}</span>
      </button>
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
  justify-content: center;
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--glass-border);
}

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

/* ── 底部图标按钮控件 ── */
.sidebar-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid var(--glass-border);
}

.nav-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--text-primary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-duration);
}
.nav-icon-btn:hover {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.05);
}
.nav-icon-btn:active { transform: scale(0.95); }
.nav-icon-btn[aria-pressed="true"] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.nav-icon-btn .lang-label {
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  line-height: 1;
}

/* 中屏：收窄为纯图标列，控件纵向排列 */
@media (max-width: 900px) {
  .mgmt-nav {
    width: 64px;
  }
  .sidebar-top {
    padding: 14px 0;
  }
  .sidebar-top :deep(.branding-title) {
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
    flex-direction: column;
    gap: 10px;
    padding: 14px 0;
  }
  .nav-icon-btn {
    width: 32px;
    height: 32px;
  }
}
</style>
