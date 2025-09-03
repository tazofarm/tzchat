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
      <!-- 좌측 리딩 아이콘(프로필 대용) -->
      <ion-icon :icon="icons.personCircleOutline" slot="start" class="list-icon" />

      <!-- 블랙 테마에서는 가독성을 위해 밝은 텍스트 사용 -->
      <ion-label class="black-text">
        <!-- 제목: nickname -->
        <h3 class="title">
          <span class="nickname">{{ user.nickname }}</span>
        </h3>

        <!-- 보조정보: 아이콘 + 텍스트 한 줄 -->
        <p class="meta">
          <ion-icon :icon="icons.calendarOutline" class="row-icon" aria-hidden="true" />
          출생년도: {{ user.birthyear }}
        </p>

        <p class="meta">
          <ion-icon
            :icon="user.gender === 'man' ? icons.maleOutline : icons.femaleOutline"
            class="row-icon"
            aria-hidden="true"
          />
          성별: {{ user.gender === 'man' ? '남자' : '여자' }}
        </p>

        <p class="meta">
          <ion-icon :icon="icons.locationOutline" class="row-icon" aria-hidden="true" />
          지역: {{ user.region1 }} / {{ user.region2 }}
        </p>

        <p class="meta">
          <ion-icon :icon="icons.chatbubblesOutline" class="row-icon" aria-hidden="true" />
          성향: {{ user.preference }}
        </p>

        <!-- 🔎 마지막 접속(디버그용) -->
        <p class="meta">
          <ion-icon :icon="icons.timeOutline" class="row-icon" aria-hidden="true" />
          마지막 접속:
          {{ formatKST(user.last_login || user.lastLogin || user.updatedAt || user.createdAt) }}
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
   - Socket.IO 연동으로 실시간 갱신
   - 통합 필터: filter_total.js (관계/지역/성향/출생년도/친구허용)
   - 정렬: 마지막 접속(최근순) 내림차순
   - 변경 최소 / 주석·로그 최대
   - ✅ API: '@/lib/api' (withCredentials + Bearer 병행)
   - ✅ Socket: '@/lib/socket' (쿠키+JWT 하이브리드)
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api' // ✅ 공용 axios 인스턴스(/api 포함 baseURL)

// Ionic
import {
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonIcon
} from '@ionic/vue'

// Ionicons
import {
  personCircleOutline,
  calendarOutline,
  maleOutline,
  femaleOutline,
  locationOutline,
  chatbubblesOutline,
  timeOutline
} from 'ionicons/icons'

// ✅ 통합 필터 (현재 경로 사용 유지)
import { applyTotalFilter } from '@/components/04210_Page2_target/Filter_total'

// ✅ 관계 제외 Set 생성 유틸
import { buildExcludeIdsSet } from '@/components/04210_Page2_target/Filter_List' // ✅ NEW

// 🔌 Socket.IO 클라이언트 래퍼(JWT/세션 하이브리드)
import { connectSocket, getSocket } from '@/lib/socket'

/** =========================================================
 *  상태
 * ======================================================= */
const users = ref([])              // 화면에 표시할 최종 리스트(필터 + 정렬 반영)
const nickname = ref('')
const currentUser = ref({})
const isLoading = ref(true)

// ✅ 관계 제외 ID Set (friends / pendingSent / pendingRecv / blocks)
const excludeIds = ref(new Set())  // ✅ NEW

// 소켓 인스턴스
const socket = ref(null)

// 로그 제어(필요 시 false로 낮출 수 있음)
const LOG = {
  init: true,
  socket: true,
  patch: true,
  sort: true,
  filter: true,
  relation: true, // ✅ NEW
}

const router = useRouter()

// 템플릿에서 쓰기 편하도록 묶음
const icons = {
  personCircleOutline,
  calendarOutline,
  maleOutline,
  femaleOutline,
  locationOutline,
  chatbubblesOutline,
  timeOutline
}

/** =========================================================
 *  유틸: 날짜 정규화/포맷 + 정렬
 * ======================================================= */
function toTS(v) {
  if (!v) return 0
  try {
    const t = new Date(v).getTime()
    return Number.isFinite(t) ? t : 0
  } catch {
    return 0
  }
}

function formatKST(v) {
  if (!v) return '-'
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('ko-KR', { hour12: false })
  } catch {
    return '-'
  }
}

/** 🔥 마지막 접속(최근순) 내림차순 정렬 */
function sortByLastLoginDesc(list) {
  const sorted = [...list].sort((a, b) => {
    const aTS = toTS(a.last_login || a.lastLogin || a.updatedAt || a.createdAt)
    const bTS = toTS(b.last_login || b.lastLogin || b.updatedAt || b.createdAt)
    return bTS - aTS
  })
  if (LOG.sort) {
    console.log(
      '[Users] 정렬 완료(최근 접속 순). 상위 3개:',
      sorted.slice(0, 3).map(u => ({ n: u.nickname, t: u.last_login || u.lastLogin || u.updatedAt }))
    )
  }
  return sorted
}

/** 디바운스 */
function debounce(fn, delay = 120) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

/** =========================================================
 *  라우팅
 * ======================================================= */
const goToUserProfile = (userId) => {
  if (!userId) return console.warn('❗ userId 없음')
  if (LOG.init) console.log('➡️ 유저 프로필 페이지 이동:', userId)
  router.push(`/home/user/${userId}`)
}

/** =========================================================
 *  관계 데이터 로딩 (친구/차단/보낸·받은 대기중)  ✅ NEW
 * ======================================================= */
async function fetchRelations() {
  try {
    console.time('[Users] relations')
    const [friendsRes, blocksRes, sentRes, recvRes] = await Promise.all([
      api.get('/friends'),
      api.get('/blocks'),
      api.get('/friend-requests/sent'),
      api.get('/friend-requests/received'),
    ])

    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []

    excludeIds.value = buildExcludeIdsSet({
      friends,
      blocks,
      pendingSent,
      pendingRecv,
    })

    if (LOG.relation) {
      console.log('[Users] 관계 excludeIds size:', excludeIds.value.size)
    }
  } catch (e) {
    console.error('❌ 관계 데이터 로딩 실패:', e)
    excludeIds.value = new Set()
  } finally {
    console.timeEnd('[Users] relations')
  }
}

/** =========================================================
 *  서버에서 전체 사용자 리스트를 가져와 필터+정렬 후 반영
 * ======================================================= */
const applyFilterAndSort = (rawList, me) => {
  // 1) 통합 필터 (관계 제외 Set 전달)  ✅ NEW
  const filtered = applyTotalFilter(rawList, me, {
    excludeIds: excludeIds.value,
  })
  if (LOG.filter) console.log(`[Users] 통합 필터 적용 결과: ${filtered.length}/${rawList?.length ?? 0}`)

  // 2) 마지막 접속 내림차순 정렬
  users.value = sortByLastLoginDesc(filtered)
}

// 🔄 소켓에서 연속 패치가 들어올 때 묶어서 반영
const scheduleRender = debounce(() => {
  users.value = sortByLastLoginDesc(users.value)
}, 100)

/** =========================================================
 *  Socket.IO
 *  - 커넥션은 '@/lib/socket' 사용(쿠키+JWT 핸드셰이크 지원)
 * ======================================================= */
function initUsersSocket(me) {
  if (socket.value && socket.value.connected) return

  // 공용 커넥터로 연결(원본 설정: path=/socket.io, withCredentials, JWT auth)
  const s = connectSocket()
  socket.value = s

  s.on('connect', () => {
    if (LOG.socket) console.log('✅ [Socket] connected:', s.id)
    try { s.emit('users:join', { scope: 'list' }) } catch (_) {}
  })

  s.on('disconnect', (reason) => {
    console.warn('⚠️ [Socket] disconnected:', reason)
  })

  s.on('connect_error', (err) => {
    console.error('❌ [Socket] connect_error:', err?.message || err)
  })

  // 🔥 서버가 보내는 “전체 새로고침”
  s.on('users:refresh', (payload) => {
    if (LOG.socket) console.log('🟦 [Socket] users:refresh 수신, 길이=', payload?.length)
    try {
      applyFilterAndSort(payload || [], me)
    } catch (e) {
      console.error('❌ users:refresh 처리 오류:', e)
    }
  })

  // 🔥 서버가 보내는 “부분 패치(단일 유저 변화)”
  s.on('users:patch', (u) => {
    if (LOG.patch) console.log('🟨 [Socket] users:patch 수신:', u?._id, u?.nickname)
    try {
      if (!u || !u._id) return

      // 관계 제외 세이프가드: 제외 대상이면 무시  ✅ NEW
      if (excludeIds.value instanceof Set && excludeIds.value.has(String(u._id))) {
        if (LOG.patch) console.log('↩︎ 관계 제외 대상 patch → 무시:', u._id)
        return
      }

      const idx = users.value.findIndex(x => x._id === u._id)
      if (idx >= 0) {
        users.value[idx] = { ...users.value[idx], ...u }
      } else {
        // 새 유저는 단건 필터 통과 시에만 추가  ✅ NEW
        const filteredOnce = applyTotalFilter([u], me, { excludeIds: excludeIds.value })
        if (filteredOnce.length) users.value.push(filteredOnce[0])
      }
      scheduleRender()
    } catch (e) {
      console.error('❌ users:patch 처리 오류:', e)
    }
  })

  // 🔥 “마지막 접속만 갱신”
  s.on('users:last_login', ({ userId, last_login }) => {
    if (LOG.patch) console.log('🟩 [Socket] users:last_login:', userId, last_login)
    const idx = users.value.findIndex(x => x._id === userId)
    if (idx >= 0) {
      users.value[idx] = { ...users.value[idx], last_login }
      scheduleRender()
    }
  })

  // (선택) 관계 변동 이벤트가 있다면 여기서 excludeIds 갱신 가능
  // s.on('relations:changed', async () => {
  //   await fetchRelations()
  // })
}

/** =========================================================
 *  라이프사이클
 * ======================================================= */
onMounted(async () => {
  try {
    console.time('[Users] init')

    // 1) 내 정보 로딩
    const me = (await api.get('/me')).data.user
    currentUser.value = me
    nickname.value = me?.nickname || ''
    if (LOG.init) console.log('✅ 사용자 정보 로딩 완료:', me)

    // 2) 관계 데이터 로딩(친구/차단/보낸·받은 대기중)  ✅ NEW
    await fetchRelations()

    // 3) 서버 검색
    const regionFilter = me.search_regions || []
    const res = await api.post('/search/users', { regions: regionFilter })

    // 4) 통합 필터(관계 제외 포함) + 정렬
    applyFilterAndSort(res.data || [], me)

    // 5) 소켓 연결(쿠키/ JWT 하이브리드)
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
      if (LOG.socket) console.log('🔌 [Socket] disconnect()')
      s.disconnect()
    }
    socket.value = null
  } catch (e) {
    console.error('❌ 소켓 정리 실패:', e)
  }
})

/** (옵션) 로그아웃 예시 */
const logout = async () => {
  try {
    await api.post('/logout')
    router.push('/login')
  } catch (e) {
    console.error('❌ 로그아웃 실패:', e)
  }
}
</script>

<style scoped>
/* =========================================================
   Black + Gold Theme (scoped)
   - 색상 변수로 일관성 유지
   - 골드 포커스/테두리/아이콘 포인트
========================================================= */
:root,
:host {
  --bg: #0b0b0d;            /* 전체 배경(딥블랙) */
  --panel: #121214;         /* 리스트/카드 배경 */
  --panel-2: #17171a;       /* hover/pressed */
  --text-strong: #f3f3f3;   /* 타이틀 텍스트 */
  --text: #d7d7d9;          /* 본문 텍스트 */
  --text-dim: #a9a9ad;      /* 보조 텍스트 */
  --divider: #26262a;       /* 아이템 구분선 */
  --gold: #d4af37;          /* 골드(메인) */
  --gold-2: #f1cf5a;        /* 밝은 골드(hover) */
  --focus: rgba(212, 175, 55, 0.45); /* 포커스 링 */
}

/* IonContent 배경을 다크로 */
ion-content {
  --background: var(--bg);
  color: var(--text);
}

/* 리스트 컨테이너 */
.users-list {
  background: var(--panel);
  margin: 10px 12px 16px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.18); /* 옅은 골드 라인 */
  box-shadow: 0 2px 10px rgba(0,0,0,0.35);
}

/* 각 아이템(행) */
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

/* hover/pressed 시 약간의 상승감 + 패널 색 */
ion-item:hover { background: var(--panel-2); }
ion-item:active { transform: translateY(1px); }

/* 좌측 아이콘: 골드 포인트 */
.list-icon {
  font-size: 24px;
  color: var(--gold);
}

/* 라벨(텍스트) */
.black-text {
  color: var(--text); /* 블랙테마에서는 밝은 텍스트로 가독성 유지 */
}

/* 타이틀(닉네임) */
.title {
  color: var(--text-strong);
  font-size: clamp(15px, 2.6vw, 16px);
  font-weight: 800;     /* 강조 */
  margin: 0 0 4px;
  line-height: 1.28;
  word-break: break-word;
}
.nickname {
  font-weight: 800;
  letter-spacing: 0.2px;
  text-shadow: 0 0 10px rgba(212,175,55,0.08); /* 은은한 광택 */
}

/* 보조 정보 라인 */
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: clamp(13px, 2.4vw, 14px);
  margin: 2px 0 0;
  line-height: 1.32;
  word-break: break-word;
  opacity: 0.94;
}

/* 보조 정보 아이콘: 골드 */
.row-icon {
  font-size: 15px;
  color: var(--gold);
}

/* 빈/로딩 안내 */
ion-text p.ion-text-center {
  margin: 16px 0;
  font-size: clamp(14px, 2.6vw, 15px);
  color: var(--text-dim);
}

/* 포커스 접근성: 골드 포커스 링 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus);
  border-radius: 10px;
}

/* iOS/안드 공통 작은 화면 보정 */
@media (max-width: 360px) {
  .users-list { margin: 8px; border-radius: 12px; }
  ion-item { --padding-start: 10px; --inner-padding-end: 10px; --min-height: 56px; }
  .list-icon { font-size: 22px; }
}
</style>
