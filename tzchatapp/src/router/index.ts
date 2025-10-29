// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import api, { getAgreementStatus } from '@/lib/api'

import {
  modalController,
  actionSheetController,
  alertController,
  loadingController,
  popoverController,
  pickerController,
  toastController,
} from '@ionic/vue'


//로그인 전
import LoginPage from '@/views/LoginPage.vue'
import LoginTestPage from '@/views/LoginTestPage.vue'
import LoginMainPage from '@/views/LoginMainPage.vue'
import LoginAutoPage from '@/views/LoginAutoPage.vue'
import SignupPage from '@/views/SignupPage.vue'
import HomePage from '@/views/HomePage.vue'


//삭제예정
import Page0 from '@/components/03050_pages/del/0_emergency.vue'
import Page1 from '@/components/03050_pages/1_alluser.vue'
import Page2 from '@/components/03050_pages/del/2_target.vue'
import Page5 from '@/components/03050_pages/del/5_test.vue'
import Page91 from '@/components/03050_pages/del/9_test1.vue'
import Page92 from '@/components/03050_pages/del/9_test2.vue'
import Page93 from '@/components/03050_pages/del/9_test3.vue'


//Topmenu
import Pagetarget from '@/components/03050_pages/2_target_merge.vue'
import Page3 from '@/components/03050_pages/3_list.vue'
import Page4 from '@/components/03050_pages/4_chatList.vue'
import Page6 from '@/components/03050_pages/6_profile.vue'
import Page7 from '@/components/03050_pages/7_setting.vue'


//list_sub
import Page31 from '@/components/04310_Page3_list/Page_Block.vue'
import Page32 from '@/components/04310_Page3_list/Page_Friend.vue'
import Page33 from '@/components/04310_Page3_list/Page_Receive.vue'
import Page34 from '@/components/04310_Page3_list/Page_Send.vue'


// important_parts
import PageuserProfile from '@/components/02010_minipage/mini_profile/PageuserProfile.vue'
import PagepremiumProfile from '@/components/02010_minipage/mini_profile/PagepremiumProfile.vue'
import ChatRoomPage from '@/components/04410_Page4_chatroom/ChatRoomPage.vue'

// notice
import NoticeEditPage from '@/components/04910_Page9_Admin/detail/NoticeEditPage.vue'

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


// admin
import AdminDashboard from '@/components/04910_Page9_Admin/adminlist/0000_AdminDashboard.vue'
import Admin01 from '@/components/04910_Page9_Admin/adminlist/0001_a.vue'
import Admin02 from '@/components/04910_Page9_Admin/adminlist/0002_a.vue'
import Admin03 from '@/components/04910_Page9_Admin/adminlist/0003_a.vue'
import Admin04 from '@/components/04910_Page9_Admin/adminlist/0004_a.vue'
import Admin05 from '@/components/04910_Page9_Admin/adminlist/0005_a.vue'
import Admin06 from '@/components/04910_Page9_Admin/adminlist/0006_a.vue'
import Admin07 from '@/components/04910_Page9_Admin/adminlist/0007_a.vue'
import Admin08 from '@/components/04910_Page9_Admin/adminlist/0008_a.vue'
import Admin09 from '@/components/04910_Page9_Admin/adminlist/0009_a.vue'
import Admin10 from '@/components/04910_Page9_Admin/adminlist/0010_a.vue'
import Admin11 from '@/components/04910_Page9_Admin/adminlist/0011_a.vue'
import Admin12 from '@/components/04910_Page9_Admin/adminlist/0012_a.vue'
import Admin13 from '@/components/04910_Page9_Admin/adminlist/0013_a.vue'
import Admin14 from '@/components/04910_Page9_Admin/adminlist/0014_a.vue'
import Admin15 from '@/components/04910_Page9_Admin/adminlist/0015_a.vue'
import Admin16 from '@/components/04910_Page9_Admin/adminlist/0016_a.vue'
import Admin17 from '@/components/04910_Page9_Admin/adminlist/0017_a.vue'
import Admin18 from '@/components/04910_Page9_Admin/adminlist/0018_a.vue'
import Admin19 from '@/components/04910_Page9_Admin/adminlist/0019_a.vue'
import Admin20 from '@/components/04910_Page9_Admin/adminlist/0020_a.vue'

// ✅ 동의 전용 페이지
const AgreementPage = () => import('@/legalpage/AgreementPage.vue')


// ✅ 멤버십 구매(남/녀 자동 분기 단일 페이지)
import BuyPage from '@/components/05110_Membership/Buy.vue'
// ✅ 결제 이력 페이지
import HistoryPage from '@/components/05110_Membership/History.vue'

// (문서 목록/단일)
const LegalDocs = () => import('@/legalpage/LegalDocs.vue')
const LegalContainer = () => import('@/legalpage/LegalContainer.vue')

// ✅ 탈퇴신청 전용 페이지
const DeletionPending = () => import('@/views/DeletionPending.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginPage },
  { path: '/signup', component: SignupPage },
  { path: '/loginmain', component: LoginMainPage },
  { path: '/logintester', component: LoginTestPage },
  { path: '/loginauto', component: LoginAutoPage },

  // ✅ 외부 공개 라우트(로그인 불필요)
  { path: '/legal/consent', name: 'AgreementPagePublic', component: AgreementPage },
  { path: '/legals/v2', name: 'LegalDocsV2Public', component: LegalDocs },
  { path: '/legals/v2/:slug', name: 'LegalPageV2Public', component: LegalContainer, props: true },

  // ✅ 탈퇴신청 전용(로그인 필요)
  {
    path: '/account/deletion-pending',
    name: 'AccountDeletionPending',
    component: DeletionPending,
    meta: { requiresAuth: true },
  },

  {
    path: '/home',
    component: HomePage,
    meta: { requiresAuth: true },
    children: [
      { path: '', component: Page6 },

      // ✅ 멤버십 관련 라우트
      { path: 'membership/buy', component: BuyPage, meta: { requiresAuth: true } },
      { path: 'membership/history', component: HistoryPage, meta: { requiresAuth: true } },



      { path: '0page', component: Page0 },
      { path: '1page', component: Page1 },
      { path: '2page', component: Page2 },
      { path: 'targetpage', component: Pagetarget },
      { path: '3page', component: Page3 },

      { path: '4page', component: Page4 },
      { path: '5page', component: Page5 },
      { path: '6page', component: Page6 },
      { path: '7page', component: Page7 },
      { path: '91page', component: Page91 },
      { path: '92page', component: Page92 },
      { path: '93page', component: Page93 },

      { path: '31page', component: Page31 },
      { path: '32page', component: Page32 },
      { path: '33page', component: Page33 },
      { path: '34page', component: Page34 },

      // minipage
      { path: 'user/:id', component: PageuserProfile, props: true },
      { path: 'premuimuser/:id', component: PagepremiumProfile, props: true },
      { path: 'chat/:id', component: ChatRoomPage, props: true },

      // setting
      { path: 'setting/0001', component: setting01 },
      { path: 'setting/0002', component: setting02 },
      { path: 'setting/0002/write', component: NoticeEditPage, meta: { requiresMaster: true } },
      {
        path: 'setting/0002/edit/:id',
        component: NoticeEditPage,
        meta: { requiresMaster: true },
        props: true,
      },

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

      // ✅ 관리자
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


      // ✅ 관리자 약관/정책 관리
      {
        path: 'admin/terms/:slug?',
        name: 'AdminTerms',
        component: () => import('@/legalpage/admin/TermsAdmin.vue'),
        alias: ['/admin/terms/:slug?'],
        meta: { requiresAuth: true, requiresMaster: true },
      },

      // ✅ 내부(로그인 후) 법적 문서 라우트 — 이름을 외부와 분리
      { path: 'legals/v2', name: 'LegalDocsV2Internal', component: LegalDocs },
      { path: 'legals/v2/:slug', name: 'LegalPageV2Internal', component: LegalContainer, props: true },
    ],
  },

  // 404
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: Page6 },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    // (윈도우 스크롤용) 항상 맨 위로
    return { top: 0, left: 0 }
  },
})

function parseMePayload(raw: any) {
  const user =
    raw?.user ??
    raw?.data?.user ??
    (raw && typeof raw === 'object' && ('username' in raw || '_id' in raw) ? raw : null)
  const ok = raw?.ok === true || raw?.success === true || !!user
  return { ok, user }
}

// 약관/동의 화면 화이트리스트
function isLegalRoute(path: string) {
  return (
    path.startsWith('/legal/consent') ||
    path.startsWith('/legals/v2') ||
    path.includes('/home/legals/v2')
  )
}

// ✅ 남아있는 모든 Ionic 오버레이 강제 정리
async function dismissAllOverlays() {
  try {
    for (let i = 0; i < 3; i++) {
      await Promise.allSettled([
        modalController.dismiss(),
        actionSheetController.dismiss(),
        alertController.dismiss(),
        loadingController.dismiss(),
        popoverController.dismiss(),
        pickerController.dismiss(),
        toastController.dismiss(),
      ])
    }
  } catch {
    /* no-op */
  }
}

// --- 추가: 계정 상태 조회 함수
async function fetchAccountStatus(): Promise<'active' | 'pendingDeletion' | 'unknown'> {
  try {
    const res = await api.get('/api/account/status', { withCredentials: true })
    const status = res?.data?.status || res?.data?.data?.status
    return status === 'pendingDeletion' ? 'pendingDeletion' : 'active'
  } catch {
    return 'unknown'
  }
}

router.beforeEach(async (to, _from, next) => {
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  const requiresMaster = to.matched.some((r) => r.meta.requiresMaster)

  // 외부 약관/문서 경로는 로그인 없이 통과
  if (isLegalRoute(to.fullPath) && !requiresAuth && !requiresMaster) {
    return next()
  }

  if (!requiresAuth && !requiresMaster) return next()

  try {
    console.log('🔒 [가드] 보호 라우트 진입: ', to.fullPath)
    const res = await api.get('/api/me', { withCredentials: true })
    const { ok, user: me } = parseMePayload(res?.data)
    if (!ok || !me) {
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }

    // 1) 마스터 권한 확인
    const role = String(me?.role || '').toLowerCase()
    if (requiresMaster && role !== 'master') {
      return next('/home')
    }

    // 2) 계정 상태 확인 (탈퇴신청이면 전용 페이지로)
    const status = await fetchAccountStatus()
    const isOnDeletionPage =
      to.name === 'AccountDeletionPending' || to.path === '/account/deletion-pending'
    if (status === 'pendingDeletion' && !isOnDeletionPage) {
      return next({ name: 'AccountDeletionPending', replace: true })
    }

    // 3) (탈퇴신청이 아닐 때만) 동의 미완료 시, 공개 동의 페이지로 우회
    if (status !== 'pendingDeletion' && !isLegalRoute(to.fullPath)) {
      try {
        const gs = await getAgreementStatus() // { data: { pending: [...] } }
        const pending: any[] = gs?.data?.pending ?? []
        if (Array.isArray(pending) && pending.length > 0) {
          return next({
            name: 'AgreementPagePublic',
            query: { return: to.fullPath },
            replace: true,
          })
        }
      } catch (e) {
        console.error('⚠️ 동의 상태 조회 실패(보수적으로 통과):', e)
      }
    }

    return next()
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 401) {
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }
    return next({ path: '/login', query: { redirect: to.fullPath, e: status || '500' } })
  }
})

router.afterEach(async () => {
  await dismissAllOverlays()

  // ✅ 라우트 전환 후 스크롤 루트들을 확실히 0으로 초기화
  const resetScroll = () => {
    try {
      // 1) Ionic(ion-content) 내부 스크롤
      const contents = document.querySelectorAll('ion-content')
      contents.forEach((el) => {
        // @ts-ignore - web component 메서드
        el?.scrollToTop?.(0)
        // @ts-ignore - 호환 메서드
        el?.scrollToPoint?.(0, 0, 0)
        ;(el as unknown as HTMLElement).scrollTop = 0
      })

      // 2) 커스텀 스크롤 컨테이너(.main-page 등)
      const customRoots = document.querySelectorAll<HTMLElement>(
        '.main-page,[data-scroll-root],[data-scroll-container]'
      )
      customRoots.forEach((el) => {
        el.scrollTop = 0
      })

      // 3) 바깥쪽(문서/윈도우) 스크롤도 함께 초기화
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      window.scrollTo({ top: 0, left: 0 })
    } catch {
      /* no-op */
    }
  }

  // 렌더 완료 이후 한 번 더 보장 (전환 애니메이션/지연 대비)
  requestAnimationFrame(() => {
    resetScroll()
    requestAnimationFrame(resetScroll)
  })
})

export default router
