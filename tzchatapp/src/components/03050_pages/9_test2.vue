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
   Target: SwapeList (스와이프 카드형 리스트)
   - 기존 UserList → SwapeList 교체
   - 로딩 및 필터, 관계 데이터 유지
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
const excludeIds = ref(new Set())
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

const toIdList = (src) => (Array.isArray(src) ? src : []).map(v =>
  typeof v === 'string' ? v : String(v._id || v.id || v.userId || v.user_id || '')
).filter(Boolean)

const buildExcludeIdsSet = ({ friends = [], blocks = [], pendingSent = [], pendingRecv = [] } = {}) => {
  const set = new Set()
  for (const id of toIdList(friends)) set.add(id)
  for (const id of toIdList(blocks)) set.add(id)
  for (const id of toIdList(pendingSent)) set.add(id)
  for (const id of toIdList(pendingRecv)) set.add(id)
  return set
}

const filterByExcludeIds = (list, set) =>
  Array.isArray(list) ? list.filter(u => u && u._id && !(set instanceof Set ? set.has(String(u._id)) : false)) : []

const toTS = (v) => (v ? new Date(v).getTime() || 0 : 0)
const sortByLastLoginDesc = (list) => [...list].sort((a, b) => toTS(b.last_login || b.updatedAt) - toTS(a.last_login || a.updatedAt))

/* -----------------------------------------------------------
   관계/데이터 로딩
----------------------------------------------------------- */
async function fetchRelations() {
  try {
    const [friendsRes, blocksRes, sentRes, recvRes] = await Promise.all([
      api.get('/api/friends'),
      api.get('/api/blocks'),
      api.get('/api/friend-requests/sent'),
      api.get('/api/friend-requests/received'),
    ])
    const friends = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []
    excludeIds.value = buildExcludeIdsSet({ friends, blocks, pendingSent, pendingRecv })
  } catch (e) {
    console.error('❌ 관계 데이터 로딩 실패:', e)
    excludeIds.value = new Set()
  }
}

const applyFilterAndSort = (rawList, me) => {
  const afterExclude = filterByExcludeIds(rawList, excludeIds.value)
  const filtered = applyTotalFilterNormal(afterExclude, me, { log: false })
  users.value = sortByLastLoginDesc(filtered)
}

/* -----------------------------------------------------------
   Socket.IO (선택)
----------------------------------------------------------- */
function initUsersSocket(me) {
  const s = connectSocket()
  socket.value = s
  s.on('connect', () => s.emit('users:join', { scope: 'swipe' }))
  s.on('users:refresh', (payload) => applyFilterAndSort(payload || [], me))
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
      me?.isPremium ?? me?.premium ?? (String(levelFromApi || '').trim() === '프리미엄')
    isPremium.value = Boolean(premiumBool)

    await fetchRelations()

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
  const s = getSocket()
  if (s) {
    try { s.emit('users:leave', { scope: 'swipe' }) } catch {}
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
