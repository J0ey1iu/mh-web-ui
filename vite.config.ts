import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig(({ mode }) => {
  const isProd = mode === "production"
  const isMhc = mode === "mhc"
  const apiPrefix = isMhc ? "" : "//localhost:8005"
  return {
    base: "./",
    plugins: [vue()],
    define: {
      __APP_CONFIG__: JSON.stringify({
        apiAuthMe: isProd ? "{wcm_api_auth_me}" : `${apiPrefix}/api/v1/auth/me`,
        apiSessions: isProd ? "{wcm_api_sessions}" : `${apiPrefix}/api/v1/sessions`,
        apiSession: isProd ? "{wcm_api_session}" : `${apiPrefix}/api/v1/sessions/{id}`,
        apiSessionMessages: isProd ? "{wcm_api_session_messages}" : `${apiPrefix}/api/v1/sessions/{id}/messages`,
        apiScenarios: isProd ? "{wcm_api_scenarios}" : `${apiPrefix}/api/v1/scenarios`,
        apiScenarioDetail: isProd ? "{wcm_api_scenario_detail}" : `${apiPrefix}/api/v1/scenarios/{id}`,
        apiAgents: isProd ? "{wcm_api_agents}" : `${apiPrefix}/api/v1/agents`,
        apiChat: isProd ? "{wcm_api_chat}" : `${apiPrefix}/api/v1/chat/{id}`,
        apiComponentSources: isProd ? "{wcm_api_component_sources}" : `${apiPrefix}/api/v1/component-sources`,
        loginUrl: isProd ? "{wcm_login_url}" : `${apiPrefix}/api/v1/dev/login`,
        apiAuthLogout: isProd ? "{wcm_api_auth_logout}" : `${apiPrefix}/api/v1/auth/logout`,
        apiManagementScenarios: isProd ? "{wcm_api_management_scenarios}" : `${apiPrefix}/api/v1/management/scenarios`,
        apiManagementScenario: isProd ? "{wcm_api_management_scenario}" : `${apiPrefix}/api/v1/management/scenarios/{id}`,
        apiManagementAgents: isProd ? "{wcm_api_management_agents}" : `${apiPrefix}/api/v1/management/agents`,
        apiManagementAgent: isProd ? "{wcm_api_management_agent}" : `${apiPrefix}/api/v1/management/agents/{name}`,
        apiManagementTools: isProd ? "{wcm_api_management_tools}" : `${apiPrefix}/api/v1/management/tools`,
        apiManagementTool: isProd ? "{wcm_api_management_tool}" : `${apiPrefix}/api/v1/management/tools/{name}`,
        apiManagementProviders: isProd ? "{wcm_api_management_providers}" : `${apiPrefix}/api/v1/management/providers`,
        apiManagementProviderConfigs: isProd ? "{wcm_api_management_provider_configs}" : `${apiPrefix}/api/v1/management/provider-configs`,
        apiManagementProviderConfig: isProd ? "{wcm_api_management_provider_config}" : `${apiPrefix}/api/v1/management/provider-configs/{name}`,
      }),
    },
  }
})
