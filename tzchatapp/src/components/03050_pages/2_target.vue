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
   - 기존 데이터 로직/소켓/정렬 유지
   - 필터 체인을 applyTotalFilterNormal로 교체
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
  // 1) 제외목록 제거
  const afterExclude = filterByExcludeIds(rawList, excludeIds.value)
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
      if (excludeIds.value instanceof Set && excludeIds.value.has(String(u._id))) return

      const idx = users.value.findIndex(x => x._id === u._id)
      if (idx >= 0) {
        users.value[idx] = { ...users.value[idx], ...u }
        scheduleRender()
      } else {
        const afterExclude = filterByExcludeIds([u], excludeIds.value)
        if (!afterExclude.length) return
        const once = applyTotalFilterNormal(afterExclude, me, { log: false })
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
