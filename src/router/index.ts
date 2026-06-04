import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router"
import MainLayout from "../components/MainLayout.vue"
import ComponentsDemoPage from "../pages/ComponentsDemoPage.vue"
import { appConfig } from "../config"

const routes: RouteRecordRaw[] = [
  {
    path: "/components-demo",
    name: "components-demo",
    component: ComponentsDemoPage,
  },
  {
    path: "/manage/scenes",
    name: "scenes",
    component: () => import("../pages/SceneManagementPage.vue"),
  },
  {
    path: "/manage/agents",
    name: "agents",
    component: () => import("../pages/AgentManagementPage.vue"),
  },
  {
    path: "/manage/tools",
    name: "tools",
    component: () => import("../pages/ToolManagementPage.vue"),
  },
  {
    path: "/",
    name: "chat",
    component: MainLayout,
  },
]

if (appConfig.enableEval) {
  routes.push({
    path: "/manage/eval",
    name: "eval",
    component: () => import("../pages/EvalPage.vue"),
  })
}

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
