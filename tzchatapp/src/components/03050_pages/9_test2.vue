<!-- src/components/03050_pages/2_target.vue -->
<template>
  <ion-page>
    <ion-content fullscreen class="no-gutter">
      <!-- 에러 -->
      <ion-text v-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- ✅ SwapeList로 변경 -->
      <SwapeList
        v-else
        :users="users"
        :is-loading="loading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        @userClick="onCardTapById"
      />
    </ion-content>
  </ion-page>
</template>

<script setup>
/* -----------------------------------------------------------
   Target (Emergency 없는 스와이프형)
   - UserList → SwapeList 교체
   - Normal Total Filter 사용 (Filter_self + Filter_listchat 반영)
   - 관계/차단/대기 + 채팅상대(신규 포함) 프리체크 제외
   - 소켓 수신 시 목록 재적용 (disconnect 금지, 리스너만 off)
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { IonPage, IonContent, IonText } from '@ionic/vue'
import SwapeList from '@/components/02010_minipage/mini_list/swapeList.vue'
import { applyTotalFilterNormal } from '@/components/04210_Page2_target/Filter/Total_Filter_normal'
import { connectSocket, getSocket } from '@/lib/socket'

/* -----------------------------------------------------------
   상태 정의
----------------------------------------------------------- */
const users = ref([])
const nickname = ref('')
const currentUser = ref({})
const loading = ref(true)
const errorMessage = ref('')
const excludeIds = ref(new Set())  // 친구/차단/대기/채팅상대 프리체크 제외
const socket = ref(null)
const viewerLevel = ref('')
const isPremium = ref(false)

/* -----------------------------------------------------------
   유틸 / 라우터
----------------------------------------------------------- */
const router = useRouter()
const goToUserProfile = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}
const onCardTapById = (userId) => goToUserProfile(userId)

const toIdList = (src) =>
  (Array.isArray(src) ? src : [])
    .map(v => {
      if (!v) return null
      if (typeof v === 'string' || typeof v === 'number') return String(v)
      return String(v._id || v.id || v.userId || v.user_id || '')
    })
    .filter(Boolean)

const buildExcludeIdsSet = ({ friends = [], blocks = [], pendingSent = [], pendingRecv = [], chats = [] } = {}) => {
  const set = new Set()
  for (const id of toIdList(friends)) set.add(id)
  for (const id of toIdList(blocks)) set.add(id)
  for (const id of toIdList(pendingSent)) set.add(id)
  for (const id of toIdList(pendingRecv)) set.add(id)
  for (const id of toIdList(chats)) set.add(id) // ✅ 채팅상대(신규 포함)
  return set
}

const filterByExcludeIds = (list, set) =>
  Array.isArray(list)
    ? list.filter(u => u && u._id && !(set instanceof Set ? set.has(String(u._id)) : false))
    : []

const toTS = (v) => (v ? (new Date(v).getTime() || 0) : 0)
const sortByLastLoginDesc = (list) =>
  [...list].sort((a, b) =>
    Math.max(toTS(b.last_login), toTS(b.updatedAt), toTS(b.createdAt)) -
    Math.max(toTS(a.last_login), toTS(a.updatedAt), toTS(a.createdAt))
  )

/* -----------------------------------------------------------
   관계/데이터 로딩
----------------------------------------------------------- */
async function fetchRelations() {
  try {
    const [friendsRes, blocksRes, sentRes, recvRes, chatsRes] = await Promise.all([
      api.get('/api/friends'),
      api.get('/api/blocks'),
      api.get('/api/friend-requests/sent'),
      api.get('/api/friend-requests/received'),
      api.get('/api/chatrooms/partners'), // ✅ 내가 대화한 상대 (신규 포함)
    ])
    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? sentRes?.data ?? []
    const chatUserIds = chatsRes?.data?.ids ?? []

    excludeIds.value = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv, chats: chatUserIds })

    // 내부 Total 필터(Filter_listchat)가 참고할 수 있도록 me에 주입
    currentUser.value = {
      ...currentUser.value,
      chatUserIds,
    }
  } catch (e) {
    console.error('❌ 관계 데이터 로딩 실패:', e)
    excludeIds.value = new Set()
  }
}

const applyFilterAndSort = (rawList, me) => {
  // 프리체크 제외 (친구/차단/대기/채팅상대)
  const afterExclude = filterByExcludeIds(rawList, excludeIds.value)
  // Total Filter (자기자신 제외 + 리스트/채팅상대 제외 + 일반 조건들)
  const filtered = applyTotalFilterNormal(afterExclude, me, { log: false })
  // 최근성 기준 정렬 (스와이프 초반 카드 품질 개선)
  users.value = sortByLastLoginDesc(filtered)
}

/* -----------------------------------------------------------
   Socket.IO
----------------------------------------------------------- */
const sockHandlers = {
  connect: null,
  disconnect: null,
  connect_error: null,
  users_refresh: null,
  users_patch: null,
  users_last_login: null,
}

function initUsersSocket(me) {
  const s = connectSocket()
  socket.value = s

  sockHandlers.connect = () => {
    try { s.emit('users:join', { scope: 'swipe' }) } catch {}
  }
  sockHandlers.disconnect = (reason) => console.warn('[swipe][socket] disconnected:', reason)
  sockHandlers.connect_error = (err) => console.error('[swipe][socket] connect_error:', err?.message || err)

  sockHandlers.users_refresh = (payload) => {
    try { applyFilterAndSort(payload || [], me) } catch (e) { console.error('❌ refresh 처리 오류:', e) }
  }
  sockHandlers.users_patch = (u) => {
    try {
      if (!u || !u._id) return
      // 간단히: patch가 오면 서버에 재요청 없이 현재 리스트 갱신 재계산
      // (필요 시 raw 캐시를 유지하고 패치 병합하는 방식으로 확장 가능)
      // 여기서는 새로고침 트리거만
      api.post('/api/search/users', { regions: me.search_regions || [] })
        .then(res => applyFilterAndSort(res.data || [], me))
        .catch(() => {})
    } catch (e) { console.error('❌ patch 처리 오류:', e) }
  }
  sockHandlers.users_last_login = ({ userId, last_login }) => {
    users.value = users.value.map(u => (u._id === userId ? { ...u, last_login } : u))
    users.value = sortByLastLoginDesc(users.value)
  }

  s.on('connect', sockHandlers.connect)
  s.on('disconnect', sockHandlers.disconnect)
  s.on('connect_error', sockHandlers.connect_error)
  s.on('users:refresh', sockHandlers.users_refresh)
  s.on('users:patch', sockHandlers.users_patch)
  s.on('users:last_login', sockHandlers.users_last_login)
}

/* -----------------------------------------------------------
   Mount
----------------------------------------------------------- */
onMounted(async () => {
  try {
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    nickname.value = me?.nickname || ''

    const levelFromApi = me?.level || me?.user_level || me?.membership || ''
    viewerLevel.value = String(levelFromApi || '').trim()
    const premiumBool =
      me?.isPremium ?? me?.premium ?? (viewerLevel.value === '프리미엄회원')
    isPremium.value = Boolean(premiumBool)

    await fetchRelations()

    // 지역 기반 초기 검색
    const regionFilter = me.search_regions || []
    const res = await api.post('/api/search/users', { regions: regionFilter })
    applyFilterAndSort(res.data || [], me)

    initUsersSocket(me)
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', e)
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  try {
    const s = getSocket()
    if (s) {
      try { s.emit('users:leave', { scope: 'swipe' }) } catch {}
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
</script>

<style scoped>
/* ✅ ion-content 여백 제거 */
.no-gutter {
  --background: #000;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  --ion-safe-area-top: 0;
  --ion-safe-area-bottom: 0;
  --ion-safe-area-left: 0;
  --ion-safe-area-right: 0;
  padding: 0 !important;
  margin: 0 !important;
  color: #fff;
  overscroll-behavior: none;
}

.no-gutter :deep(.inner-scroll),
.no-gutter :deep(.scroll-content),
.no-gutter :deep(.content-scroll) {
  padding: 0 !important;
  margin: 0 !important;
}
</style>
