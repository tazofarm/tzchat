// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import api, { getAgreementStatus, setAuthToken } from '@/lib/api'

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
import HomePage from '@/views/HomePage.vue'

import PassManual from '@/views/pass/PassManual.vue'
import PassPortal from '@/views/pass/PassPortal.vue'
import SignupPage from '@/views/pass/SignupPage.vue'
import TempLogin from '@/views/pass/TempLogin.vue'
import PhoneUpdate from '@/views/pass/Phoneupdated.vue'

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

//purchase
import purchaseMain from '@/components/05110_Membership/Page/membershipMain.vue'

// setting
import setting01 from '@/components/04710_Page7_setting/setlist/0001_s_notice.vue'
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
import setting19 from '@/components/04710_Page7_setting/setlist/0019_s_pwchange.vue'
import setting20 from '@/components/04710_Page7_setting/setlist/0020_s_delete.vue'

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
import HistoryPage from '@/components/05110_Membership/History.vue'

// (문서 목록/단일)
const LegalDocs = () => import('@/legalpage/LegalDocs.vue')
const LegalContainer = () => import('@/legalpage/LegalContainer.vue')
const TermsAdmin = () => import('@/legalpage/admin/TermsAdmin.vue')

// ✅ 탈퇴신청 전용 페이지
const DeletionPending = () => import('@/views/DeletionPending.vue')

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: LoginPage },

  { path: '/pass', name: 'PassPortal', component: PassPortal, meta: { public: true } },
  { path: '/app/pass-result', name: 'PassResult', component: PassPortal, meta: { public: true } },
  { path: '/pass/manual', name: 'PassManual', component: PassManual, meta: { public: true, layout: 'blank' } },

  { path: '/signup', name: 'Signup', component: SignupPage, meta: { public: true } },
  { path: '/templogin', name: 'TempLogin', component: TempLogin, meta: { public: true } },

  { path: '/legal/consent', name: 'AgreementPagePublic', component: AgreementPage, meta: { public: true } },
  { path: '/legals/v2', name: 'LegalDocsV2Public', component: LegalDocs, meta: { public: true } },
  { path: '/legals/v2/:slug', name: 'LegalPageV2Public', component: LegalContainer, props: true, meta: { public: true } },

  {
    path: '/account/deletion-pending',
    name: 'AccountDeletionPending',
    component: DeletionPending,
    meta: { requiresAuth: true },
  },

  {
    path: '/admin/terms/:slug',
    name: 'AdminTermsEdit',
    component: TermsAdmin,
    props: true,
    meta: { requiresAuth: true, requiresMaster: true },
  },

  {
    path: '/home',
    component: HomePage,
    meta: { requiresAuth: true },
    children: [
      { path: '', component: Page6 },

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
      { path: 'phoneupdate', component: PhoneUpdate },

      { path: 'user/:id', component: PageuserProfile, props: true },

      {
        path: 'premiumuser/:id',
        component: PagepremiumProfile,
        props: true,
        alias: ['/home/premuimuser/:id'],
      },

      { path: 'chat/:id', component: ChatRoomPage, props: true },

      { path: 'purchase/main', component: purchaseMain },

      { path: 'setting/0001', component: setting01 },
      { path: 'setting/0002', component: setting02 },
      { path: 'setting/0002/write', component: NoticeEditPage, meta: { requiresMaster: true } },
      { path: 'setting/0002/edit/:id', component: NoticeEditPage, meta: { requiresMaster: true }, props: true },

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

      { path: 'legals/v2', name: 'LegalDocsV2Internal', component: LegalDocs },
      { path: 'legals/v2/:slug', name: 'LegalPageV2Internal', component: LegalContainer, props: true },
    ],
  },

  { path: '/:pathMatch(.*)*', name: 'NotFound', component: Page6 },
]

// ===== helpers =====
function parseMePayload(raw: any) {
  const user =
    raw?.user ??
    raw?.data?.user ??
    (raw && typeof raw === 'object' && ('username' in raw || '_id' in raw) ? raw : null)
  const ok = raw?.ok === true || raw?.success === true || !!user
  return { ok, user }
}

function isLegalRoute(path: string) {
  return path.startsWith('/legal/consent') || path.startsWith('/legals/v2') || path.includes('/home/legals/v2')
}

// ✅ “채팅 라우트” 판별 (router 쪽에서도 동일 기준)
function isChatRoutePath(path: string) {
  const p = String(path || '').toLowerCase()
  return p.startsWith('/home/chat/') || p.startsWith('/home/chat') // /home/chat/:id 포함
}

async function dismissAllOverlaysOnce() {
  try {
    await Promise.allSettled([
      modalController.dismiss(),
      actionSheetController.dismiss(),
      alertController.dismiss(),
      loadingController.dismiss(),
      popoverController.dismiss(),
      pickerController.dismiss(),
      toastController.dismiss(),
    ])
  } catch {}
}

async function fetchAccountStatus(): Promise<'active' | 'pendingDeletion' | 'unknown'> {
  try {
    const res = await api.get('/api/account/status', { withCredentials: true })
    const status = res?.data?.status || res?.data?.data?.status
    return status === 'pendingDeletion' ? 'pendingDeletion' : 'active'
  } catch {
    return 'unknown'
  }
}

function getStoredToken(): string | null {
  try {
    const t = localStorage.getItem('TZCHAT_AUTH_TOKEN')
    return t && t.trim() ? t.trim() : null
  } catch {
    return null
  }
}

const authCache = {
  checkedAt: 0,
  ok: false,
  me: null as any,
  checking: null as Promise<any> | null,
}
const AUTH_CACHE_TTL_MS = 30_000

function getFreshCachedMe(): any | null {
  const now = Date.now()
  if (authCache.checkedAt && now - authCache.checkedAt < AUTH_CACHE_TTL_MS && authCache.ok && authCache.me) {
    return authCache.me
  }
  return null
}

async function validateMeCached(force = false): Promise<{ ok: boolean; me: any | null }> {
  const now = Date.now()
  if (!force && authCache.checkedAt && now - authCache.checkedAt < AUTH_CACHE_TTL_MS) {
    return { ok: authCache.ok, me: authCache.me }
  }

  if (authCache.checking) {
    try {
      const me = await authCache.checking
      return { ok: !!me, me }
    } catch {
      return { ok: false, me: null }
    }
  }

  authCache.checking = (async () => {
    const res = await api.get('/api/me', { withCredentials: true })
    const { ok, user: me } = parseMePayload(res?.data)
    authCache.checkedAt = Date.now()
    authCache.ok = !!ok && !!me
    authCache.me = authCache.ok ? me : null
    return authCache.me
  })()

  try {
    const me = await authCache.checking
    return { ok: !!me, me }
  } catch {
    authCache.checkedAt = Date.now()
    authCache.ok = false
    authCache.me = null
    return { ok: false, me: null }
  } finally {
    authCache.checking = null
  }
}

function clearAuthLocal() {
  try {
    localStorage.removeItem('TZCHAT_AUTH_TOKEN')
  } catch {}
  try {
    setAuthToken('')
  } catch {}
  authCache.checkedAt = 0
  authCache.ok = false
  authCache.me = null
  authCache.checking = null
}

// ✅ 백그라운드 실행 (첫 페인트/전환 방해 금지)
function runInBackground(fn: () => void, delayMs = 0) {
  // @ts-ignore
  const ric = (window as any).requestIdleCallback as undefined | ((cb: Function, opts?: any) => any)
  if (ric) {
    ric(() => fn(), { timeout: 1200 })
    return
  }
  setTimeout(fn, delayMs)
}

// ✅ “전환이 안정화된 후” 네비게이션 실행
function safeReplace(to: any) {
  // 2프레임 뒤에 실행: 전환/레이아웃 먼저 안정화
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      router.replace(to).catch(() => {})
    })
  })
}

async function backgroundPostChecks(toFullPath: string, requiresMaster: boolean) {
  try {
    const { ok, me } = await validateMeCached(true)
    if (!ok || !me) {
      clearAuthLocal()
      safeReplace({ path: '/login', query: { redirect: toFullPath } })
      return
    }

    const role = String(me?.role || '').toLowerCase()
    if (requiresMaster && role !== 'master') {
      safeReplace('/home')
      return
    }

    const status = await fetchAccountStatus()
    const isOnDeletionPage =
      toFullPath === '/account/deletion-pending' || toFullPath.startsWith('/account/deletion-pending?')
    if (status === 'pendingDeletion' && !isOnDeletionPage) {
      safeReplace({ name: 'AccountDeletionPending' })
      return
    }

    if (status !== 'pendingDeletion' && !isLegalRoute(toFullPath)) {
      try {
        const gs = await getAgreementStatus()
        const pending: any[] = gs?.data?.pending ?? []
        if (Array.isArray(pending) && pending.length > 0) {
          safeReplace({
            name: 'AgreementPagePublic',
            query: { return: toFullPath },
          })
          return
        }
      } catch (e) {
        console.error('⚠️ 동의 상태 조회 실패(보수적으로 유지):', e)
      }
    }
  } catch (e) {
    console.log('⚠️ backgroundPostChecks err', e)
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,

  // ✅ 채팅에서는 Router의 스크롤 개입을 끊어서 튕김/멈칫 방지
  scrollBehavior(to) {
    if (isChatRoutePath(to.fullPath)) return false as any
    return { top: 0, left: 0 }
  },
})

router.beforeEach(async (to, _from, next) => {
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  const requiresMaster = to.matched.some((r) => r.meta.requiresMaster)

  if (to.matched.some((r) => r.meta?.public)) return next()
  if (isLegalRoute(to.fullPath) && !requiresAuth && !requiresMaster) return next()

  if (to.path === '/login') {
    const token = getStoredToken()
    if (token) {
      try {
        setAuthToken(token)
      } catch {}
      const redirect = typeof to.query.redirect === 'string' ? String(to.query.redirect) : '/home/6page'
      const target = redirect.startsWith('/home') ? redirect : '/home/6page'
      next({ path: target, replace: true })
      runInBackground(() => {
        backgroundPostChecks(target, false).catch(() => {})
      }, 0)
      return
    }
    return next()
  }

  if (!requiresAuth && !requiresMaster) return next()

  const token = getStoredToken()
  if (token) {
    try {
      setAuthToken(token)
    } catch {}

    const freshMe = getFreshCachedMe()
    if (requiresMaster && freshMe) {
      const role = String(freshMe?.role || '').toLowerCase()
      if (role !== 'master') return next('/home')
    }

    next()

    runInBackground(() => {
      backgroundPostChecks(to.fullPath, requiresMaster).catch(() => {})
    }, 0)
    return
  }

  // 토큰 없으면 엄격 검사
  try {
    const res = await api.get('/api/me', { withCredentials: true })
    const { ok, user: me } = parseMePayload(res?.data)
    if (!ok || !me) return next({ path: '/login', query: { redirect: to.fullPath } })

    const role = String(me?.role || '').toLowerCase()
    if (requiresMaster && role !== 'master') return next('/home')

    const status = await fetchAccountStatus()
    const isOnDeletionPage = to.name === 'AccountDeletionPending' || to.path === '/account/deletion-pending'
    if (status === 'pendingDeletion' && !isOnDeletionPage) {
      return next({ name: 'AccountDeletionPending', replace: true })
    }

    if (status !== 'pendingDeletion' && !isLegalRoute(to.fullPath)) {
      try {
        const gs = await getAgreementStatus()
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
    if (status === 401) return next({ path: '/login', query: { redirect: to.fullPath } })
    return next({ path: '/login', query: { redirect: to.fullPath, e: status || '500' } })
  }
})

/**
 * ✅ afterEach:
 * - 채팅에서는 오버레이 정리도 스킵(최소 부하)
 * - await로 전환 막지 않음
 */
router.afterEach((to) => {
  if (isChatRoutePath(to.fullPath)) return
  runInBackground(() => {
    dismissAllOverlaysOnce().catch(() => {})
  }, 0)
})

export default router
