import { defineStore } from "pinia"
import { ref, watch } from "vue"
import router from "../router"

type Locale = "zh" | "en"

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    sessions: "会话",
    no_conversations: "暂无对话",
    sign_out: "退出登录",
    theme_dark: "午夜",
    theme_light: "浅色",
    theme_dusk: "暮色",
    theme_sepia: "怀旧",
    theme_eclipse: "暗红",
    theme_lemonade: "柠檬",
    theme: "主题",
    language: "语言",
    account: "账户",
    chinese: "中文",
    english: "English",
    select_scene: "选择场景",
    reasoning: "推理",
    offline_banner: "无法连接到后端，请确保服务运行在 8000 端口",
    permission_denied: "权限不足，请联系管理员获取访问权限",
    retry: "重试",
    new_chat: "新建对话",
    start_conversation: "开始对话",
    type_message: "输入消息…",
    send: "发送",
    stop: "停止",
    delete: "删除",
    username: "用户名",
    password: "密码",
    sign_in: "登录",
    create_account: "注册",
    no_agents: "当前场景没有可用 Agent",
    signing_in: "登录中…",
    creating: "注册中…",
    account_created: "账户创建成功，请登录",
    already_have_account: "已有账户？登录",
    create_new_account: "创建新账户",
    sign_in_title: "登录您的账户",
    register_title: "创建新账户",
    scroll_to_bottom: "回到底部",
    copy: "复制",
  },
  en: {
    sessions: "Sessions",
    no_conversations: "No conversations yet",
    sign_out: "Sign out",
    theme_dark: "Midnight",
    theme_light: "Light",
    theme_dusk: "Dusk",
    theme_sepia: "Sepia",
    theme_eclipse: "Eclipse",
    theme_lemonade: "Lemonade",
    theme: "Theme",
    language: "Language",
    account: "Account",
    chinese: "中文",
    english: "English",
    select_scene: "Select Scene",
    reasoning: "Reasoning",
    offline_banner: "Cannot connect to backend. Make sure the server is running on port 8000.",
    permission_denied: "Permission denied. Please contact your administrator.",
    retry: "Retry",
    new_chat: "New Chat",
    start_conversation: "Start a conversation",
    type_message: "Type a message…",
    send: "Send",
    stop: "Stop",
    delete: "Delete",
    username: "Username",
    password: "Password",
    sign_in: "Sign in",
    create_account: "Create account",
    no_agents: "No agents available in this scenario",
    account_created: "Account created. Sign in below.",
    already_have_account: "Already have an account? Sign in",
    create_new_account: "Create a new account",
    sign_in_title: "Sign in to your account",
    register_title: "Create a new account",
    scroll_to_bottom: "Scroll to bottom",
    copy: "Copy",
  },
}

function persistLocale(l: Locale) {
  localStorage.setItem("locale", l)
}

export const useI18nStore = defineStore("i18n", () => {
  const queryLang = router.currentRoute.value.query.lang as string | undefined
  const initial: Locale = (
    queryLang === "zh" || queryLang === "en" ? queryLang : null
  ) || (localStorage.getItem("locale") as Locale) || "zh"
  persistLocale(initial)

  const locale = ref<Locale>(initial)

  watch(() => router.currentRoute.value.query.lang, (newLang) => {
    if ((newLang === "zh" || newLang === "en") && newLang !== locale.value) {
      locale.value = newLang
      persistLocale(newLang)
    }
  })

  function t(key: string): string {
    return messages[locale.value][key] ?? key
  }

  function setLocale(l: Locale) {
    locale.value = l
    persistLocale(l)
    router.replace({ query: { ...router.currentRoute.value.query, lang: l } })
  }

  return { locale, t, setLocale }
})
