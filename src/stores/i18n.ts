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
    characters: "字符",
    evaluation: "评测",
    eval_new_job: "新建评测",
    eval_job_list: "评测历史",
    eval_scenario: "评测场景",
    eval_inputs: "测试输入",
    eval_add_input: "+ 添加输入",
    eval_agent: "运行 Agent",
    eval_input_text: "输入内容",
    eval_max_concurrency: "最大并发",
    eval_max_iterations: "最大迭代",
    eval_run: "运行评测",
    eval_running: "运行中",
    eval_completed: "已完成",
    eval_failed: "失败",
    eval_pending: "等待中",
    eval_interrupted: "中断",
    eval_no_jobs: "暂无评测记录",
    eval_no_agents_for_scenario: "该场景没有可用 Agent",
    eval_avg_time: "平均耗时",
    eval_total_tokens: "总 Token",
    eval_total_cost: "总费用",
    eval_view_report: "查看报告",
    eval_run_id: "ID",
    eval_input: "输入",
    eval_status: "状态",
    eval_time: "耗时",
    eval_tools: "工具调用",
    eval_tokens: "Token",
    eval_batch_import: "批量导入",
    eval_batch_import_download: "下载 Excel 模板",
    eval_batch_import_upload: "上传 Excel",
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
    characters: "characters",
    evaluation: "Evaluation",
    eval_new_job: "New Evaluation",
    eval_job_list: "Job History",
    eval_scenario: "Scenario",
    eval_inputs: "Test Inputs",
    eval_add_input: "+ Add Input",
    eval_agent: "Agent",
    eval_input_text: "Input Content",
    eval_max_concurrency: "Max Concurrency",
    eval_max_iterations: "Max Iterations",
    eval_run: "Run Evaluation",
    eval_running: "Running",
    eval_completed: "Completed",
    eval_failed: "Failed",
    eval_pending: "Pending",
    eval_interrupted: "Interrupted",
    eval_no_jobs: "No evaluation jobs yet",
    eval_no_agents_for_scenario: "No agents available for this scenario",
    eval_avg_time: "Avg Time",
    eval_total_tokens: "Total Tokens",
    eval_total_cost: "Total Cost",
    eval_view_report: "View Report",
    eval_run_id: "ID",
    eval_input: "Input",
    eval_status: "Status",
    eval_time: "Time",
    eval_tools: "Tools",
    eval_tokens: "Tokens",
    eval_batch_import: "Batch Import",
    eval_batch_import_download: "Download Excel Template",
    eval_batch_import_upload: "Upload Excel",
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
