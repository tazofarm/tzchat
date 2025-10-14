<template>
  <!-- 공통 리스트 컴포넌트 사용 -->
  <UserList
    :users="users"
    :isLoading="isLoading"
    :viewer-level="viewerLevel"
    :is-premium="isPremium"
    emptyText="조건에 맞는 사용자가 없습니다."
    @select="u => goToUserProfile(u._id)"
  />
</template>

<script setup>
/* -----------------------------------------------------------
   Target: 공통 UserList + Normal Total Filter
   - 이미지 URL 절대화/혼합콘텐츠 방지/localhost 치환 추가
   - 필터/정렬/소켓 로직은 기존 유지
   - excludeIds(친구/차단/대기중)는 외부에서 AND 적용
   - ✅ 언마운트 시 socket.disconnect() 금지 → 리스너만 off()
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import { applyTotalFilterNormal } from '@/components/04210_Page2_target/Filter/Total_Filter_normal'
import { connectSocket, getSocket } from '@/lib/socket'

/** 상태 */
const users = ref([])
const nickname = ref('')
const currentUser = ref({})
const isLoading = ref(true)
const excludeIds = ref(new Set())
const socket = ref(null)

/** ✅ Premium 가림 로직용: 뷰어 레벨/프리미엄 여부를 명시 전달 */
const viewerLevel = ref('')  // '일반회원' | '여성회원' | '프리미엄' 등
const isPremium = ref(false) // true면 실제 값 노출, false면 Premium 전용

/** 이 컴포넌트에서 등록한 소켓 핸들러 보관용 */
const sockHandlers = {
  connect: null,
  disconnect: null,
  connect_error: null,
  users_refresh: null,
  users_patch: null,
  users_last_login: null,
}

const LOG = { init: true, socket: true, patch: true, sort: true, filter: true, relation: true }
const router = useRouter()

/* ===================== 혼합콘텐츠/로컬호스트 URL 보정 ===================== */
/** 프론트·백 어디서 오든 안전한 퍼블릭 원점 계산 */
function getApiOrigin () {
  const envBase =
    (import.meta.env.VITE_API_FILE_BASE || import.meta.env.VITE_API_BASE_URL || '').toString().trim()
  const candidate = envBase || (api?.defaults?.baseURL) || window.location.origin
  let u
  try { u = new URL(candidate, window.location.origin) } catch { u = new URL(window.location.origin) }
  // https 페이지에서 http면 우선 https로 승격
  if (window.location.protocol === 'https:' && u.protocol === 'http:') {
    try { u = new URL(`https://${u.host}`) } catch {}
  }
  return u
}
const API_ORIGIN = getApiOrigin()

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])
function isLikelyLocalHost (h) {
  if (!h) return false
  if (LOCAL_HOSTNAMES.has(h)) return true
  if (h.endsWith('.local')) return true
  return false
}

/** 절대/상대/프로토콜상대 URL → 혼합콘텐츠 없는 절대 URL */
function toAbsolute (u) {
  if (!u) return ''
  // 절대/데이터/블롭
  if (/^(https?:|data:|blob:)/i.test(u)) {
    try {
      const p = new URL(u)
      // 로컬/내부 개발 호스트면 API_ORIGIN으로 치환 (경로 유지)
      if (isLikelyLocalHost(p.hostname)) {
        return `${API_ORIGIN.origin}${p.pathname}${p.search}${p.hash}`
      }
      // https 페이지에서 http면 가능한 승격 또는 원점 치환
      if (window.location.protocol === 'https:' && p.protocol === 'http:') {
        if (p.hostname === API_ORIGIN.hostname) {
          p.protocol = 'https:'
          return p.toString()
        }
        return `${API_ORIGIN.origin}${p.pathname}${p.search}${p.hash}`
      }
      return p.toString()
    } catch {
      // 파싱 실패 시 아래 상대경로 처리
    }
  }
  // //host/path
  if (u.startsWith('//')) return `${API_ORIGIN.protocol}${u}`
  // /path
  if (u.startsWith('/')) return `${API_ORIGIN.origin}${u}`
  // path
  return `${API_ORIGIN.origin}/${u}`
}

/** 다양한 백엔드 응답 스키마에서 대표 이미지 1개를 뽑아 displayImage로 세팅 */
function pickDisplayImage (user) {
  // 1) profileImages [{urls:{thumb/medium/full}}]
  const A = user?.profileImages
  if (Array.isArray(A) && A.length) {
    const first = A[0]
    const src = first?.urls?.medium || first?.urls?.full || first?.urls?.thumb || first?.url
    if (src) return toAbsolute(src)
  }
  // 2) images: ['...'] or [{url,thumb,full}]
  const B = user?.images
  if (Array.isArray(B) && B.length) {
    const x = B[0]
    if (typeof x === 'string') return toAbsolute(x)
    if (typeof x === 'object') {
      const src = x.medium || x.full || x.thumb || x.url
      if (src) return toAbsolute(src)
    }
  }
  // 3) profileImage / mainImage / avatar / photo
  const keys = ['profileImage', 'mainImage', 'avatar', 'photo', 'thumb', 'image']
  for (const k of keys) {
    if (user?.[k]) return toAbsolute(user[k])
  }
  // 4) nested: user.profile?.image 등
  const nested = user?.profile?.image || user?.profile?.avatar || user?.profile?.photo
  if (nested) return toAbsolute(nested)
  // 5) 없음
  return ''
}

/** 유저 오브젝트의 이미지 URL들을 절대경로로 보정 + displayImage 생성 */
function normalizeUser (u) {
  const copy = { ...u }

  // 흔한 단일 필드 보정
  if (copy.profileImage) copy.profileImage = toAbsolute(copy.profileImage)
  if (copy.mainImage)    copy.mainImage    = toAbsolute(copy.mainImage)
  if (copy.avatar)       copy.avatar       = toAbsolute(copy.avatar)
  if (copy.photo)        copy.photo        = toAbsolute(copy.photo)
  if (copy.image)        copy.image        = toAbsolute(copy.image)

  // 배열 필드 보정
  if (Array.isArray(copy.images)) {
    copy.images = copy.images.map(x => {
      if (typeof x === 'string') return toAbsolute(x)
      if (x && typeof x === 'object') {
        return {
          ...x,
          url: toAbsolute(x.url),
          thumb: toAbsolute(x.thumb),
          medium: toAbsolute(x.medium),
          full: toAbsolute(x.full),
        }
      }
      return x
    })
  }
  if (Array.isArray(copy.profileImages)) {
    copy.profileImages = copy.profileImages.map(img => ({
      ...img,
      url: toAbsolute(img?.url),
      thumb: toAbsolute(img?.thumb || img?.urls?.thumb),
      medium: toAbsolute(img?.medium || img?.urls?.medium),
      full: toAbsolute(img?.full || img?.urls?.full),
      urls: {
        ...img?.urls,
        thumb: toAbsolute(img?.urls?.thumb),
        medium: toAbsolute(img?.urls?.medium),
        full: toAbsolute(img?.urls?.full),
      }
    }))
  }

  // 대표 이미지 최종 선택
  copy.displayImage = pickDisplayImage(copy)
  return copy
}
/* =================== /혼합콘텐츠/로컬호스트 URL 보정 =================== */

/** 유틸: 시간/정렬 */
function toTS(v) {
  if (!v) return 0
  try { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0 } catch { return 0 }
}
function sortByLastLoginDesc(list) {
  const sorted = [...list].sort((a, b) => {
    const aTS = toTS(a.last_login || a.lastLogin || a.updatedAt || a.createdAt)
    const bTS = toTS(b.last_login || b.lastLogin || b.updatedAt || b.createdAt)
    return bTS - aTS
  })
  if (LOG.sort) console.log('[Users] 정렬 완료, 상위 3:', sorted.slice(0,3).map(u=>u.nickname))
  return sorted
}
function debounce(fn, delay = 120) {
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay) }
}

/** 유틸: 제외 ID Set 생성 (friends/blocks/pendingSent/Recv) */
function toIdList(src) {
  const arr = Array.isArray(src) ? src : []
  return arr
    .map(v => {
      if (!v) return null
      if (typeof v === 'string' || typeof v === 'number') return String(v)
      return String(v._id || v.id || v.userId || v.user_id || '')
    })
    .filter(Boolean)
}
function buildExcludeIdsSet({ friends = [], blocks = [], pendingSent = [], pendingRecv = [] } = {}) {
  const set = new Set()
  for (const id of toIdList(friends)) set.add(id)
  for (const id of toIdList(blocks)) set.add(id)
  for (const id of toIdList(pendingSent)) set.add(id)
  for (const id of toIdList(pendingRecv)) set.add(id)
  return set
}

/** 유틸: 제외목록 필터 (friends/blocks/pendingSent/Recv) */
const filterByExcludeIds = (list, set) =>
  Array.isArray(list) ? list.filter(u => u && u._id && !(set instanceof Set ? set.has(String(u._id)) : false)) : []

/** 라우팅 */
const goToUserProfile = (userId) => {
  if (!userId) return
  if (LOG.init) console.log('➡️ 유저 프로필 이동:', userId)
  router.push(`/home/user/${userId}`)
}

/** 관계 데이터 로딩 */
async function fetchRelations() {
  try {
    console.time('[Users] relations')
    const [friendsRes, blocksRes, sentRes, recvRes] = await Promise.all([
      api.get('/api/friends'),
      api.get('/api/blocks'),
      api.get('/api/friend-requests/sent'),
      api.get('/api/friend-requests/received'),
    ])
    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []
    excludeIds.value  = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv })
    if (LOG.relation) console.log('[Users] excludeIds size:', excludeIds.value.size)
  } catch (e) {
    console.error('❌ 관계 데이터 로딩 실패:', e)
    excludeIds.value = new Set()
  } finally {
    console.timeEnd('[Users] relations')
  }
}

/** 서버 검색 + (제외목록) + Normal 필터 + 정렬 */
const applyFilterAndSort = (rawList, me) => {
  // 0) 이미지 URL 보정 (먼저 수행해야 UserList에서 썸네일이 바로 보임)
  const normalized = Array.isArray(rawList) ? rawList.map(normalizeUser) : []

  // 1) 제외목록 제거
  const afterExclude = filterByExcludeIds(normalized, excludeIds.value)

  // 2) Normal Total Filter 적용 (내 설정/상호조건/프리미엄 노출/신청제한)
  const filtered = applyTotalFilterNormal(afterExclude, me, { log: false })
  if (LOG.filter) console.log(`[Users] 필터 결과: ${filtered.length}/${rawList?.length ?? 0}`)

  // 3) 정렬
  users.value = sortByLastLoginDesc(filtered)
}
const scheduleRender = debounce(() => { users.value = sortByLastLoginDesc(users.value) }, 100)

/** Socket.IO */
function initUsersSocket(me) {
  const s = connectSocket()
  socket.value = s

  sockHandlers.connect = () => {
    if (LOG.socket) console.log('✅ [Socket] connected:', s.id)
    try { s.emit('users:join', { scope: 'list' }) } catch {}
  }
  sockHandlers.disconnect = (reason) => console.warn('⚠️ [Socket] disconnected:', reason)
  sockHandlers.connect_error = (err) => console.error('❌ [Socket] connect_error:', err?.message || err)

  sockHandlers.users_refresh = (payload) => {
    if (LOG.socket) console.log('🟦 [Socket] users:refresh len=', payload?.length)
    try { applyFilterAndSort(payload || [], me) } catch (e) { console.error('❌ refresh 처리 오류:', e) }
  }
  sockHandlers.users_patch = (u) => {
    if (LOG.patch) console.log('🟨 [Socket] users:patch:', u?._id, u?.nickname)
    try {
      if (!u || !u._id) return
      // 🧩 들어오는 patch도 이미지 URL 보정
      const nu = normalizeUser(u)

      if (excludeIds.value instanceof Set && excludeIds.value.has(String(nu._id))) return

      const idx = users.value.findIndex(x => x._id === nu._id)
      if (idx >= 0) {
        users.value[idx] = { ...users.value[idx], ...nu }
        scheduleRender()
      } else {
        // filter 체인 통과 확인
        const once = applyTotalFilterNormal([nu], me, { log: false })
        if (once.length) {
          users.value.push(once[0])
          scheduleRender()
        }
      }
    } catch (e) { console.error('❌ patch 처리 오류:', e) }
  }
  sockHandlers.users_last_login = ({ userId, last_login }) => {
    const idx = users.value.findIndex(x => x._id === userId)
    if (idx >= 0) { users.value[idx] = { ...users.value[idx], last_login }; scheduleRender() }
  }

  s.on('connect', sockHandlers.connect)
  s.on('disconnect', sockHandlers.disconnect)
  s.on('connect_error', sockHandlers.connect_error)
  s.on('users:refresh', sockHandlers.users_refresh)
  s.on('users:patch', sockHandlers.users_patch)
  s.on('users:last_login', sockHandlers.users_last_login)
}

/** 라이프사이클 */
onMounted(async () => {
  try {
    console.time('[Users] init')
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    nickname.value = me?.nickname || ''
    if (LOG.init) console.log('✅ me:', me)

    // ✅ 등급/프리미엄 여부 설정 (여러 백엔드 필드명 대응)
    const levelFromApi =
      me?.level ||
      me?.user_level ||
      me?.membership ||
      ''

    viewerLevel.value = String(levelFromApi || '').trim()

    const premiumBool =
      me?.isPremium ??
      me?.premium ??
      (String(levelFromApi || '').trim() === '프리미엄')

    isPremium.value = Boolean(premiumBool)

    await fetchRelations()

    // 초기 검색 (예: 지역 기반)
    const regionFilter = me.search_regions || []
    const res = await api.post('/api/search/users', { regions: regionFilter })
    applyFilterAndSort(res.data || [], me)

    initUsersSocket(me)
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', e)
  } finally {
    isLoading.value = false
    console.timeEnd('[Users] init')
  }
})

onBeforeUnmount(() => {
  try {
    const s = getSocket()
    if (s) {
      if (typeof s.emit === 'function') {
        try { s.emit('users:leave', { scope: 'list' }) } catch {}
      }
      if (sockHandlers.connect)          s.off('connect', sockHandlers.connect)
      if (sockHandlers.disconnect)       s.off('disconnect', sockHandlers.disconnect)
      if (sockHandlers.connect_error)    s.off('connect_error', sockHandlers.connect_error)
      if (sockHandlers.users_refresh)    s.off('users:refresh', sockHandlers.users_refresh)
      if (sockHandlers.users_patch)      s.off('users:patch', sockHandlers.users_patch)
      if (sockHandlers.users_last_login) s.off('users:last_login', sockHandlers.users_last_login)
    }
    socket.value = null
  } catch (e) {
    console.error('❌ 소켓 정리 실패:', e)
  }
})

/** (옵션) 로그아웃 예시 */
const logout = async () => {
  try { await api.post('/api/logout'); router.push('/login') }
  catch (e) { console.error('❌ 로그아웃 실패:', e) }
}
</script>

<style scoped>
/* 페이지 배경만 유지(리스트 스타일은 UserList.vue에 있음) */
:root,
:host {
  --bg: #0b0b0d;
  --text: #d7d7d9;
}
ion-content {
  --background: var(--bg);
  color: var(--text);
}
</style>
