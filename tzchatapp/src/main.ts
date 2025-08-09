import { createApp } from 'vue'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import router from './router'

import '@ionic/vue/css/core.css'
import 'emoji-picker-element'

// ✅ Web Components 등록 (ion-modal 등 사용 가능하게 함)
import { defineCustomElements } from '@ionic/pwa-elements/loader'

const app = createApp(App)

app.use(IonicVue)
app.use(router)

router.isReady().then(() => {
  app.mount('#app')
  defineCustomElements(window)  // ✅ ion-modal 작동에 필요
})
