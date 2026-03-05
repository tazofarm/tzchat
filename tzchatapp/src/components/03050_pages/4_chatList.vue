<template>
  <!-- ✅ 단일 페이지(노멀 채팅 리스트 전용): ion-page > ion-content -->
  <ion-page class="friends-page dark-scope">
    <!-- ✅ fullscreen 제거: 전환/레이아웃 비용 감소 -->
    <ion-content>
      <div class="page-container fl-scope" role="region" aria-label="채팅방 리스트 영역">
        <div class="container">
          <ion-list v-if="chatRooms.length">
            <ion-item
              v-for="room in chatRooms"
              :key="room._id"
              button
              class="chat-item"
              @click="onItemClick(room._id)"
              @touchstart.passive="onPressStart(room._id, $event)"
              @touchend.passive="onPressEnd"
              @touchcancel.passive="onPressEnd"
              @touchmove.passive="onPressCancelMove"
              @mousedown.left="onPressStart(room._id, $event)"
              @mouseup.left="onPressEnd"
              @mouseleave="onPressEnd"
            >
              <!-- ⬇️ 좌측: 상대방 대표사진 -->
              <div class="list-avatar lead-start" slot="start">
                <ProfilePhotoViewer
                  v-if="getPartner(room.participants)?._id"
                  :userId="getPartner(room.participants)._id"
                  :gender="getPartner(room.participants).gender || ''"
                  :size="64"
                />
                <div v-else class="fallback-avatar" aria-hidden="true"></div>
              </div>

              <ion-label class="black-text">
                <h3 class="title">
                  <span class="nickname">{{ getPartnerNickname(room.participants) }}</span>
                  <span v-if="room.unreadCount > 0" class="badge-new" aria-label="안읽은 메시지">ⓝ</span>
                </h3>
                <p class="meta">{{ getPreview(room) }}</p>
              </ion-label>

              <ion-note slot="end" class="date-note" :aria-label="`최근 날짜 ${formatLastDate(room)}`">
                {{ formatLastDate(room) }}
              </ion-note>

              <!-- 🧨 길게누름 액션: 삭제/취소 버튼 -->
              <div v-if="longPressRoomId === room._id" class="item-actions" @click.stop>
                <button
                  type="button"
                  class="btn-delete"
                  @click.stop="confirmAndDelete(room._id)"
                  aria-label="채팅방 삭제"
                >
                  삭제
                </button>
                <button type="button" class="btn-cancel" @click.stop="hideActions" aria-label="닫기">
                  취소
                </button>
              </div>
            </ion-item>
          </ion-list>

          <ion-text color="medium" v-else>
            <p class="ion-text-center">채팅방이 없습니다.</p>
          </ion-text>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { IonPage, IonContent, IonList, IonItem, IonLabel, IonText, IonNote } from '@ionic/vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import ProfilePhotoViewer from '@/components/02010_minipage/mini_profile/ProfilePhotoViewer.vue'
import { connectSocket, getSocket } from '@/lib/socket'

const router = useRouter()

const myId = ref('')
const chatRooms = ref([])

/* ─────────────────────────────────────────────
   롱프레스(길게누름) 상태/로직
───────────────────────────────────────────── */
const longPressTimer = ref(null)
const longPressDelay = 600 // ms
const longPressRoomId = ref(null)
const skipNextClick = ref(false)
const pressStartXY = ref({ x: 0, y: 0 })

const onPressStart = (roomId, ev) => {
  const point =
    ev?.touches && ev.touches[0]
      ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
      : { x: ev.clientX ?? 0, y: ev.clientY ?? 0 }
  pressStartXY.value = point

  clearTimeout(longPressTimer.value)
  longPressTimer.value = setTimeout(() => {
    longPressRoomId.value = roomId
    skipNextClick.value = true
  }, longPressDelay)
}

const onPressEnd = () => {
  clearTimeout(longPressTimer.value)
  longPressTimer.value = null
}

const onPressCancelMove = (ev) => {
  const t = ev?.touches?.[0]
  if (!t) return
  const dx = Math.abs(t.clientX - pressStartXY.value.x)
  const dy = Math.abs(t.clientY - pressStartXY.value.y)
  if (dx > 10 || dy > 10) onPressEnd()
}

const hideActions = () => {
  longPressRoomId.value = null
  skipNextClick.value = false
}

const onItemClick = (roomId) => {
  if (skipNextClick.value || longPressRoomId.value) {
    skipNextClick.value = false
    return
  }
  goToChat(roomId)
}

/* ─────────────────────────────────────────────
   날짜 포맷: MM-DD
───────────────────────────────────────────── */
const getRoomTime = (r) => r?.lastMessage?.createdAt || r?.updatedAt || null
const formatLastDate = (room) => {
  const t = getRoomTime(room)
  if (!t) return ''
  const d = new Date(t)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

/* ─────────────────────────────────────────────
   응답 정규화 + 정렬
───────────────────────────────────────────── */
const normalizeRooms = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.rooms)) return data.rooms
  if (Array.isArray(data?.chatRooms)) return data.chatRooms
  if (Array.isArray(data?.data)) return data.data
  return []
}

const sortRoomsDesc = (rooms) => {
  return rooms.sort((a, b) => {
    const at = getRoomTime(a)
    const bt = getRoomTime(b)
    return new Date(bt || 0) - new Date(at || 0)
  })
}

/* ─────────────────────────────────────────────
   화면 표시 유틸
───────────────────────────────────────────── */
const getPartner = (participants = []) => {
  const my = String(myId.value || '')
  const other =
    participants.find((p) => typeof p === 'object' && p && String(p._id) !== my) ||
    (Array.isArray(participants) && participants.length === 2
      ? typeof participants[0] === 'object'
        ? participants.find((p) => String(p._id) !== my)
        : null
      : null)
  return other && typeof other === 'object' ? other : null
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

/* ─────────────────────────────────────────────
   API 로드
───────────────────────────────────────────── */
let loading = false

const loadMe = async () => {
  try {
    const meRes = await api.get('/api/me')
    myId.value = meRes.data?.user?._id || meRes.data?._id || ''
  } catch (err) {
    console.error('❌ /me 실패:', err?.response?.status, err?.response?.data || err?.message)
    myId.value = ''
  }
}

const loadChatRooms = async () => {
  if (loading) return
  loading = true
  try {
    const roomRes = await api.get('/api/chatrooms')
    const raw = normalizeRooms(roomRes.data)
    const mapped = raw.map((r) => ({
      ...r,
      unreadCount: Number(r.unreadCount || 0),
      lastMessage: r.lastMessage || null,
    }))
    chatRooms.value = sortRoomsDesc(mapped)
  } catch (err) {
    console.error('❌ 채팅방 목록 불러오기 실패:', err?.response?.status, err?.response?.data || err?.message)
    chatRooms.value = []
  } finally {
    loading = false
  }
}

const loadMeAndRooms = async () => {
  console.time('[LOAD] chatlist')
  await loadMe()
  await loadChatRooms()
  console.timeEnd('[LOAD] chatlist')
}

/* ─────────────────────────────────────────────
   삭제
───────────────────────────────────────────── */
const confirmAndDelete = async (roomId) => {
  try {
    const ok = window.confirm('이 채팅방을 삭제하시겠습니까?')
    if (!ok) return
    await api.delete(`/api/chatrooms/${roomId}`)
    chatRooms.value = chatRooms.value.filter((r) => r._id !== roomId)
    hideActions()
  } catch (err) {
    console.error('❌ 채팅방 삭제 실패:', err?.response?.status, err?.response?.data || err?.message)
    alert('삭제에 실패했습니다.')
  }
}

/* ─────────────────────────────────────────────
   이동
───────────────────────────────────────────── */
const goToChat = (roomId) => {
  if (!roomId) return
  const room = chatRooms.value.find((r) => r._id === roomId)
  if (room) room.unreadCount = 0 // 낙관적 UI
  router.push(`/home/chat/${roomId}`)
}

/* ─────────────────────────────────────────────
   소켓
   ✅ 이 페이지에서는 "연결 유지"가 핵심
   - disconnect 하지 말고, 이벤트만 해제
───────────────────────────────────────────── */
let offFns = []

const initSocket = () => {
  // 이미 앱 전역에서 사용 중이어도 안전하게 보장
  const socket = getSocket() || connectSocket()

  const onConnect = () => {
    if (myId.value) socket.emit('join', { userId: myId.value })
  }

  const reload = () => {
    // 연타 방지: 로딩 중이면 스킵
    loadChatRooms().catch(() => {})
  }

  socket.on('connect', onConnect)
  socket.on('chatrooms:badge', reload)
  socket.on('chatrooms:updated', reload)
  socket.on('chatMessage', reload)

  offFns = [
    () => socket.off('connect', onConnect),
    () => socket.off('chatrooms:badge', reload),
    () => socket.off('chatrooms:updated', reload),
    () => socket.off('chatMessage', reload),
  ]
}

/* ─────────────────────────────────────────────
   바깥 클릭 시 액션 닫기
───────────────────────────────────────────── */
const onDocClick = (e) => {
  // 액션이 열려있을 때만 처리
  if (!longPressRoomId.value) return
  const target = e.target
  // 액션 영역 클릭이면 무시
  if (target?.closest?.('.item-actions')) return
  hideActions()
}

/* ─────────────────────────────────────────────
   라이프사이클
───────────────────────────────────────────── */
onMounted(async () => {
  await loadMeAndRooms()
  initSocket()
  document.addEventListener('click', onDocClick, { passive: true })
})

onBeforeUnmount(() => {
  offFns.forEach((fn) => {
    try { fn() } catch {}
  })
  offFns = []

  // ✅ 절대 disconnect 하지 않음 (전환 딜레이 원인)
  // const socket = getSocket()
  // socket?.disconnect()

  document.removeEventListener('click', onDocClick)
  hideActions()
})
</script>

<style scoped>
/* =======================
   다크 테마 강제 고정
======================= */
.dark-scope { background: #000 !important; color: #f5f5f5; }

/* ✅ Ionic 전역 배경 변수/파트까지 완전 검정으로 통일 */
:global(.dark-scope) { --ion-background-color: #000 !important; }
:global(html, body, #app, ion-app, .friends-page, .friends-page ion-page) { background: #000 !important; }
:global(.dark-scope ion-content) { --background: #000 !important; background: #000 !important; }
:global(.dark-scope ion-content::part(background)) { background: #000 !important; }
:global(.dark-scope ion-content::part(scroll)) { background: #000 !important; }
:global(.dark-scope ion-content::part(content)) { background: #000 !important; }

:global(.dark-scope ion-list) { --background: transparent !important; background: transparent !important; }
:global(.dark-scope ion-item) {
  --background: transparent !important;
  --background-focused: transparent !important;
  --background-hover: #17171a !important;
  --background-activated: #17171a !important;
}

/* ========== 색상 변수(로컬) ========== */
:root {
  --gold:#d4af37; --gold-weak:#e6c964; --gold-strong:#b18f1a;
  --bg-deep:#000; --panel:#141414; --row:#1b1b1b;
  --ink:#f5f5f5; --ink-weak:#c9c9c9; --border:#333;
  --text: #f1f1f1; --text-dim: #a9a9a9; --panel-border: #333;
  --danger: #ff4d4f;
}

/* ========== 페이지 컨테이너 ========== */
.page-container { padding: 0; position: relative; }

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 8px 12px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

ion-list {
  background: var(--panel);
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  overflow: hidden;
}

ion-item {
  --background: var(--panel);
  --color: var(--text);
  --padding-start: 18px;
  --inner-padding-end: 10px;
  --min-height: 64px;
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--panel-border);
  color: var(--text);
}
ion-item:last-of-type { --inner-border-width: 0; }

.chat-item {
  margin: 0 0 20px 0;
  border-radius: 12px;
  --background: var(--row, #1b1b1b);
  --inner-border-width: 0;
  position: relative;
}

.date-note {
  font-size: 12px;
  color: var(--text-dim, #a9a9a9);
  margin-left: 8px;
  min-width: 48px;
  text-align: right;
}

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
  border: 1px solid rgba(212, 175, 55, 0.18);
  background: rgba(212, 175, 55, 0.08);
}
.fallback-avatar {
  width: 100%;
  height: 100%;
  opacity: 0.3;
  background: linear-gradient(135deg, #333, #222);
  border-radius: 0;
}
.list-avatar :deep(.viewer-host) { width: 100%; height: 100%; }
.list-avatar :deep(.avatar) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  border-radius: 0 !important;
  box-shadow: none !important;
  pointer-events: none;
}

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

.badge-new {
  font-size: 13px;
  color: var(--danger);
  font-weight: bold;
}

/* ──────────────────────────────
   길게누름 액션 버튼 (삭제/취소)
────────────────────────────── */
.item-actions {
  position: absolute;
  right: 8px;
  top: 8px;
  display: flex;
  gap: 8px;
  z-index: 2;
  pointer-events: auto;
}

.btn-delete,
.btn-cancel {
  appearance: none;
  border: 1px solid var(--panel-border, #333);
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 800;
  height: 40px;
  width: 70px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.btn-delete {
  background: linear-gradient(180deg, #dc3545, #b02a37);
  color: #fff;
  border-color: #b02a37;
}
.btn-delete:active { transform: translateY(1px); filter: brightness(0.95); }

.btn-cancel {
  background: var(--row, #1b1b1b);
  color: var(--text, #eee);
}
.btn-cancel:active { transform: translateY(1px); filter: brightness(1.05); }

@media (max-width: 380px) {
  .btn-delete, .btn-cancel { padding: 5px 8px; font-size: 12px; }
}
</style>
