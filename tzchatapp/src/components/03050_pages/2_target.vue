<template>
  <!-- 회원 목록 -->
  <ion-list v-if="!isLoading && users.length" class="users-list">
    <ion-item
      v-for="user in users"
      :key="user._id"
      button
      detail
      @click="goToUserProfile(user._id)"
    >
      <!-- ⬇️ 좌측: 대표사진(프로필 뷰어의 대표썸네일만 사용, 클릭 비활성화) -->
      <div class="list-avatar lead-start" slot="start">
        <ProfilePhotoViewer
          :userId="user._id"
          :gender="user.gender"
          :size="90"
        />
      </div>

      <!-- 본문 -->
      <ion-label class="black-text">
        <h3 class="title">
          <span class="nickname">{{ user.nickname }}</span>
        </h3>

        <p class="meta">
          <ion-icon :icon="icons.calendarOutline" class="row-icon" aria-hidden="true" />
          출생년도 : {{ user.birthyear }}
        </p>

        <p class="meta">
          <ion-icon
            :icon="user.gender === 'man' ? icons.maleOutline : icons.femaleOutline"
            class="row-icon"
            aria-hidden="true"
          />
          성별 : {{ user.gender === 'man' ? '남자' : '여자' }}
        </p>

        <p class="meta">
          <ion-icon :icon="icons.locationOutline" class="row-icon" aria-hidden="true" />
          지역 : {{ user.region1 }} / {{ user.region2 }}
        </p>

        <p class="meta">
          <ion-icon :icon="icons.chatbubblesOutline" class="row-icon" aria-hidden="true" />
          특징 : {{ user.preference }}
        </p>

        <p class="meta">
          <ion-icon :icon="icons.timeOutline" class="row-icon" aria-hidden="true" />
          최근 접속 : 회원전용
        </p>

        <p class="meta">
          <ion-icon :icon="icons.chatbubblesOutline" class="row-icon" aria-hidden="true" />
          멘션 : {{ (user.selfintro ?? user.selfIntro ?? '').trim() || '미입력' }}
        </p>


      </ion-label>
    </ion-item>
  </ion-list>

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
   Users List 페이지
   - Socket.IO 연동, 통합 필터 적용, 최근접속 정렬
   - 좌측 대표사진: ProfilePhotoViewer 활용
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api' // ✅ 공용 axios 인스턴스(/api 포함 baseURL)
import ProfilePhotoViewer from '@/components/02010_minipage/ProfilePhotoViewer.vue'

import {
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
} from '@ionic/vue'

import {
  personCircleOutline,
  calendarOutline,
  maleOutline,
  femaleOutline,
  locationOutline,
  chatbubblesOutline,
  timeOutline
} from 'ionicons/icons'

import { applyTotalFilter } from '@/components/04210_Page2_target/Filter_total'
import { buildExcludeIdsSet } from '@/components/04210_Page2_target/Filter_List'
import { connectSocket, getSocket } from '@/lib/socket'

/** =========================================================
 *  상태
 * ======================================================= */
const users = ref([])              // 화면 최종 리스트
const nickname = ref('')
const currentUser = ref({})
const isLoading = ref(true)
const excludeIds = ref(new Set())  // friends/blocks/pending 제외
const socket = ref(null)

const LOG = { init: true, socket: true, patch: true, sort: true, filter: true, relation: true }

const router = useRouter()
const icons = { personCircleOutline, calendarOutline, maleOutline, femaleOutline, locationOutline, chatbubblesOutline, timeOutline }

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

ion-content {
  --background: var(--bg);
  color: var(--text);
}

.users-list {
  background: var(--panel);
  margin: 10px 12px 16px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
}

ion-item {
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--divider);
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 60px;
  --background: transparent;
  color: var(--text);
  transition: background 0.18s ease, transform 0.06s ease;
}
ion-item:last-of-type { --inner-border-width: 0; }
ion-item:hover { background: var(--panel-2); }
ion-item:active { transform: translateY(1px); }

/* ⬇️ 새 아바타 스타일(좌측 대표사진) */
.list-avatar {
  width: 90px;
  height: 90px;
  min-width: 64px;
  margin-right: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 원형 크롭 */
  border-radius: 10%;
  overflow: hidden;
  border: 1px solid rgba(212,175,55,0.18);
  background: rgba(212,175,55,0.08);
}

/* ProfilePhotoViewer 내부 이미지 모양을 리스트용으로 보정 */
.list-avatar :deep(.viewer-host) {
  width: 100%;
  height: 100%;
}
.list-avatar :deep(.avatar) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  border-radius: 0 !important;  /* 바깥 컨테이너에서 원형 처리 */
  box-shadow: none !important;
  pointer-events: none;         /* 리스트에서는 클릭(라이트박스) 비활성화 */
}

/* 본문 텍스트/타이틀 */
.black-text { color: var(--text); }
.title {
  color: var(--text-strong);
  font-size: clamp(15px, 2.6vw, 16px);
  font-weight: 800;
  margin: 0 0 4px;
  line-height: 1.28;
}
.nickname { font-weight: 800; letter-spacing: 0.2px; text-shadow: 0 0 10px rgba(212,175,55,0.08); }

.meta {
  display: flex; align-items: center; gap: 6px;
  color: var(--text); font-size: clamp(13px, 2.4vw, 14px);
  margin: 2px 0 0; line-height: 1.32; opacity: 0.94;
}
.row-icon { font-size: 15px; color: var(--gold); }

/* 안내문 */
ion-text p.ion-text-center {
  margin: 16px 0;
  font-size: clamp(14px, 2.6vw, 15px);
  color: var(--text-dim);
}

/* 포커스 */
:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--focus); border-radius: 10px; }

/* 작은 화면 보정 */
@media (max-width: 360px) {
  .users-list { margin: 8px; border-radius: 12px; }
  ion-item { --padding-start: 80px; --inner-padding-end: 10px; --min-height: 56px; }
}

/* 좌측 정렬 유틸 */
.lead-start{
  width: auto;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

/* 아이템 전체의 왼쪽 패딩 */
ion-item{
  --padding-start: 18px;
  --inner-padding-end: 10px;
}
</style>
