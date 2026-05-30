import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router"
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
    path: "/scenes",
    name: "scenes",
    component: () => import("../pages/SceneManagementPage.vue"),
  },
  {
    path: "/agents",
    name: "agents",
    component: () => import("../pages/AgentManagementPage.vue"),
  },
  {
    path: "/tools",
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
    path: "/eval",
    name: "eval",
    component: () => import("../pages/EvalPage.vue"),
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
