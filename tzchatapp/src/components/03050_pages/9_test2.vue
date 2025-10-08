<template>
  <ion-page>
    <ion-content>
      <!-- 스와이프 리스트 (공유 컴포넌트) -->
      <SwapeList
        :users="users"
        :is-loading="isLoading"
        @userClick="goToUserProfile"
      />
    </ion-content>
  </ion-page>
</template>

<script setup>
/* -----------------------------------------------------------
   Users List 페이지 (swapeList 컴포넌트 사용)
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { IonPage, IonContent } from '@ionic/vue'

import SwapeList from '@/components/02010_minipage/mini_list/swapeList.vue'

import { applyTotalFilter } from '@/components/04210_Page2_target/total/Filter_total'
import { buildExcludeIdsSet } from '@/components/04210_Page2_target/Filter_List'
import { connectSocket, getSocket } from '@/lib/socket'

/** =========================================================
 *  상태
 * ======================================================= */
const users = ref([])
const nickname = ref('')
const currentUser = ref({})
const isLoading = ref(true)
const excludeIds = ref(new Set())
const socket = ref(null)

const LOG = { init: true, socket: true, patch: true, sort: true, filter: true, relation: true }

const router = useRouter()

/** =========================================================
 *  유틸: 시간/정렬
 * ======================================================= */
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

/** =========================================================
 *  라우팅
 * ======================================================= */
const goToUserProfile = (userId) => {
  if (!userId) return
  if (LOG.init) console.log('➡️ 유저 프로필 이동:', userId)
  router.push(`/home/user/${userId}`)
}

/** =========================================================
 *  관계 데이터 로딩
 * ======================================================= */
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

/** =========================================================
 *  서버 검색 + 필터 + 정렬
 * ======================================================= */
const applyFilterAndSort = (rawList, me) => {
  const filtered = applyTotalFilter(rawList, me, { excludeIds: excludeIds.value })
  if (LOG.filter) console.log(`[Users] 필터 결과: ${filtered.length}/${rawList?.length ?? 0}`)
  users.value = sortByLastLoginDesc(filtered)
}
const scheduleRender = debounce(() => { users.value = sortByLastLoginDesc(users.value) }, 100)

/** =========================================================
 *  Socket.IO
 * ======================================================= */
function initUsersSocket(me) {
  if (socket.value && socket.value.connected) return
  const s = connectSocket()
  socket.value = s
  s.on('connect', () => { if (LOG.socket) console.log('✅ [Socket] connected:', s.id); try { s.emit('users:join', { scope: 'list' }) } catch {} })
  s.on('disconnect', (reason) => console.warn('⚠️ [Socket] disconnected:', reason))
  s.on('connect_error', (err) => console.error('❌ [Socket] connect_error:', err?.message || err))

  s.on('users:refresh', (payload) => {
    if (LOG.socket) console.log('🟦 [Socket] users:refresh len=', payload?.length)
    try { applyFilterAndSort(payload || [], me) } catch (e) { console.error('❌ refresh 처리 오류:', e) }
  })

  s.on('users:patch', (u) => {
    if (LOG.patch) console.log('🟨 [Socket] users:patch:', u?._id, u?.nickname)
    try {
      if (!u || !u._id) return
      if (excludeIds.value instanceof Set && excludeIds.value.has(String(u._id))) return
      const idx = users.value.findIndex(x => x._id === u._id)
      if (idx >= 0) users.value[idx] = { ...users.value[idx], ...u }
      else {
        const once = applyTotalFilter([u], me, { excludeIds: excludeIds.value })
        if (once.length) users.value.push(once[0])
      }
      scheduleRender()
    } catch (e) { console.error('❌ patch 처리 오류:', e) }
  })

  s.on('users:last_login', ({ userId, last_login }) => {
    const idx = users.value.findIndex(x => x._id === userId)
    if (idx >= 0) { users.value[idx] = { ...users.value[idx], last_login }; scheduleRender() }
  })
}

/** =========================================================
 *  라이프사이클
 * ======================================================= */
onMounted(async () => {
  try {
    console.time('[Users] init')
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    nickname.value = me?.nickname || ''
    if (LOG.init) console.log('✅ me:', me)

    await fetchRelations()

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
    if (s) { if (LOG.socket) console.log('🔌 [Socket] disconnect()'); s.disconnect() }
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
/* 페이지 고유 스타일이 필요하면 여기에 추가하세요.
   스와이프 UI 관련 스타일은 swapeList.vue 내부로 이동했습니다. */
</style>
