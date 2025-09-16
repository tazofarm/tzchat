<template>
  <!-- 스와이프 카드 -->
  <div v-if="!isLoading && users.length" class="swiper-area">
    <swiper
      class="user-cards"
      :modules="swiperModules"
      effect="cards"
      :grab-cursor="true"
      :loop="false"
      @swiper="onSwiperReady"
      @slideChange="onSlideChange"
    >
      <swiper-slide
        v-for="(user, idx) in users"
        :key="user._id || idx"
        @click="goToUserProfile(user._id)"
      >
        <div class="card" aria-label="사용자 카드">
          <!-- 사진 -->
          <div class="photo" :aria-label="`${user.nickname}의 대표 이미지`">
            <ProfilePhotoViewer
              :userId="user._id"
              :gender="user.gender"
              :size="800"
            />
          </div>

          <!-- 정보 -->
          <div class="info">
            <h3 class="name"><span class="nick">{{ user.nickname }}</span></h3>

            <p class="meta">
              출생년도: {{ user.birthyear || '미입력' }} ·
              성별: {{ user.gender === 'man' ? '남자' : '여자' }}
            </p>

            <p class="meta">
              지역: {{ user.region1 || '미입력' }} / {{ user.region2 || '미입력' }}
            </p>

            <p class="meta">
              성향: {{ user.preference || '미입력' }}
            </p>

            <p class="meta">최근접속: 회원전용</p>

            <p class="meta">
              멘션: {{ ((user.selfintro ?? user.selfIntro ?? '') + '').trim() || '미입력' }}
            </p>
          </div>
        </div>
      </swiper-slide>
    </swiper>
  </div>

  <!-- 빈 상태 -->
  <ion-text color="medium" v-else-if="!isLoading && !users.length">
    <p class="ion-text-center">조건에 맞는 사용자가 없습니다.</p>
  </ion-text>

  <!-- 로딩 상태 -->
  <ion-text color="medium" v-else>
    <p class="ion-text-center">사용자 정보를 불러오는 중입니다...</p>
  </ion-text>
</template>

<script setup>
/* -----------------------------------------------------------
   Users List 페이지 (스와이프 카드로 전환)
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import ProfilePhotoViewer from '@/components/02010_minipage/ProfilePhotoViewer.vue'
import { IonText } from '@ionic/vue'

/* ✅ Swiper 추가 */
import { Swiper as SwiperCore } from 'swiper'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { EffectCards } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-cards'

import { applyTotalFilter } from '@/components/04210_Page2_target/Filter_total'
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

/* Swiper 상태 */
const swiperModules = [EffectCards]
const swiperRef = ref(null)
const currentIndex = ref(0)
const onSwiperReady = (swiper) => {
  swiperRef.value = swiper
  currentIndex.value = swiper?.activeIndex ?? 0
}
const onSlideChange = () => {
  if (!swiperRef.value) return
  currentIndex.value = swiperRef.value.activeIndex ?? 0
}

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
/* =========================================================
   Black + Gold Theme (scoped)
========================================================= */
:root,
:host {
  --bg: #0b0b0d;
  --panel: #121214;
  --panel-2: #17171a;
  --text-strong: #f3f3f3;
  --text: #d7d7d9;
  --text-dim: #a9a9ad;
  --divider: #26262a;
  --gold: #d4af37;
  --gold-2: #f1cf5a;
  --focus: rgba(212, 175, 55, 0.45);
}

ion-content{
  --background: var(--bg);
  color:#fff;
  padding:0;
  overscroll-behavior:none;
}

/* 스와이프 영역 = ion-content에 맞춤 */
.swiper-area{
  width:100%;
  height:100%;
  padding:0; margin:0;
  display:flex; align-items:center; justify-content:center;
  overflow:hidden;
}

.user-cards{
  width:100%;
  height:100%;
  overflow:hidden;
}

/* Swiper 내부도 100%로 */
.user-cards :deep(.swiper-wrapper),
.user-cards :deep(.swiper-slide){
  width:100%;
  height:100%;
  overflow:hidden;
}

/* 카드 */
.card{
  width:100%; height:100%;
  display:flex; flex-direction:column;
  background:#000;
}

/* 사진 박스 */
.photo{
  width:100%;
  max-width:100%;
  aspect-ratio: 4 / 4;       /* 사진 높이 비율 조절 포인트 */
  margin:0 auto;
  overflow:hidden;
  background:#000;
  display:flex; justify-content:center; align-items:center;
}

/* ProfilePhotoViewer 보정 */
.photo :deep(.viewer-host){ width:100%; height:100%; }
.photo :deep(.avatar){
  width:100% !important;
  height:100% !important;
  object-fit:cover;
  border-radius:0 !important;
  box-shadow:none !important;
  pointer-events:none;
}

/* 정보 영역 */
.info{
  flex:1;
  padding:14px 16px 16px;
  background:linear-gradient(0deg, rgba(0,0,0,0.9), rgba(0,0,0,0.55) 70%, rgba(0,0,0,0));
  color:#fff;
  overflow:auto;
}

.name{
  margin:0 0 6px;
  font-size:clamp(18px, 3.6vw, 22px);
  font-weight:900;
  color:#fff;
  line-height:1.25;
}
.nick{ font-weight:900; }
.meta{
  margin:0;
  color:#d0d0d0;
  font-size:clamp(14px, 2.8vw, 16px);
  line-height:1.45;
}

/* 포커스 */
:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus); border-radius: 10px; }

/* 작은 화면 보정 */
@media (max-width:360px){
  .info{ padding:12px 12px 14px; }
}
</style>
