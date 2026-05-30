import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig(({ mode }) => {
  const isProd = mode === "production"
  return {
    plugins: [vue()],
    define: {
      __APP_CONFIG__: JSON.stringify({
        apiAuthMe: isProd ? "{wcm_api_auth_me}" : "//localhost:8005/api/v1/auth/me",
        apiSessions: isProd ? "{wcm_api_sessions}" : "//localhost:8005/api/v1/sessions",
        apiSession: isProd ? "{wcm_api_session}" : "//localhost:8005/api/v1/sessions/{id}",
        apiSessionMessages: isProd ? "{wcm_api_session_messages}" : "//localhost:8005/api/v1/sessions/{id}/messages",
        apiScenarios: isProd ? "{wcm_api_scenarios}" : "//localhost:8005/api/v1/scenarios",
        apiScenarioDetail: isProd ? "{wcm_api_scenario_detail}" : "//localhost:8005/api/v1/scenarios/{id}",
        apiAgents: isProd ? "{wcm_api_agents}" : "//localhost:8005/api/v1/agents",
        apiChat: isProd ? "{wcm_api_chat}" : "//localhost:8005/api/v1/chat/{id}",
        apiComponentSources: isProd ? "{wcm_api_component_sources}" : "//localhost:8005/api/v1/component-sources",
        apiEvalJobs: isProd ? "{wcm_api_eval_jobs}" : "//localhost:8005/api/v1/eval/jobs",
        apiEvalJob: isProd ? "{wcm_api_eval_job}" : "//localhost:8005/api/v1/eval/jobs/{id}",
        apiEvalResults: isProd ? "{wcm_api_eval_results}" : "//localhost:8005/api/v1/eval/results/{id}/{filename}",
        enableEval: true,
        loginUrl: isProd ? "{wcm_login_url}" : "//localhost:8005/api/v1/dev/login",
        logoutUrl: isProd ? "{wcm_logout_url}" : "//localhost:8005/api/v1/dev/logout",
        apiToolGeneratorGenerate: isProd ? "{wcm_api_tool_generator_generate}" : "//localhost:8005/api/v1/tool-generator/generate",
        apiToolGeneratorTools: isProd ? "{wcm_api_tool_generator_tools}" : "//localhost:8005/api/v1/tool-generator/tools",
        apiGeneratedToolTrial: isProd ? "{wcm_api_generated_tool_trial}" : "//localhost:8005/api/v1/tool-generator/tools/{name}/trial",
      }),
    },
  }
})
