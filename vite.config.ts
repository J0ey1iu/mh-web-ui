import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig(({ mode }) => {
  const isProd = mode === "production"
  return {
    base: "./",
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
        loginUrl: isProd ? "{wcm_login_url}" : "//localhost:8005/api/v1/dev/login",
        apiAuthLogout: isProd ? "{wcm_api_auth_logout}" : "//localhost:8005/api/v1/auth/logout",
        apiToolGeneratorGenerate: isProd ? "{wcm_api_tool_generator_generate}" : "//localhost:8005/api/v1/tool-generator/generate",
        apiToolGeneratorTools: isProd ? "{wcm_api_tool_generator_tools}" : "//localhost:8005/api/v1/tool-generator/tools",
        apiGeneratedToolTrial: isProd ? "{wcm_api_generated_tool_trial}" : "//localhost:8005/api/v1/tool-generator/tools/{name}/trial",
        apiManagementScenarios: isProd ? "{wcm_api_management_scenarios}" : "//localhost:8005/api/v1/management/scenarios",
        apiManagementScenario: isProd ? "{wcm_api_management_scenario}" : "//localhost:8005/api/v1/management/scenarios/{id}",
        apiManagementAgents: isProd ? "{wcm_api_management_agents}" : "//localhost:8005/api/v1/management/agents",
        apiManagementAgent: isProd ? "{wcm_api_management_agent}" : "//localhost:8005/api/v1/management/agents/{name}",
        apiManagementTools: isProd ? "{wcm_api_management_tools}" : "//localhost:8005/api/v1/management/tools",
        apiManagementTool: isProd ? "{wcm_api_management_tool}" : "//localhost:8005/api/v1/management/tools/{name}",
        apiManagementProviders: isProd ? "{wcm_api_management_providers}" : "//localhost:8005/api/v1/management/providers",
        apiAgentGeneratorGenerate: isProd ? "{wcm_api_agent_generator_generate}" : "//localhost:8005/api/v1/agent-generator/generate",
        apiAgentGeneratorAgents: isProd ? "{wcm_api_agent_generator_agents}" : "//localhost:8005/api/v1/agent-generator/agents",
        apiAgentGeneratorTrial: isProd ? "{wcm_api_agent_generator_trial}" : "//localhost:8005/api/v1/agent-generator/agents/{name}/trial",
      }),
    },
  }
})
