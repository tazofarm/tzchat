// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

// 기본 페이지
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
import ChatRoomPage from '@/components/04410_Page4_chatroom/ChatRoomPage.vue'

// ✅ 관리자 대시보드(홈 아래 child 라우트로 표시)
import AdminDashboard from '@/components/01050_admin/AdminDashboard.vue'

// ----------------------------------------------------------
// 라우트 정의
// - /home 은 인증 필요(meta.requiresAuth: true)
// - /home/admin 은 인증 + 마스터 권한 필요(meta.requiresMaster: true)
//   -> 버튼은 프론트에서 숨기지만, 최종 차단은 라우터 가드에서 수행
// ----------------------------------------------------------
const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginPage },
  { path: '/signup', component: SignupPage },

  {
    path: '/home',
    component: HomePage,
    meta: { requiresAuth: true }, // 🔐 인증 필요 (자식에게도 적용)
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

      // ------------------------------------------------------
      // admin page (Home 아래에 표시)
      // - /home/admin 으로 접근
      // - 마스터만 진입 가능 (meta.requiresMaster: true)
      // ------------------------------------------------------
      { path: 'admin', component: AdminDashboard, meta: { requiresMaster: true } },
    ],
  },

  // 404
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: Success },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ----------------------------------------------------------
// 전역 네비게이션 가드
// - meta.requiresAuth: 인증 필요
// - meta.requiresMaster: 마스터 권한 필요
//   ※ matched.some(...)으로 meta를 검사하는 것은 공식 패턴입니다.
// ----------------------------------------------------------
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const requiresMaster = to.matched.some((record) => record.meta.requiresMaster)

  // 인증이 필요 없는 라우트는 통과
  if (!requiresAuth && !requiresMaster) {
    return next()
  }

  try {
    // 세션 기반 로그인 확인 (+ role 확인을 위해 /api/me 호출)
    const res = await fetch('/api/me', { credentials: 'include' })

    if (!res.ok) {
      console.warn('⛔ [가드] 로그인 안됨 → /login 리디렉션', { to: to.fullPath, status: res.status })
      return next('/login')
    }

    const json = await res.json()
    const me = json?.user
    console.log('✅ [가드] 로그인 확인:', { nickname: me?.nickname, role: me?.role })

    // 마스터 요구 라우트인지 검사
    if (requiresMaster) {
      if (me?.role === 'master') {
        console.log('✅ [가드] 마스터 권한 확인됨 → 통과')
        return next()
      } else {
        console.warn('⛔ [가드] 마스터 권한 아님 → /home 리디렉션', { role: me?.role })
        return next('/home')
      }
    }

    // 일반 인증만 필요한 경우 통과
    return next()
  } catch (err) {
    console.error('❌ [가드] /api/me 확인 오류 → /login 리디렉션', err)
    return next('/login')
  }
})

export default router
