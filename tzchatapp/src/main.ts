import { createApp } from 'vue'
import App from './App.vue'
import { IonicVue } from '@ionic/vue'
import router from './router'


/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/* ✅ Dark theme palette for system dark mode */
import '@ionic/vue/css/palettes/dark.system.css';

/* Theme variables (사용자 정의 변수) */
import './theme/variables.css';


// ✅ Web Components 등록 (ion-modal 등 사용 가능하게 함)
import { defineCustomElements } from '@ionic/pwa-elements/loader'


import 'emoji-picker-element'


const app = createApp(App)

app.use(IonicVue)
app.use(router)

router.isReady().then(() => {
  app.mount('#app')
  defineCustomElements(window)  // ✅ ion-modal 작동에 필요
})
