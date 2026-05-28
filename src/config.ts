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
  apiEvalJobs: string
  apiEvalJob: string
  apiEvalResults: string
  enableEval: boolean
  loginUrl: string
  logoutUrl: string
}

declare const __APP_CONFIG__: AppConfig

export const appConfig: AppConfig = __APP_CONFIG__
