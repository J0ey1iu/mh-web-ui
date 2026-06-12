export interface AppConfig {
  apiAuthMe: string
  apiSessions: string
  apiSession: string
  apiSessionMessages: string
  apiScenarios: string
  apiScenarioDetail: string
  apiAgents: string
  apiChat: string
  apiComponentSources: string
  loginUrl: string
  apiAuthLogout: string
  apiToolGeneratorGenerate: string
  apiToolGeneratorTools: string
  apiGeneratedToolTrial: string
  apiManagementScenarios: string
  apiManagementScenario: string
  apiManagementAgents: string
  apiManagementAgent: string
  apiManagementTools: string
  apiManagementTool: string
  apiManagementProviders: string
  apiAgentGeneratorGenerate: string
  apiAgentGeneratorAgents: string
  apiAgentGeneratorTrial: string
}

declare const __APP_CONFIG__: AppConfig

export const appConfig: AppConfig = __APP_CONFIG__
