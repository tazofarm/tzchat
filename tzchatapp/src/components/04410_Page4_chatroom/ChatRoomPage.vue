<template> 
  <div class="chatroom-container">
    <!-- 상단바 -->
    <div class="chatroom-header">
      <ion-button size="small" fill="clear" @click="goBack" aria-label="뒤로가기">←</ion-button>
      <span class="chat-title" @click="goToPartnerProfile">{{ partnerNickname }}</span>
    </div>

    <!-- 메시지 리스트 -->
    <div class="chat-messages" ref="chatScroll" @scroll.passive="scheduleMarkAsRead(250)">
      <div
        v-for="msg in messages"
        :key="msg._id"
        class="message-row"
        :class="{ mine: isMine(msg) }"
      >
        <!-- 내가 보낸 메시지 -->
        <template v-if="isMine(msg)">
          <div class="my-message">
            <span class="time">{{ formatTime(msg.createdAt) }}</span>
            <div class="bubble my-bubble">
              <template v-if="msg.imageUrl">
                <img :src="getImageUrl(msg.imageUrl)" class="chat-image" @click="openImage(getImageUrl(msg.imageUrl))" />
              </template>
              <template v-else>
                {{ msg.content }}
              </template>
            </div>
            <!-- ✅ '상대가 아직 안읽음' 표시 -->
            <span
              v-if="!isReadByPartner(msg)"
              class="read-flag"
              aria-label="상대가 아직 읽지 않음"
            >안읽음</span>
          </div>
        </template>

        <!-- 상대방 메시지 -->
        <template v-else>
          <div class="other-message">
            <div class="bubble other-bubble">
              <template v-if="msg.imageUrl">
                <img :src="getImageUrl(msg.imageUrl)" class="chat-image" @click="openImage(getImageUrl(msg.imageUrl))" />
              </template>
              <template v-else>
                {{ msg.content }}
              </template>
            </div>
            <span class="time">{{ formatTime(msg.createdAt) }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- 입력창 -->
    <div class="chat-input-wrapper">
      <!-- 이모지 픽커 (웹컴포넌트) -->
      <div v-if="showEmoji" class="emoji-picker-wrapper">
        <!-- ⚠️ <emoji-picker>는 vite.config.ts 의 isCustomElement 설정 + main.ts 전역 import 필요 -->
        <emoji-picker @emoji-click="insertEmoji"></emoji-picker>
      </div>

      <div class="chat-input">
        <ion-button size="small" fill="outline" class="icon-btn" @click="triggerFileInput" aria-label="파일 첨부">📎</ion-button>
        <input type="file" accept="image/*" ref="fileInput" style="display: none" @change="uploadImage" />
        <ion-button size="small" fill="outline" class="icon-btn" @click="toggleEmoji" aria-label="이모지 선택">😊</ion-button>

        <textarea
          v-model="newMessage"
          placeholder="메시지를 입력하세요"
          @keydown="handleKeydown"
          rows="1"
        ></textarea>

        <ion-button size="small" color="primary" @click="sendMessage" aria-label="전송">전송</ion-button>
      </div>
    </div>

    <!-- ✅ 이미지 확대 팝업 -->
    <transition name="fade">
      <div v-if="enlargedImage" class="image-modal" role="dialog" aria-modal="true" aria-label="이미지 보기">
        <div class="image-wrapper">
          <button class="close-button" @click="enlargedImage = ''" aria-label="닫기">×</button>
          <img :src="enlargedImage" class="modal-image" @click.stop />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
// ------------------------------------------------------------------
// ChatRoomPage.vue (Black+Gold / Compact)
// - 텍스트/이미지 전송, 이모지, 이미지 확대
// - Socket.IO 실시간 수신
// - ✅ 읽음 처리 디바운스 + 소켓 동기화
// - 로그/주석 최대화
// ------------------------------------------------------------------
import { ref, onMounted, nextTick, onBeforeUnmount, watch } from 'vue'
import { IonButton } from '@ionic/vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance'

// ❌ (삭제) 개별 컴포넌트에서 직접 io 생성 → 혼성콘텐츠/중복연결 원인
// import { io } from 'socket.io-client'

// ✅ (추가) 공용 소켓 모듈 사용: 현재 오리진 기반 연결 유지
import { connectSocket, getSocket } from '@/lib/socket' // ★ 변경

// emoji-picker-element는 main.ts에서 전역 import 권장
// import 'emoji-picker-element'

const route = useRoute()
const router = useRouter()

const roomId = String(route.params.id || '')

// ✅ 공용 소켓 인스턴스: 페이지 라이프사이클 동안 참조만
let socket = null // ★ 변경: 전역 disconnect() 지양(앱 전체 1회 연결 유지)

console.log('[ChatRoom] socket module ready, roomId:', roomId)

const myId = ref('')
const partnerId = ref('')
const partnerNickname = ref('상대방')

const messages = ref([])
const newMessage = ref('')
const chatScroll = ref(null)
const showEmoji = ref(false)
const fileInput = ref(null)

const enlargedImage = ref('')
const openImage = (url) => { 
  enlargedImage.value = url 
  console.log('[ChatRoom] openImage:', url)
}

// ✅ 이미지 URL 보정: http 접두 제거 → 동일 오리진(https)로 강제
const getImageUrl = (path) => {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = window.location.origin.replace(/\/+$/, '')         // https://tzchat.duckdns.org
  const p = String(path).startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

// 내가 보낸 메시지 여부
const isMine = (msg) => !!(msg?.sender && (msg.sender._id === myId.value || msg.sender === myId.value))

// 이 메시지가 '상대'에 의해 읽혔는지
const isReadByPartner = (msg) => {
  if (!partnerId.value) return false
  const arr = msg?.readBy || []
  return arr.some((id) => String(id) === String(partnerId.value))
}

// 메시지 불러오기
const loadMessages = async () => {
  try {
    console.log('[ChatRoom] loadMessages start:', roomId)
    const res = await axios.get(`/api/chatrooms/${roomId}`)
    messages.value = res.data.messages || []
    myId.value = res.data.myId

    const partner = res.data.participants?.find?.(p => String(p._id) !== String(myId.value))
    partnerNickname.value = partner?.nickname || '상대방'
    partnerId.value = partner?._id || ''

    console.log('[ChatRoom] loadMessages OK:', {
      count: messages.value.length, myId: myId.value, partnerId: partnerId.value
    })
    scrollToBottom()
    scheduleMarkAsRead()
  } catch (err) {
    console.error('❌ 메시지 불러오기 실패:', err)
  }
}

// 텍스트 메시지 전송
const sendMessage = async () => {
  const content = newMessage.value.trim()
  if (!content) return
  try {
    console.log('[ChatRoom] sendMessage:', content)
    const res = await axios.post(`/api/chatrooms/${roomId}/message`, { content, type: 'text' })
    newMessage.value = ''
    // ✅ 공용 소켓 통해 브로드캐스트
    getSocket()?.emit('chatMessage', { roomId, message: res.data })
    console.log('[ChatRoom] emit chatMessage:', { roomId, id: res.data?._id })
  } catch (err) {
    console.error('❌ 텍스트 메시지 전송 실패:', err)
  }
}

// 이미지 업로드 + 전송
const uploadImage = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('image', file)
  try {
    console.log('[ChatRoom] uploadImage start:', file.name, file.type, file.size)
    const uploadRes = await axios.post('/api/chatrooms/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true
    })
    const imageUrl = uploadRes.data.imageUrl
    console.log('[ChatRoom] uploadImage OK, url:', imageUrl)

    const messageRes = await axios.post(`/api/chatrooms/${roomId}/message`, {
      content: imageUrl, type: 'image'
    }, { withCredentials: true })

    getSocket()?.emit('chatMessage', { roomId, message: messageRes.data })
    console.log('[ChatRoom] emit chatMessage(image):', { roomId, id: messageRes.data?._id })
  } catch (err) {
    console.error('❌ 이미지 업로드 실패:', err)
  } finally {
    e.target.value = '' // 같은 파일 재선택 가능하도록 초기화
  }
}

// Enter 전송(Shift+Enter 줄바꿈)
const handleKeydown = (e) => {
  if (e.key === 'Enter') {
    if (e.shiftKey) return
    e.preventDefault()
    sendMessage()
  }
}

// 파일선택 트리거
const triggerFileInput = () => {
  console.log('[ChatRoom] triggerFileInput')
  fileInput.value?.click()
}

// 이모지 삽입
const insertEmoji = (event) => {
  const emoji = event?.detail?.unicode || ''
  if (emoji) {
    newMessage.value += emoji
    console.log('[ChatRoom] insertEmoji:', emoji)
  } else {
    console.warn('[ChatRoom] insertEmoji: no unicode in event', event)
  }
}

// 이모지 토글
const toggleEmoji = () => {
  showEmoji.value = !showEmoji.value
  console.log('[ChatRoom] toggleEmoji:', showEmoji.value)
}

// 시간 포맷
const formatTime = (isoString) =>
  new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// 스크롤 최하단 고정
const scrollToBottom = async () => {
  try {
    await nextTick()
    const el = chatScroll.value
    if (el) el.scrollTop = el.scrollHeight
  } catch (e) {
    console.warn('[ChatRoom] scrollToBottom error:', e)
  }
}

/* ───────── 읽음 처리 (디바운스) ───────── */
let readTimer = null
const scheduleMarkAsRead = (delay = 200) => {
  if (readTimer) clearTimeout(readTimer)
  readTimer = setTimeout(markAsReadNow, delay)
}
const markAsReadNow = async () => {
  try {
    if (!roomId || !myId.value) return
    const res = await axios.put(`/api/chatrooms/${roomId}/read`)
    const updatedIds = res?.data?.updatedMessageIds || []
    if (!updatedIds.length) return

    // 낙관적 갱신
    for (const msg of messages.value) {
      if (updatedIds.includes(msg._id)) {
        const arr = msg.readBy || []
        if (!arr.includes(myId.value)) msg.readBy = [...arr, myId.value]
      }
    }
    // 소켓 브로드캐스트
    getSocket()?.emit('messagesRead', { roomId, readerId: myId.value, messageIds: updatedIds })
  } catch (err) {
    console.error('❌ markAsReadNow error:', err)
  }
}

/* ───────── 라이프사이클 ───────── */
onMounted(async () => {
  console.log('[ChatRoom] onMounted, roomId:', roomId)

  // ✅ 공용 소켓 연결 확보
  socket = connectSocket() // ★ 변경: 현재 오리진(HTTPS) 기반으로 1회 연결

  // 연결 상태 로그 (추적 강화)
  socket.on('connect', () => {
    console.log('[ChatRoom] socket connected:', socket.id)
  })
  socket.on('connect_error', (err) => {
    console.error('[ChatRoom] socket connect_error:', err?.message || err)
  })
  socket.on('disconnect', (reason) => {
    console.warn('[ChatRoom] socket disconnected:', reason)
  })

  await loadMessages()

  socket.emit('joinRoom', roomId)
  console.log('[ChatRoom] joinRoom emitted')

  // 새 메시지 수신
  socket.on('chatMessage', (msg) => {
    const message = msg?.message || msg
    const inSameRoom =
      msg?.roomId === roomId ||
      msg?.chatRoom === roomId ||
      msg?.chatRoom?._id === roomId ||
      message?.chatRoom === roomId ||
      message?.chatRoom?._id === roomId
    if (!inSameRoom) return

    messages.value.push(message)
    scrollToBottom()

    const mine = isMine(message)
    if (!mine) scheduleMarkAsRead(250)

    console.log('[ChatRoom] recv chatMessage:', {
      id: message?._id,
      type: message?.imageUrl ? 'image' : 'text',
      from: message?.sender?._id || message?.sender,
      mine, inSameRoom,
    })
  })

  // 읽음 브로드캐스트 수신
  socket.on('messagesRead', ({ roomId: rid, readerId, messageIds } = {}) => {
    try {
      if (String(rid) !== String(roomId)) return
      if (!readerId || !Array.isArray(messageIds) || !messageIds.length) return
      for (const msg of messages.value) {
        if (!isMine(msg)) continue
        if (!messageIds.includes(msg._id)) continue
        const arr = msg.readBy || []
        if (!arr.includes(readerId)) msg.readBy = [...arr, readerId]
      }
      console.log('[ChatRoom] recv messagesRead:', { readerId, count: messageIds.length })
    } catch (e) {
      console.warn('[ChatRoom] messagesRead handler error:', e)
    }
  })
})

watch(messages, () => {
  scrollToBottom()
  scheduleMarkAsRead(250)
}, { deep: true })

onBeforeUnmount(() => {
  try {
    // ✅ 방만 떠난다(소켓 연결 유지 → 다른 페이지에서도 재사용)
    getSocket()?.emit('leaveRoom', roomId)
    getSocket()?.off('chatMessage')
    getSocket()?.off('messagesRead')

    // ❌ 공용 연결 강제 종료는 지양 (페이지 전환시 재연결 지연/오류 방지)
    // getSocket()?.disconnect()

    console.log('[ChatRoom] onBeforeUnmount: leaveRoom/off done')
  } catch (e) {
    console.warn('[ChatRoom] onBeforeUnmount error:', e)
  }
})

// 네비게이션
const goBack = () => router.push('/home/4page')
const goToPartnerProfile = () => {
  if (partnerId.value) router.push(`/home/user/${partnerId.value}`)
}
</script>

<style scoped>
/* ─────────────────────────────────────────────────────────────
 * Black + Gold Theme (배경은 진짜 블랙, 내용은 가독성 유지)
 * - 페이지 배경: 블랙
 * - 말풍선/입력창: 밝은 바탕 + 검정 글씨
 * - 크기 전반 "컴팩트" (이전보다 커지지 않도록 고정)
 * ───────────────────────────────────────────────────────────── */

.chatroom-container{
  display:flex; flex-direction:column; height:100%; min-height:0; width:100%;

  /* === 테마 컬러 === */
  --gold-500:#d4af37;
  --gold-400:#e0be53;
  --black-900:#0b0b0b;

  /* 본문 가독성(검정 텍스트 유지) */
  --color-text:#000;
  --color-muted:#9aa0a6;

  /* 페이지/섹션 배경은 블랙 */
  --page-bg:#0b0b0b;
  --section-bg:#0b0b0b;

  /* 말풍선(밝은 바탕) */
  --bubble-other:#f1f3f4; /* 밝은 회색 */
  --bubble-me:#ffefb3;     /* 연한 골드 */

  /* 크기/간격 (컴팩트) */
  --radius:10px; --radius-lg:14px;
  --gap-xxs:4px; --gap-xs:6px; --gap-sm:8px; --gap-md:10px;

  /* 폰트 크기 (작게 고정) */
  --fz-base:13px;          /* 본문 */
  --fz-time:11px;          /* 시각 */
  --fz-title:14px;         /* 헤더 타이틀 */

  background:var(--page-bg);
  color:var(--color-text);
  overscroll-behavior:contain;
}

/* ── 상단바 (블랙 + 골드) ─────────── */
.chatroom-header{
  display:grid; grid-template-columns:auto 1fr; align-items:center; gap:var(--gap-sm);
  height:44px; padding:0 var(--gap-md);
  background:#0b0b0b; border-bottom:1px solid rgba(255,255,255,.06);
  box-sizing:border-box;
}
.chatroom-header ion-button{
  --padding-start:6px; --padding-end:6px; --border-radius:8px;
  --color:var(--gold-500);
  --background:transparent; --border-color:transparent;
  min-height:30px; font-size:13px;
}
.chat-title{
  font-weight:800; letter-spacing:.2px; color:var(--gold-500);
  font-size:var(--fz-title); line-height:1.15; justify-self:start;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  overflow:hidden; text-overflow:ellipsis; white-space:normal; cursor:pointer;
}

/* ── 메시지 리스트 (섹션 배경도 블랙) ─────────── */
.chat-messages{
  flex:1 1 0; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding:var(--gap-md); background:var(--section-bg);
  scrollbar-gutter:stable;
}
.chat-messages::-webkit-scrollbar{ width:6px; height:6px; }
.chat-messages::-webkit-scrollbar-thumb{ background:#333; border-radius:8px; }
.chat-messages::-webkit-scrollbar-track{ background:transparent; }

.message-row{ margin-bottom:var(--gap-xs); }
.other-message,.my-message{ display:flex; align-items:flex-end; gap:var(--gap-xxs); }
.other-message{ justify-content:flex-start; }
.my-message{ justify-content:flex-end; }

/* ── 말풍선 (밝은 바탕 + 검정 텍스트 / 크기 컴팩트) ─────────── */
.bubble{
  max-width:min(72%,560px);
  padding:6px 10px;
  border-radius:var(--radius);
  background-color:#fff;
  color:var(--color-text);
  word-break:break-word; white-space:pre-wrap;
  font-size:var(--fz-base); line-height:1.4;
  box-shadow:0 1px 0 rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.06);
}
.other-bubble{ background:var(--bubble-other); }
.my-bubble{ background:var(--bubble-me); border-color:#f6e6ad; }

/* 이미지 메시지 — ⬇️ 작게 고정 */
.chat-image{
  max-width:150px; max-height:150px;
  border-radius:10px; cursor:pointer; display:block;
  box-shadow:0 1px 0 rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.06);
}

/* 시간/읽음표시 — 작게 */
.time{ font-size:var(--fz-time); color:var(--color-muted); white-space:nowrap; margin:0 3px; user-select:none; }
.read-flag{
  font-size:var(--fz-time); color:#1f1f1f; background:#fff3f3; border:1px solid #ffc9c9;
  border-radius:999px; padding:2px 6px; margin-left:4px; line-height:1.3; user-select:none;
}

/* ── 입력 영역 (바탕 블랙, 컨트롤은 밝게) ─────────── */
.chat-input-wrapper{
  position:relative; background:var(--page-bg);
  padding-bottom:env(safe-area-inset-bottom,0px);
  border-top:1px solid rgba(255,255,255,.06);
}
.chat-input{
  display:grid; grid-template-columns:auto auto 1fr auto; /* 📎 | 😊 | 입력 | 전송 */
  align-items:end; gap:var(--gap-sm);
  padding:var(--gap-sm) var(--gap-md);
  background:var(--page-bg);
  box-sizing:border-box;
}

/* ▶ 아이콘 전용 작은 버튼 (가로폭 축소) */
.chat-input ion-button.icon-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  width: 34px;
  min-width: 34px;
  font-size: 16px;
  --border-color: var(--gold-500);
  --background: transparent;
  --background-hover: #1a1a1a;
}

/* 아이콘 중앙 정렬 보정 */
.chat-input ion-button.icon-btn ::slotted(*) {
  margin: 0 auto;
}

/* 버튼: 골드 악센트 (크기 작게) */
.chat-input ion-button[fill="outline"]{
  --border-color:var(--gold-500); --color:#fff;
  --background:transparent; --background-hover:#1a1a1a;
  --border-radius: 9px;
  min-height:26px; font-size:13px;
  border:1px solid var(--gold-500);
}
.chat-input ion-button[color="primary"]{
  --background:var(--gold-500); --color:#111; --border-radius:10px;
  min-height:26px; font-size:13px;
}

/* textarea — 밝은 바탕 + 검정 글씨 (가독성 유지) */
.chat-input textarea{
  flex:1 1 auto; padding:6px 8px;
  border:1.5px solid #333; border-radius:9px; margin:0;
  font-size:var(--fz-base); background:#ffffff; color:#000000;
  resize:none; line-height:1.4; min-height:32px; max-height:110px;
  box-shadow:0 0 0 2px rgba(212,175,55,0.08);
}
.chat-input textarea::placeholder{ color:#7a7a7a; }
.chat-input textarea:focus{
  outline:none; box-shadow:0 0 0 2px rgba(212,175,55,0.35); border-color:var(--gold-500);
}

/* 이모지 피커 (경계만 골드) */
.emoji-picker-wrapper{
  position:absolute; left:var(--gap-md);
  bottom:calc(46px + env(safe-area-inset-bottom,0px));
  z-index:999; background:#111; border:1px solid var(--gold-500);
  border-radius:var(--radius-lg); overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,.5);
}
emoji-picker{ width:260px; max-height:360px; }

/* 이미지 모달 */
.image-modal{
  position:fixed; inset:0; background:rgba(0,0,0,.85);
  display:flex; align-items:center; justify-content:center; z-index:9999; padding:12px;
}
.image-wrapper{ position:relative; max-width:92vw; max-height:92vh; }
.modal-image{ max-width:100%; max-height:100%; border-radius:var(--radius-lg); box-shadow:0 10px 24px rgba(0,0,0,.28); }
.close-button{
  position:absolute; top:-9px; right:-9px; background:var(--gold-500); color:#111;
  border:none; border-radius:50%; width:30px; height:30px; line-height:26px; font-size:18px; font-weight:900; cursor:pointer;
  box-shadow:0 2px 8px rgba(0,0,0,.25);
}

/* 페이드 */
.fade-enter-active,.fade-leave-active{ transition:opacity .2s ease; }
.fade-enter-from,.fade-leave-to{ opacity:0; }

/* 초소형 화면 보정 */
@media (max-width:360px){
  .chatroom-header{ padding:0 8px; gap:var(--gap-xxs); }
  .chat-messages{ padding:8px; }
  .emoji-picker-wrapper{ left:6px; }
}
</style>
