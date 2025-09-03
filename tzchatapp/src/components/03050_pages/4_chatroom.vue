<template>
  <!-- 🔹 채팅방 리스트 -->
  <div class="container">
    <ion-list v-if="chatRooms.length">
      <ion-item
        v-for="room in chatRooms"
        :key="room._id"
        button
        @click="goToChat(room._id)"
      >
        <!-- 🔹 왼쪽 아이콘: 말풍선 -->
        <ion-icon
          :icon="icons.chatbubbleEllipsesOutline"
          slot="start"
          class="list-icon"
        />

        <ion-label class="black-text">
          <!-- 닉네임 + 새 메시지 ⓝ 표시 -->
          <h3>
            {{ getPartnerNickname(room.participants) }}
            <span
              v-if="room.unreadCount > 0"
              class="badge-new"
              aria-label="안읽은 메시지"
            >ⓝ</span>
          </h3>

          <!-- 최근 메시지 프리뷰: 텍스트 or [사진] or 기본 문구 -->
          <p>{{ getPreview(room) }}</p>
        </ion-label>
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
// - 응답 정규화 & 정렬(최신 메시지 DESC)
// - 소켓 갱신(badge/updated/chatMessage) 시 재조회
// - 로그/주석 강화, 구조/로직 최대 유지
// ------------------------------------------------------
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '@/lib/api' // ✅ 공용 axios 인스턴스(/api 포함 baseURL, withCredentials=true)
import {
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonIcon,
} from '@ionic/vue'
import { useRouter } from 'vue-router'

// ✅ Ionicons
import { chatbubbleEllipsesOutline } from 'ionicons/icons'
const icons = { chatbubbleEllipsesOutline }

const router = useRouter()

const myId = ref('')
const chatRooms = ref([])

// ✅ 공용 소켓 모듈(JWT/쿠키 하이브리드 핸드셰이크)
import { connectSocket, getSocket } from '@/lib/socket'

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

const sortRoomsDesc = (rooms) => {
  return rooms.sort((a, b) => {
    const at = a?.lastMessage?.createdAt || a?.updatedAt || 0
    const bt = b?.lastMessage?.createdAt || b?.updatedAt || 0
    return new Date(bt) - new Date(at)
  })
}

// -------------------------------------------
// API: 내 정보 + 채팅방 목록
// -------------------------------------------
const loadMeAndRooms = async () => {
  console.time('[LOAD] /me + /chatrooms')
  try {
    const meRes = await api.get('/me')
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
    const roomRes = await api.get('/chatrooms')
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
  // ✅ 현재 오리진 기준 + path=/socket.io + withCredentials (공용 모듈)
  const socket = connectSocket()
  console.log('🔌 [Socket] connectSocket 호출 완료 (origin-relative)')

  socket.on('connect', () => {
    console.log('🔌 Socket.IO 연결됨:', socket.id)
    if (myId.value) {
      socket.emit('join', { userId: myId.value })
      console.log('🚪 개인룸 조인 요청:', myId.value)
    } else {
      console.warn('⚠️ myId 없음 — /me 실패했거나 인증 미인식')
    }
  })

  // ✅ 목록/배지 갱신 신호
  socket.on('chatrooms:badge', async (payload) => {
    console.log('🔔 [socket] chatrooms:badge 수신:', payload)
    await loadChatRooms()
  })
  socket.on('chatrooms:updated', async (payload) => {
    console.log('🔔 [socket] chatrooms:updated 수신:', payload)
    await loadChatRooms()
  })
  // (호환) 메시지 전파 시 재조회
  socket.on('chatMessage', async () => {
    console.log('📩 [socket] chatMessage 수신(호환): 목록 재조회')
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
const getPartnerNickname = (participants = []) => {
  const other = participants.find(p => String(p._id) !== String(myId.value))
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
  // ✅ 공용 모듈에서 소켓을 가져와 안전하게 정리
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
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 60px;
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--panel-border);
  color: var(--text);
}
ion-item:last-of-type {
  --inner-border-width: 0;
}

/* 아이콘 */
.list-icon {
  font-size: 22px;
  color: var(--text-dim);
  margin-right: 4px;
}

/* 제목 + 새 메시지 뱃지 */
ion-label h3 {
  margin: 0;
  font-size: clamp(15px, 2.6vw, 16px);
  font-weight: 700;
  color: var(--text); /* ✅ 가독성: 밝은 텍스트 */
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 4px;
}
.badge-new {
  font-size: 13px;
  color: var(--danger); /* ✅ 경고색 변수 */
  font-weight: bold;
}

/* 미리보기 문구 */
ion-label p {
  margin: 2px 0 0;
  font-size: clamp(14px, 2.4vw, 15px);
  color: var(--text-dim); /* ✅ 보조 텍스트 */
  line-height: 1.35;
}

/* 빈 상태 텍스트는 <ion-text color="medium">로 톤 자동 적용됨 */
.black-text { color: var(--text); }
</style>
