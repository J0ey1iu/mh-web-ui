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
    path: "/tool-creator",
    name: "tool-creator",
    component: () => import("../pages/ToolCreatorPage.vue"),
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
