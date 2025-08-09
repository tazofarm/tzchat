import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '@/views/LoginPage.vue'
import SignupPage from '@/views/SignupPage.vue'
import HomePage from '@/views/HomePage.vue'
import Success from '@/components/03050_pages/Success.vue'

// 각 페이지 컴포넌트 import
import Page0 from '@/components/03050_pages/0_emergency.vue'
import Page1 from '@/components/03050_pages/1_alluser.vue'
import Page2 from '@/components/03050_pages/2_target.vue'
import Page3 from '@/components/03050_pages/3_list.vue'
import Page4 from '@/components/03050_pages/4_chatroom.vue'
import Page5 from '@/components/03050_pages/5_find.vue'
import Page6 from '@/components/03050_pages/6_profile.vue'
import Page7 from '@/components/03050_pages/7_setting.vue'

// minipage

import PageuserProfile from '@/components/03060_minipage/PageuserProfile.vue'
import ChatRoomPage from '@/components/03060_minipage/ChatRoomPage.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginPage },
  { path: '/signup', component: SignupPage },

  {
    path: '/home',
    component: HomePage,
    meta: { requiresAuth: true }, // 🔐 인증 필요
    children: [
      { path: '', component: Success },
      { path: 'login-success', component: Success },

      // 0page ~ 7page
      { path: '0page', component: Page0 },
      { path: '1page', component: Page1 },
      { path: '2page', component: Page2 },
      { path: '3page', component: Page3 },
      { path: '4page', component: Page4 },
      { path: '5page', component: Page5 },
      { path: '6page', component: Page6 },
      { path: '7page', component: Page7 },

      // minipage
      
      { path: 'user/:id', component: PageuserProfile },
      { path: 'chat/:id', component: ChatRoomPage },
    ]
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: Success
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// ✅ 전역 가드: 로그인 되어 있지 않으면 /login 으로 리디렉션
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (!requiresAuth) {
    return next() // 인증 필요 없는 페이지는 통과
  }

  try {
    const res = await fetch('/api/me', {
      credentials: 'include'
    })
    if (res.ok) {
      const json = await res.json()
      console.log('✅ [라우터 가드] 로그인 상태 확인됨:', json.user.nickname)
      next() // 로그인되어 있으면 통과
    } else {
      console.warn('⛔ [라우터 가드] 로그인 안됨, 로그인 페이지로 이동')
      next('/login')
    }
  } catch (err) {
    console.error('❌ [라우터 가드] 로그인 확인 오류:', err)
    next('/login')
  }
})

export default router
