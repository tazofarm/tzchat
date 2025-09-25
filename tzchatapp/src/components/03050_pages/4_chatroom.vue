<template>
  <!-- 🔹 채팅방 리스트 -->
  <div class="container">
    <!-- ✅ 상단 고정 탭: 채팅리스트 / 친구리스트 -->
    <div class="top-tabs" role="tablist" aria-label="목록 전환">
      <ion-segment :value="currentTab" @ionChange="onTabChange">
        <ion-segment-button value="chat">
          <ion-label>채팅리스트</ion-label>
        </ion-segment-button>
        <ion-segment-button value="friends">
          <ion-label>친구리스트</ion-label>
        </ion-segment-button>
      </ion-segment>
    </div>

    <ion-list v-if="chatRooms.length">
      <ion-item
        v-for="room in chatRooms"
        :key="room._id"
        button
        @click="goToChat(room._id)"
      >
        <!-- ⬇️ 좌측: 상대방 대표사진 (ProfilePhotoViewer 재사용) -->
        <div class="list-avatar lead-start" slot="start">
          <ProfilePhotoViewer
            v-if="getPartner(room.participants)?._id"
            :userId="getPartner(room.participants)._id"
            :gender="getPartner(room.participants).gender || ''"
            :size="64"
          />
          <!-- 파트너 식별 실패 시의 안전 영역 -->
          <div v-else class="fallback-avatar" aria-hidden="true"></div>
        </div>

        <ion-label class="black-text">
          <!-- 닉네임 + 새 메시지 ⓝ 표시 -->
          <h3 class="title">
            <span class="nickname">{{ getPartnerNickname(room.participants) }}</span>
            <span
              v-if="room.unreadCount > 0"
              class="badge-new"
              aria-label="안읽은 메시지"
            >ⓝ</span>
          </h3>

          <!-- 최근 메시지 프리뷰: 텍스트 or [사진] or 기본 문구 -->
          <p class="meta">{{ getPreview(room) }}</p>
        </ion-label>



        <!-- ✅ 오른쪽 끝: 최근 메시지 시각 -->
        <ion-note slot="end" class="date-note" :aria-label="`최근 날짜 ${formatLastDate(room)}`">
          {{ formatLastDate(room) }}
        </ion-note>



       <!-- ✅ 오른쪽 끝: 최근 메시지 시각
        <ion-note slot="end" class="date-note" :aria-label="`최근 시각 ${formatLastTime(room)}`">
          {{ formatLastTime(room) }}
        </ion-note>

 -->


      </ion-item>
    </ion-list>

    <ion-text color="medium" v-else>
      <p class="ion-text-center">채팅방이 없습니다.</p>
    </ion-text>
  </div>
</template>

<script setup>
// ------------------------------------------------------
// 채팅방 리스트 (4_chatroom.vue)
// - 상단 탭(채팅리스트/친구리스트) 추가
// - 정렬: 최신 메시지 시각 DESC
// - 우측 끝에 최근 시각 표시(오늘: HH:mm, 올해: MM.DD, 과거: YY.MM.DD)
// - 소켓 갱신 시 재조회
// ------------------------------------------------------
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { api } from '@/lib/api'
import {
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonNote,
} from '@ionic/vue'
import { useRouter, useRoute } from 'vue-router'

// ✅ 회원목록에서 쓰던 검증된 컴포넌트 재사용
import ProfilePhotoViewer from '@/components/02010_minipage/ProfilePhotoViewer.vue'

// ✅ 공용 소켓 모듈(JWT/쿠키 하이브리드 핸드셰이크)
import { connectSocket, getSocket } from '@/lib/socket'

const router = useRouter()
const route = useRoute()

const myId = ref('')
const chatRooms = ref([])

// ─────────────────────────────────────
// 상단 탭 상태 (경로와 동기화)
// ─────────────────────────────────────
const currentTab = ref('chat') // 'chat' | 'friends'

// 경로에 따라 탭 활성화 상태 반영
const syncTabWithRoute = () => {
  const path = route.path || ''
  currentTab.value = path.includes('3page') || path.includes('friends') ? 'friends' : 'chat'
}
syncTabWithRoute()
watch(() => route.path, syncTabWithRoute)

// 탭 전환 시 라우팅
const onTabChange = (ev) => {
  const val = ev.detail?.value
  if (val === 'friends') {
    router.push('/home/3page')   // ✅ 친구리스트
  } else {
    router.push('/home/4page')   // ✅ 채팅리스트
  }
}

// -------------------------------------------
// 날짜 포맷: 항상 YYYY-MM-DD
// -------------------------------------------
const formatLastDate = (room) => {
  const t = getRoomTime(room)
  if (!t) return ''
  const d = new Date(t)
  // const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  //return `${yyyy}-${mm}-${dd}`
  return `${mm}-${dd}`
}


// -------------------------------------------
// 유틸: 응답 정규화 + 정렬
// -------------------------------------------
const normalizeRooms = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.rooms)) return data.rooms
  if (Array.isArray(data?.chatRooms)) return data.chatRooms
  if (Array.isArray(data?.data)) return data.data
  return []
}

const getRoomTime = (r) => r?.lastMessage?.createdAt || r?.updatedAt || null

const sortRoomsDesc = (rooms) => {
  // 최신 시각 내림차순(최근이 위)
  return rooms.sort((a, b) => {
    const at = getRoomTime(a)
    const bt = getRoomTime(b)
    return new Date(bt || 0) - new Date(at || 0)
  })
}

// -------------------------------------------
// 날짜/시간 포맷: 오늘은 HH:mm, 올해는 MM.DD, 그 외 YY.MM.DD
// -------------------------------------------
const formatLastTime = (room) => {
  const t = getRoomTime(room)
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()

  if (sameDay) {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const sameYear = d.getFullYear() === now.getFullYear()
  if (sameYear) {
    // MM.DD 형식
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}.${dd}`
  }

  // YY.MM.DD 형식
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}.${mm}.${dd}`
}

// -------------------------------------------
// API: 내 정보 + 채팅방 목록
// -------------------------------------------
const loadMeAndRooms = async () => {
  console.time('[LOAD] /me + /chatrooms')
  try {
    const meRes = await api.get('/api/me')
    myId.value = meRes.data?.user?._id || meRes.data?._id || ''
    console.log('👤 Me OK:', { myId: myId.value })
  } catch (err) {
    console.error('❌ /me 실패:', err?.response?.status, err?.response?.data || err?.message)
  } finally {
    await loadChatRooms()
    console.timeEnd('[LOAD] /me + /chatrooms')
  }
}

const loadChatRooms = async () => {
  console.time('[LOAD] /chatrooms')
  try {
    const roomRes = await api.get('/api/chatrooms')
    const raw = normalizeRooms(roomRes.data)
    const mapped = raw.map(r => ({
      ...r,
      unreadCount: Number(r.unreadCount || 0),
      lastMessage: r.lastMessage || null,
    }))
    chatRooms.value = sortRoomsDesc(mapped)
    console.log(`💬 ChatRooms 로드 완료: count=${chatRooms.value.length}`, chatRooms.value)
  } catch (err) {
    console.error('❌ 채팅방 목록 불러오기 실패:', err?.response?.status, err?.response?.data || err?.message)
    chatRooms.value = []
  } finally {
    console.timeEnd('[LOAD] /chatrooms')
  }
}

// -------------------------------------------
// 소켓 초기화
// -------------------------------------------
const initSocket = () => {
  const socket = connectSocket()
  console.log('🔌 [Socket] connectSocket 호출 완료')

  socket.on('connect', () => {
    console.log('🔌 Socket.IO 연결됨:', socket.id)
    if (myId.value) {
      socket.emit('join', { userId: myId.value })
      console.log('🚪 개인룸 조인 요청:', myId.value)
    } else {
      console.warn('⚠️ myId 없음 — /me 실패했거나 인증 미인식')
    }
  })

  socket.on('chatrooms:badge', async () => {
    await loadChatRooms()
  })
  socket.on('chatrooms:updated', async () => {
    await loadChatRooms()
  })
  socket.on('chatMessage', async () => {
    await loadChatRooms()
  })

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket.IO 연결 해제:', reason)
  })
  socket.on('connect_error', (err) => {
    console.error('❌ Socket.IO 연결 오류:', err?.message || err)
  })
}

// -------------------------------------------
// 화면 표시 유틸
// -------------------------------------------
const getPartner = (participants = []) => {
  const my = String(myId.value || '')
  const other =
    participants.find(p => typeof p === 'object' && p && String(p._id) !== my) ||
    (Array.isArray(participants) && participants.length === 2
      ? (typeof participants[0] === 'object' ? participants.find(p => String(p._id) !== my) : null)
      : null)
  return (other && typeof other === 'object') ? other : null
}

const getPartnerNickname = (participants = []) => {
  const other = getPartner(participants)
  return other?.nickname || '(알 수 없음)'
}

const getPreview = (room) => {
  const last = room?.lastMessage
  if (!last) return '메시지가 없습니다.'
  if (last.content && last.content.trim().length > 0) return last.content
  if (last.imageUrl) return '[사진]'
  return '메시지가 없습니다.'
}

// -------------------------------------------
// 이동
// -------------------------------------------
const goToChat = (roomId) => {
  if (!roomId) return console.warn('⚠️ roomId 없음')
  console.log('➡️ 채팅방 이동:', roomId)

  const room = chatRooms.value.find(r => r._id === roomId)
  if (room) room.unreadCount = 0 // 낙관적 UI 초기화

  router.push(`/home/chat/${roomId}`)
}

// -------------------------------------------
// 라이프사이클
// -------------------------------------------
onMounted(async () => {
  await loadMeAndRooms()
  initSocket()
})

onBeforeUnmount(() => {
  const socket = getSocket()
  if (socket) {
    try {
      socket.off('chatrooms:badge')
      socket.off('chatrooms:updated')
      socket.off('chatMessage')
      socket.disconnect()
      console.log('🔌 Socket.IO 연결 해제')
    } catch (e) {
      console.warn('⚠️ 소켓 해제 중 오류:', e)
    }
  }
})
</script>

<style scoped>
/* ── Chat List Page: GOLD THEME 대응 ── */
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 8px 12px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

/* ✅ 상단 고정 탭 */
.top-tabs {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 5;
  background: var(--bg, #000); /* 테마 변수 없을 때 안전값 */
  padding: 6px 0 10px;
  margin-bottom: 6px;
  backdrop-filter: saturate(1.2) blur(2px);
  border-bottom: 1px solid var(--panel-border, rgba(212,175,55,0.25));
}
.top-tabs :deep(ion-segment) {
  --background: var(--panel, #111);
  --indicator-color: var(--gold, #d4af37);
  --color: var(--text, #eee);
  --color-checked: var(--text, #fff);
  border: 1px solid var(--panel-border, rgba(212,175,55,0.25));
  border-radius: 10px;
  overflow: hidden;
}

/* 리스트 컨테이너: 패널 톤 + 보더 */
ion-list {
  background: var(--panel);
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  overflow: hidden;
}

/* 각 아이템: 패널 톤/라인 + 텍스트 */
ion-item {
  --background: var(--panel);
  --color: var(--text);
  --padding-start: 18px;         /* 회원목록과 동일 패딩 */
  --inner-padding-end: 10px;
  --min-height: 64px;
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--panel-border);
  color: var(--text);
}
ion-item:last-of-type {
  --inner-border-width: 0;
}

/* 오른쪽 날짜 메모 */
.date-note {
  font-size: 12px;
  color: var(--text-dim, #a9a9a9);
  margin-left: 8px;
  min-width: 48px;
  text-align: right;
}

/* ⬇️ 회원목록과 동일한 아바타 스타일 재사용 */
.list-avatar {
  width: 64px;
  height: 64px;
  min-width: 64px;
  margin-right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10%;
  overflow: hidden;
  border: 1px solid rgba(212,175,55,0.18);
  background: rgba(212,175,55,0.08);
}
.fallback-avatar {
  width: 100%;
  height: 100%;
  opacity: 0.3;
  background: linear-gradient(135deg, #333, #222);
  border-radius: 0;
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
  border-radius: 0 !important;
  box-shadow: none !important;
  pointer-events: none; /* 리스트에서는 클릭(라이트박스) 비활성화 */
}

/* 텍스트 */
.black-text { color: var(--text); }
.title {
  color: var(--text);
  font-size: clamp(15px, 2.6vw, 16px);
  font-weight: 700;
  margin: 0 0 4px;
  line-height: 1.28;
  display: flex;
  align-items: center;
  gap: 6px;
}
.nickname { font-weight: 800; letter-spacing: 0.2px; }

.meta {
  color: var(--text-dim);
  font-size: clamp(14px, 2.4vw, 15px);
  margin: 2px 0 0;
  line-height: 1.35;
}

/* 새 메시지 뱃지 */
.badge-new {
  font-size: 13px;
  color: var(--danger);
  font-weight: bold;
}
</style>
