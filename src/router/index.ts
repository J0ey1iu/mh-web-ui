import { createRouter, createWebHistory } from "vue-router"
import MainLayout from "../components/MainLayout.vue"
import ComponentsDemoPage from "../pages/ComponentsDemoPage.vue"

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/components-demo",
      name: "components-demo",
      component: ComponentsDemoPage,
    },
    {
      path: "/",
      name: "chat",
      component: MainLayout,
    },
  ],
})

export default router
