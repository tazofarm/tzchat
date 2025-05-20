import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';

//page정리
import HomePage from '../views/HomePage.vue'
import SettingPage from '../views/SettingPage.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/', redirect: '/home'
  },

  //라우터 정리
  { path: '/home',name: 'Home',component: HomePage },
  { path: '/setting',name: 'Setting',component: SettingPage }

]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
