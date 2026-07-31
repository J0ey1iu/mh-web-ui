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
        class="nav-switch"
        role="switch"
        :aria-checked="currentTheme === 'dark'"
        :title="currentTheme === 'dark' ? t('theme_light') : t('theme_dark')"
        @click="toggleTheme"
      >
        <span class="switch-track" :class="{ on: currentTheme === 'dark' }">
          <span class="switch-icon left" aria-hidden="true">☀</span>
          <span class="switch-icon right" aria-hidden="true">☾</span>
          <span class="switch-thumb"></span>
        </span>
      </button>
      <button
        class="nav-switch"
        role="switch"
        :aria-checked="locale === 'en'"
        @click="toggleLang"
      >
        <span class="switch-track" :class="{ on: locale === 'en' }">
          <span class="switch-icon left" aria-hidden="true">中</span>
          <span class="switch-icon right" aria-hidden="true">EN</span>
          <span class="switch-thumb"></span>
        </span>
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

/* ── 底部 switch 控件 ── */
.sidebar-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid var(--glass-border);
}

.nav-switch {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
  line-height: 0;
}

.switch-track {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  border-radius: 999px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  transition: background 0.2s ease, border-color 0.2s ease;
}
.switch-track.on {
  background: var(--accent);
  border-color: var(--accent);
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s ease;
  z-index: 2;
}
.switch-track.on .switch-thumb {
  transform: translateX(24px);
}

.switch-icon {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  line-height: 1;
  color: var(--text-secondary);
  z-index: 1;
  pointer-events: none;
}
.switch-icon.left { left: 8px; }
.switch-icon.right { right: 8px; }
.switch-track.on .switch-icon {
  color: #fff;
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
    gap: 12px;
    padding: 14px 0;
  }
  .switch-track {
    width: 44px;
    height: 24px;
  }
  .switch-thumb {
    width: 18px;
    height: 18px;
  }
  .switch-track.on .switch-thumb {
    transform: translateX(20px);
  }
  .switch-icon {
    font-size: 9px;
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
