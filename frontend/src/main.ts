import { createApp } from 'vue'
import * as Vue from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './plugins/i18n'
import { installPluginSystem } from './plugins'
import './assets/style.css'
import './styles/typography.css'

;(window as any).__sloprockVue = Vue

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)

// Install plugin system: wires PluginEventBus, SlotManager, and backward-compat
// window.sloprock adapter (so pitch_yin and other legacy scripts keep working)
installPluginSystem(app)

app.mount('#app')
