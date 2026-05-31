<script setup lang="ts">
import { computed, ref, onMounted, watch, provide } from "vue"
import { useRoute, useRouter } from "vue-router"
import { storeToRefs } from "pinia"
import { useChatStore } from "../stores/chat"
import { useAuthStore } from "../stores/auth"
import { useI18nStore } from "../stores/i18n"
import { appConfig } from "../config"
import { TOOL_CONTEXT_KEY } from "../toolContext"
import { ensureComponentsLoaded } from "../toolComponentLoader"
import ChatView from "./ChatView.vue"
import AgentSelector from "./AgentSelector.vue"
import SkeletonBlock from "./SkeletonBlock.vue"

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const {
  sessions,
  currentSessionId,
  messages,
  streaming,
  backendOnline,
  error,
  currentScenario,
  availableScenarios,
  availableAgents,
  sessionsLoading,
  messagesLoading,
} = storeToRefs(chatStore)
const {
  loadSessions,
  selectSession,
  removeSession,
  sendMessage,
  cancelStream,
  loadScenarios,
  selectScenario,
  createSessionWithAgent,
  refreshLocaleData,
} = chatStore

const authStore = useAuthStore()
const { user: authUser } = storeToRefs(authStore)
const { checkAuth } = authStore

const hasEvalPermission = computed(() => {
  if (!appConfig.enableEval) return false
  const perms = authUser.value?.permissions
  if (!perms) return false
  return perms.some(p => p === "use:eval:*" || p === "*")
})

provide(TOOL_CONTEXT_KEY, { streaming, currentSessionId })

const drawerOpen = ref(false)
const menuOpen = ref(false)
const sceneMenuOpen = ref(false)
const theme = ref(localStorage.getItem("theme") || "light")

const showAgentSelector = ref(false)
const skipUrlWatch = ref(false)

watch(theme, (t) => {
  document.documentElement.setAttribute("data-theme", t)
  localStorage.setItem("theme", t)
})

document.documentElement.setAttribute("data-theme", theme.value)

const i18nStore = useI18nStore()
const { t, setLocale: setI18nLocale } = i18nStore
const { locale } = storeToRefs(i18nStore)

function setTheme(t: string) {
  theme.value = t
  menuOpen.value = false
}

function setLocaleHandler(l: "zh" | "en") {
  setI18nLocale(l)
  menuOpen.value = false
  refreshLocaleData()
}

function selectSessionHandler(id: string) {
  selectSession(id)
  showAgentSelector.value = false
  drawerOpen.value = false
}

function removeSessionHandler(id: string) {
  removeSession(id)
}

function handleNewChat() {
  showAgentSelector.value = true
}

function handleAgentSelect(agentName: string) {
  createSessionWithAgent(agentName)
  showAgentSelector.value = false
}

async function handleScenarioSelect(id: string) {
  sceneMenuOpen.value = false
  showAgentSelector.value = true
  await selectScenario(id)
}

onMounted(async () => {
  skipUrlWatch.value = true
  await checkAuth()
  ensureComponentsLoaded()
  await loadScenarios()
  // The scenario detail (loaded in selectScenario below) populates toolDisplayNames

  const sceneId = typeof route.query.scene === "string" ? route.query.scene : undefined
  const sessionId = typeof route.query.session === "string" ? route.query.session : undefined

  if (sceneId && availableScenarios.value.find((s) => s.id === sceneId)) {
    await selectScenario(sceneId)
  } else if (availableScenarios.value.length > 0) {
    await selectScenario(availableScenarios.value[0].id)
  }

  if (sessionId) {
    await selectSession(sessionId)
    showAgentSelector.value = false
  } else {
    showAgentSelector.value = true
  }

  await router.replace({
    query: {
      lang: locale.value,
      ...(currentScenario.value ? { scene: currentScenario.value.id } : {}),
      ...(currentSessionId.value ? { session: currentSessionId.value } : {}),
    },
  })

  skipUrlWatch.value = false
})

watch(() => [route.query.scene as string | undefined, route.query.session as string | undefined], async ([newScene, newSession], [oldScene, oldSession]) => {
  if (skipUrlWatch.value) return
  if (newScene && newScene !== oldScene && newScene !== currentScenario.value?.id) {
    if (availableScenarios.value.find((s) => s.id === newScene)) {
      await selectScenario(newScene)
    }
  }
  if (newSession !== oldSession && newSession !== currentSessionId.value) {
    if (newSession) {
      await selectSession(newSession)
      showAgentSelector.value = false
    } else {
      currentSessionId.value = null
      messages.value = []
      showAgentSelector.value = true
    }
  }
})

function handleSendMessage(text: string) {
  sendMessage(text)
}

function handleLogout() {
  const redirect = encodeURIComponent(window.location.origin)
  window.location.replace(`${appConfig.logoutUrl}?redirect=${redirect}`)
}
</script>

<template>
  <div class="layout">
    <header class="top-bar">
      <div class="scene-selector-wrap">
        <button class="header-btn scene-btn" @click="sceneMenuOpen = !sceneMenuOpen">
          <template v-if="currentScenario">
            <span class="scene-icon-small">{{ currentScenario.icon }}</span>
            <span class="scene-name">{{ currentScenario.name }}</span>
          </template>
          <SkeletonBlock v-else width="80px" height="18px" />
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div v-if="sceneMenuOpen" class="scene-dropdown">
          <template v-if="availableScenarios.length > 0">
            <button
              v-for="s in availableScenarios"
              :key="s.id"
              class="scene-option"
              :class="{ active: s.id === currentScenario?.id }"
              @click="handleScenarioSelect(s.id)"
            >
              <span class="scene-opt-icon">{{ s.icon }}</span>
              <div class="scene-opt-info">
                <span class="scene-opt-name">{{ s.name }}</span>
                <span class="scene-opt-desc">{{ s.description }}</span>
              </div>
            </button>
          </template>
          <div v-else class="scene-option-skel">
            <div v-for="i in 3" :key="i" class="scene-option" style="pointer-events:none">
              <SkeletonBlock variant="circle" width="20px" height="20px" />
              <div class="scene-opt-info">
                <SkeletonBlock width="100px" height="14px" />
                <div style="margin-top:2px"><SkeletonBlock width="140px" height="11px" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="spacer"></div>
      <button class="header-btn" @click="drawerOpen = true" aria-label="Sessions">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div class="hamburger-wrap">
        <button class="header-btn" @click="menuOpen = !menuOpen" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div v-if="menuOpen" class="dropdown">
          <div class="dropdown-label">{{ t("theme") }}</div>
          <button class="dropdown-item" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
            {{ t("theme_dark") }}
            <span v-if="theme === 'dark'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'light' }" @click="setTheme('light')">
            {{ t("theme_light") }}
            <span v-if="theme === 'light'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'dusk' }" @click="setTheme('dusk')">
            {{ t("theme_dusk") }}
            <span v-if="theme === 'dusk'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'sepia' }" @click="setTheme('sepia')">
            {{ t("theme_sepia") }}
            <span v-if="theme === 'sepia'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'lemonade' }" @click="setTheme('lemonade')">
            {{ t("theme_lemonade") }}
            <span v-if="theme === 'lemonade'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: theme === 'eclipse' }" @click="setTheme('eclipse')">
            {{ t("theme_eclipse") }}
            <span v-if="theme === 'eclipse'" class="check">✓</span>
          </button>
          <div class="dropdown-divider"></div>
          <div class="dropdown-label">{{ t("language") }}</div>
          <button class="dropdown-item" :class="{ active: locale === 'zh' }" @click="setLocaleHandler('zh')">
            中文
            <span v-if="locale === 'zh'" class="check">✓</span>
          </button>
          <button class="dropdown-item" :class="{ active: locale === 'en' }" @click="setLocaleHandler('en')">
            English
            <span v-if="locale === 'en'" class="check">✓</span>
          </button>
          <div class="dropdown-divider"></div>
          <div class="dropdown-user">
            <template v-if="authUser">
              <span class="user-name">{{ authUser.username }}</span>
              <span class="user-role">{{ authUser.roles[0]?.name }}</span>
            </template>
            <template v-else>
              <SkeletonBlock width="60%" height="14px" />
              <div style="margin-top:4px"><SkeletonBlock width="40%" height="11px" /></div>
            </template>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-label">{{ t("management") }}</div>
          <button
            v-if="authUser"
            class="dropdown-item"
            @click="router.push('/manage/scenes'); menuOpen = false"
          >
            Scenes
          </button>
          <button
            v-if="authUser"
            class="dropdown-item"
            @click="router.push('/manage/agents'); menuOpen = false"
          >
            Agents
          </button>
          <button
            v-if="authUser"
            class="dropdown-item"
            @click="router.push('/manage/tools'); menuOpen = false"
          >
            Tools
          </button>
          <div class="dropdown-divider"></div>
          <button
            v-if="authUser && hasEvalPermission"
            class="dropdown-item"
            @click="router.push('/manage/eval'); menuOpen = false"
          >
            {{ t("evaluation") }}
          </button>
          <button
            v-if="authUser"
            class="dropdown-item dropdown-logout"
            @click="handleLogout"
          >
            {{ t("sign_out") }}
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="sceneMenuOpen"
      class="menu-overlay"
      @click="sceneMenuOpen = false"
    ></div>
    <div
      v-if="menuOpen"
      class="menu-overlay"
      @click="menuOpen = false"
    ></div>
    <div
      v-if="drawerOpen"
      class="drawer-overlay"
      @click="drawerOpen = false"
    ></div>
    <aside class="drawer" :class="{ open: drawerOpen }">
      <div class="drawer-header">
        <h2>{{ t("sessions") }}</h2>
        <button class="btn-close" @click="drawerOpen = false">&times;</button>
      </div>
      <div class="session-list">
        <template v-if="sessionsLoading">
          <div v-for="i in 5" :key="i" class="session-item" style="pointer-events:none">
            <SkeletonBlock width="75%" height="16px" />
            <div style="margin-top:4px"><SkeletonBlock width="50%" height="12px" /></div>
          </div>
        </template>
        <template v-else>
          <div
            v-for="s in sessions"
            :key="s.memory_id"
            :class="[
              'session-item',
              { active: s.memory_id === currentSessionId },
            ]"
            @click="selectSessionHandler(s.memory_id)"
          >
            <div class="session-title">{{ s.title }}</div>
            <div class="session-meta">
              {{ s.agent_name }} &middot; {{ s.message_count }} msgs
            </div>
            <button
              class="btn-delete"
              @click.stop="removeSessionHandler(s.memory_id)"
              title="Delete"
            >
              &times;
            </button>
          </div>
          <div v-if="sessions.length === 0" class="empty-hint">
            {{ t("no_conversations") }}
          </div>
        </template>
      </div>
    </aside>

    <div class="main-content">
      <div v-if="backendOnline === false" class="offline-banner">
        {{ t("offline_banner") }}
        <button class="btn-retry" @click="loadSessions()">{{ t("retry") }}</button>
      </div>
      <div v-if="error" class="error-toast" @click="chatStore.clearError()">
        <span class="error-toast-text">{{ error }}</span>
        <button class="error-toast-close" @click.stop="chatStore.clearError()">&times;</button>
      </div>

      <div v-if="showAgentSelector" class="agent-selector-center">
        <AgentSelector
          :scenario="currentScenario"
          :agents="availableAgents"
          @select="handleAgentSelect"
        />
      </div>
      <ChatView
        v-else
        :messages="messages"
        :messages-loading="messagesLoading"
        :streaming="streaming"
        :disabled="!backendOnline"
        @send="handleSendMessage"
        @cancel="cancelStream"
        @new-chat="handleNewChat"
      />
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--page-bg);
}
.top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
  z-index: 200;
}
.header-btn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--text-primary);
  border-radius: 8px;
  transition: background var(--transition-duration);
}
.header-btn:hover {
  background: var(--glass-highlight);
}
.spacer {
  flex: 1;
}
.hamburger-wrap {
  position: relative;
}
.scene-selector-wrap {
  position: relative;
}
.scene-btn {
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  background: var(--glass-highlight);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  transition: border-color var(--transition-duration), backdrop-filter var(--transition-duration), -webkit-backdrop-filter var(--transition-duration);
}
.scene-btn:hover {
  border-color: var(--accent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.scene-icon-small {
  font-size: 16px;
}
.scene-name {
  color: var(--text-primary);
  font-weight: 500;
}
.scene-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 250px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  box-shadow: var(--glass-shadow);
  z-index: 201;
  overflow: hidden;
}
.scene-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background var(--transition-duration);
}
.scene-option:hover {
  background: var(--glass-highlight);
}
.scene-option.active {
  background: var(--accent-dim);
}
.scene-opt-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.scene-opt-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.scene-opt-name {
  font-weight: 500;
}
.scene-opt-desc {
  font-size: 11px;
  color: var(--text-secondary);
}
.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: var(--surface-raised);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  box-shadow: var(--glass-shadow);
  z-index: 201;
  overflow: hidden;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 14px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background var(--transition-duration);
}
.dropdown-item:hover {
  background: var(--glass-highlight);
}
.dropdown-item.active {
  color: var(--accent);
}
.dropdown-item .check {
  margin-left: auto;
  color: var(--accent);
}
.dropdown-label {
  padding: 8px 14px 3px;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 600;
}
.dropdown-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 4px 0;
}
.dropdown-user {
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dropdown-user .user-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}
.dropdown-user .user-role {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: capitalize;
}
.dropdown-logout {
  color: #ef4444 !important;
  font-weight: 600;
}
.dropdown-logout:hover {
  background: rgba(239, 68, 68, 0.1) !important;
}
.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
}
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 100;
}
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 280px;
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  z-index: 101;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--glass-shadow);
}
.drawer.open {
  transform: translateX(0);
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px;
  border-bottom: 1px solid var(--glass-border);
}
.drawer-header h2 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 600;
}
.btn-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background var(--transition-duration), color var(--transition-duration);
}
.btn-close:hover {
  background: var(--glass-highlight);
  color: var(--text-primary);
}
.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px 8px;
}
.session-item {
  position: relative;
  padding: 10px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background var(--transition-duration);
}
.session-item:hover {
  background: var(--glass-highlight);
}
.session-item.active {
  background: var(--accent-dim);
}
.session-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 20px;
  color: var(--text-primary);
}
.session-meta {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.btn-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background var(--transition-duration), color var(--transition-duration);
}
.btn-delete:hover {
  background: var(--delete-hover-bg);
  color: var(--danger-text);
}
.empty-hint {
  text-align: center;
  color: var(--text-muted);
  padding: 32px 16px;
  font-size: 13px;
}
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.agent-selector-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 24px;
}
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: var(--danger);
  color: var(--danger-text);
  padding: 10px 16px;
  font-size: 13px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.btn-retry {
  background: var(--danger-hover);
  color: var(--text-primary);
  border: none;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: background var(--transition-duration);
}
.btn-retry:hover {
  background: var(--danger-text);
}
.error-toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--danger-text);
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  z-index: 9999;
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  max-width: 80vw;
  box-shadow: var(--glass-shadow);
}
.error-toast-text {
  flex: 1;
  word-break: break-word;
}
.error-toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--danger-text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  padding: 0;
  transition: opacity var(--transition-duration);
}
.error-toast-close:hover {
  opacity: 1;
}
</style>
