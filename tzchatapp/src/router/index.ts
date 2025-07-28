import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '@/views/LoginPage.vue'
import SignupPage from '@/views/SignupPage.vue'
import HomePage from '@/views/HomePage.vue'
import Success from '@/components/pages/Success.vue'

// 각 페이지 컴포넌트 import
import Page0 from '@/components/pages/0_emergency.vue'
import Page1 from '@/components/pages/1_alluser.vue'
import Page2 from '@/components/pages/2_target.vue'
import Page3 from '@/components/pages/3_list.vue'
import Page4 from '@/components/pages/4_chatroom.vue'
import Page5 from '@/components/pages/5_find.vue'
import Page6 from '@/components/pages/6_profile.vue'
import Page7 from '@/components/pages/7_setting.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginPage },
  { path: '/signup', component: SignupPage },

  {
    path: '/home',
    component: HomePage,
    children: [
      { path: '', component: Success },
      { path: 'login-success', component: Success },

      // 1page ~ 7page 추가
      { path: '0page', component: Page0 },
      { path: '1page', component: Page1 },
      { path: '2page', component: Page2 },
      { path: '3page', component: Page3 },
      { path: '4page', component: Page4 },
      { path: '5page', component: Page5 },
      { path: '6page', component: Page6 },
      { path: '7page', component: Page7 }
    ]
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: Success
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})