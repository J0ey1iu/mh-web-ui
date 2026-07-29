export interface AppConfig {
  apiAuthMe: string
  apiSessions: string
  apiSession: string
  apiSessionMessages: string
  apiScenarios: string
  apiScenarioDetail: string
  apiAgents: string
  apiChat: string
  apiSessionCompact: string
  apiFeedback: string
  apiComponentSources: string
  loginUrl: string
  apiAuthLogout: string
  apiManagementScenarios: string
  apiManagementScenario: string
  apiManagementAgents: string
  apiManagementAgent: string
  apiManagementTools: string
  apiManagementTool: string
  apiManagementFeedback: string
  apiManagementFeedbackSession: string
  apiManagementFeedbackExport: string
  apiManagementFeedbackBatchDelete: string
  apiManagementProviders: string
  apiManagementProviderConfigs: string
  apiManagementProviderConfig: string
  apiManagementAgentTypes: string
}

declare const __APP_CONFIG__: AppConfig

export const appConfig: AppConfig = __APP_CONFIG__
