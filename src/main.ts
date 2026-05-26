import * as Vue from "vue"
import { createPinia } from "pinia"
import App from "./App.vue"
import router from "./router"
import "./style.css"

;(window as any).Vue = Vue

const app = Vue.createApp(App)
app.use(createPinia())
app.use(router)
app.mount("#app")
