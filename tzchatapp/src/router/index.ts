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
import Page5 from '@/components/03050_pages/0_test.vue'
import Page6 from '@/components/03050_pages/6_profile.vue'
import Page7 from '@/components/03050_pages/7_setting.vue'

// minipage
import PageuserProfile from '@/components/03060_minipage/PageuserProfile.vue'
import ChatRoomPage from '@/components/04410_Page4_chatroom/ChatRoomPage.vue'


// setting

import setting01 from '@/components/04710_Page7_setting/setlist/0001_s.vue'
import setting02 from '@/components/04710_Page7_setting/setlist/0002_s.vue'
import setting03 from '@/components/04710_Page7_setting/setlist/0003_s.vue'
import setting04 from '@/components/04710_Page7_setting/setlist/0004_s.vue'
import setting05 from '@/components/04710_Page7_setting/setlist/0005_s.vue'
import setting06 from '@/components/04710_Page7_setting/setlist/0006_s.vue'
import setting07 from '@/components/04710_Page7_setting/setlist/0007_s.vue'
import setting08 from '@/components/04710_Page7_setting/setlist/0008_s.vue'
import setting09 from '@/components/04710_Page7_setting/setlist/0009_s.vue'
import setting10 from '@/components/04710_Page7_setting/setlist/0010_s.vue'
import setting11 from '@/components/04710_Page7_setting/setlist/0011_s.vue'
import setting12 from '@/components/04710_Page7_setting/setlist/0012_s.vue'
import setting13 from '@/components/04710_Page7_setting/setlist/0013_s.vue'
import setting14 from '@/components/04710_Page7_setting/setlist/0014_s.vue'
import setting15 from '@/components/04710_Page7_setting/setlist/0015_s.vue'
import setting16 from '@/components/04710_Page7_setting/setlist/0016_s.vue'
import setting17 from '@/components/04710_Page7_setting/setlist/0017_s.vue'
import setting18 from '@/components/04710_Page7_setting/setlist/0018_s.vue'
import setting19 from '@/components/04710_Page7_setting/setlist/0019_s.vue'
import setting20 from '@/components/04710_Page7_setting/setlist/0020_s.vue'




// ✅ 관리자 대시보드(홈 아래 child 라우트로 표시)
import AdminDashboard from '@/components/01050_admin/AdminDashboard.vue'

import Admin01 from '@/components/01050_admin/adminlist/0001_a.vue'
import Admin02 from '@/components/01050_admin/adminlist/0002_a.vue'
import Admin03 from '@/components/01050_admin/adminlist/0003_a.vue'
import Admin04 from '@/components/01050_admin/adminlist/0004_a.vue'
import Admin05 from '@/components/01050_admin/adminlist/0005_a.vue'
import Admin06 from '@/components/01050_admin/adminlist/0006_a.vue'
import Admin07 from '@/components/01050_admin/adminlist/0007_a.vue'
import Admin08 from '@/components/01050_admin/adminlist/0008_a.vue'
import Admin09 from '@/components/01050_admin/adminlist/0009_a.vue'
import Admin10 from '@/components/01050_admin/adminlist/0010_a.vue'
import Admin11 from '@/components/01050_admin/adminlist/0011_a.vue'
import Admin12 from '@/components/01050_admin/adminlist/0012_a.vue'
import Admin13 from '@/components/01050_admin/adminlist/0013_a.vue'
import Admin14 from '@/components/01050_admin/adminlist/0014_a.vue'
import Admin15 from '@/components/01050_admin/adminlist/0015_a.vue'
import Admin16 from '@/components/01050_admin/adminlist/0016_a.vue'
import Admin17 from '@/components/01050_admin/adminlist/0017_a.vue'
import Admin18 from '@/components/01050_admin/adminlist/0018_a.vue'
import Admin19 from '@/components/01050_admin/adminlist/0019_a.vue'
import Admin20 from '@/components/01050_admin/adminlist/0020_a.vue'














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


      //setting
      { path: 'setting/0001', component: setting01 },
      { path: 'setting/0002', component: setting02 },
      { path: 'setting/0003', component: setting03 },
      { path: 'setting/0004', component: setting04 },
      { path: 'setting/0005', component: setting05 },
      { path: 'setting/0006', component: setting06 },
      { path: 'setting/0007', component: setting07 },
      { path: 'setting/0008', component: setting08 },
      { path: 'setting/0009', component: setting09 },
      { path: 'setting/0010', component: setting10 },
      { path: 'setting/0011', component: setting11 },
      { path: 'setting/0012', component: setting12 },
      { path: 'setting/0013', component: setting13 },
      { path: 'setting/0014', component: setting14 },
      { path: 'setting/0015', component: setting15 },
      { path: 'setting/0016', component: setting16 },
      { path: 'setting/0017', component: setting17 },
      { path: 'setting/0018', component: setting18 },
      { path: 'setting/0019', component: setting19 },
      { path: 'setting/0020', component: setting20 },



      // ------------------------------------------------------
      // admin page (Home 아래에 표시)
      // - /home/admin 으로 접근
      // - 마스터만 진입 가능 (meta.requiresMaster: true)
      // ------------------------------------------------------
      { path: 'admin', component: AdminDashboard, meta: { requiresMaster: true } },

      { path: 'admin/0001', component: Admin01, meta: { requiresMaster: true } },
      { path: 'admin/0002', component: Admin02, meta: { requiresMaster: true } },
      { path: 'admin/0003', component: Admin03, meta: { requiresMaster: true } },
      { path: 'admin/0004', component: Admin04, meta: { requiresMaster: true } },
      { path: 'admin/0005', component: Admin05, meta: { requiresMaster: true } },
      { path: 'admin/0006', component: Admin06, meta: { requiresMaster: true } },
      { path: 'admin/0007', component: Admin07, meta: { requiresMaster: true } },
      { path: 'admin/0008', component: Admin08, meta: { requiresMaster: true } },
      { path: 'admin/0009', component: Admin09, meta: { requiresMaster: true } },
      { path: 'admin/0010', component: Admin10, meta: { requiresMaster: true } },
      { path: 'admin/0011', component: Admin11, meta: { requiresMaster: true } },
      { path: 'admin/0012', component: Admin12, meta: { requiresMaster: true } },
      { path: 'admin/0013', component: Admin13, meta: { requiresMaster: true } },
      { path: 'admin/0014', component: Admin14, meta: { requiresMaster: true } },
      { path: 'admin/0015', component: Admin15, meta: { requiresMaster: true } },
      { path: 'admin/0016', component: Admin16, meta: { requiresMaster: true } },
      { path: 'admin/0017', component: Admin17, meta: { requiresMaster: true } },
      { path: 'admin/0018', component: Admin18, meta: { requiresMaster: true } },
      { path: 'admin/0019', component: Admin19, meta: { requiresMaster: true } },
      { path: 'admin/0020', component: Admin20, meta: { requiresMaster: true } },






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
