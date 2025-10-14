<template>
  <div class="top-menu" role="tablist">
    <div
      v-for="item in menuItems"
      :key="item.name"
      :class="['menu-item', isActive(item.path)]"
      role="tab"
      :aria-current="isActive(item.path) ? 'page' : null"
      @click="goTo(item.path)"
    >
      <span class="icon-wrap" aria-hidden="true">
        <IonIcon :icon="item.icon" class="menu-icon" />

        <!-- ✅ 친구/채팅 뱃지 조건 (경로 직접 비교) -->
        <span
          v-if="item.path === '/home/3page' && badgeFriends"
          class="icon-badge"
          aria-label="새 친구 항목 있음"
        >ⓝ</span>

        <span
          v-if="item.path === '/home/4page' && badgeChat"
          class="icon-badge"
          aria-label="안읽은 채팅 있음"
        >ⓝ</span>
      </span>

      <span class="menu-text">{{ item.name }}</span>
    </div>
  </div>
</template>

<script setup>
/**
 * TopMenu.vue
 * - List(사람 아이콘)의 ⓝ 배지는 "받은 친구 신청" 신규 발생시에만 표시
 *   (friendRequest:created 이벤트에서 toId === 내 아이디 일 때만 ON)
 * - Chat ⓝ 배지는 /api/chatrooms/unread-total 로 계산
 * - friends:state 커스텀 이벤트를 수신하여 받은신청 상태와 동기화
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonIcon } from '@ionic/vue'
import api from '@/lib/api'
import { connectSocket, getSocket } from '@/lib/socket'
import {
  warningOutline,
  locateOutline,
  peopleOutline,
  chatbubblesOutline,
  personCircleOutline,
  settingsOutline,
  starOutline,
  trophyOutline,
  diamondOutline,
} from 'ionicons/icons'

const route = useRoute()
const router = useRouter()

const menuItems = [
  { name: 't-emer', path: '/home/91page', icon: diamondOutline },
  { name: 't-tar', path: '/home/92page', icon: locateOutline },
  { name: 't-all', path: '/home/93page', icon: warningOutline },
  { name: 'Premium', path: '/home/0page', icon: diamondOutline },
  { name: 'Search', path: '/home/2page', icon: locateOutline },
  { name: 'all', path: '/home/1page', icon: warningOutline },
  { name: 'List', path: '/home/3page', icon: peopleOutline },
  { name: 'Chat', path: '/home/4page', icon: chatbubblesOutline },
  { name: 'Profile', path: '/home/6page', icon: personCircleOutline },
  //{ name: '설정', path: '/home/7page', icon: settingsOutline },
]

const goTo = (path) => router.push(path)
const isActive = (path) => (route.path === path ? 'active' : '')

/* ===== 상태 ===== */
const badgeFriends = ref(false) // ✅ "받은" 친구 신청 전용 배지
const badgeChat = ref(false)
const myId = ref(null)
let socket = null

/* ===== 받은신청 상태: window 이벤트 연동 =====
   - detail.hasNew: boolean (새로운 '받은' 친구 신청 존재 여부)
*/
const onFriendsState = (e) => {
  const hasNew = !!e?.detail?.hasNew
  badgeFriends.value = hasNew
}

/* ===== 채팅 탭: 총 미읽음 조회 ===== */
const refreshChatBadge = async (label = 'init') => {
  try {
    const res = await api.get('/api/chatrooms/unread-total')
    const total = Number(res?.data?.total || 0)
    badgeChat.value = total > 0
    console.log(`[TopMenu] refreshChatBadge(${label}) → total=`, total)
  } catch (e) {
    console.warn('[TopMenu] refreshChatBadge 실패:', e)
  }
}

/* ===== 소켓 핸들러 ===== */
const hConnect = async () => {
  console.log('[TopMenu] socket connected:', socket.id)
  if (myId.value) socket.emit('join', { userId: myId.value })
  await refreshChatBadge('socket-connect')
}

/* ✅ 핵심 변경: "받은 친구 신청"일 때만 배지 ON */
const hFriendReq = (req) => {
  const me = myId.value
  if (!me) return
  const toId = req?.to?._id || req?.to
  if (toId === me) {
    badgeFriends.value = true
  }
}

const hRoomsBadge = async (payload) => {
  console.log('[TopMenu] socket chatrooms:badge:', payload)
  await refreshChatBadge('socket-badge')
}
const hRoomsUpdated = async (payload) => {
  console.log('[TopMenu] socket chatrooms:updated:', payload)
  await refreshChatBadge('socket-updated')
}
const hChatMsg = async () => {
  console.log('[TopMenu] socket chatMessage(compat): refresh')
  await refreshChatBadge('socket-chatMessage')
}

/* ===== 소켓 바인딩 ===== */
function bindSocket() {
  if (!socket) return
  socket.off('connect', hConnect)
  socket.off('friendRequest:created', hFriendReq)
  socket.off('chatrooms:badge', hRoomsBadge)
  socket.off('chatrooms:updated', hRoomsUpdated)
  socket.off('chatMessage', hChatMsg)

  socket.on('connect', hConnect)
  socket.on('friendRequest:created', hFriendReq) // ← 받은신청일 때만 배지 ON
  socket.on('chatrooms:badge', hRoomsBadge)
  socket.on('chatrooms:updated', hRoomsUpdated)
  socket.on('chatMessage', hChatMsg)
}

/* ===== 라우트 변화 반응 ===== */
watch(() => route.path, (p) => {
  if (p === '/home/4page') {
    setTimeout(() => refreshChatBadge('route-enter-chat'), 250)
  }
})

/* ===== 마운트 ===== */
onMounted(async () => {
  try {
    const me = await api.get('/api/me')
    myId.value = me.data?.user?._id || null
  } catch (e) {
    console.warn('[TopMenu] /me 실패', e)
  }

  socket = getSocket() || connectSocket()
  bindSocket()

  // Received 페이지가 방송하는 상태를 수신
  window.addEventListener('friends:state', onFriendsState)

  // 현재 상태 요청(Received 페이지가 friends:state로 응답)
  try {
    window.dispatchEvent(new CustomEvent('friends:requestState'))
  } catch {}

  await refreshChatBadge('mounted')
})

onUnmounted(() => {
  window.removeEventListener('friends:state', onFriendsState)

  if (socket) {
    socket.off('connect', hConnect)
    socket.off('friendRequest:created', hFriendReq)
    socket.off('chatrooms:badge', hRoomsBadge)
    socket.off('chatrooms:updated', hRoomsUpdated)
    socket.off('chatMessage', hChatMsg)
  }
  // 공용 소켓은 전역 재사용 → disconnect 하지 않음
})
</script>

<style scoped>
.top-menu {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  background: var(--bg);
  border-bottom: 1px solid var(--panel-border);
  padding: 6px 0;
  text-align: center;
  color: var(--text);
  overflow: visible;
}

.menu-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 58px;
  padding: 6px 0;
  cursor: pointer;
  color: var(--text-dim);
  user-select: none;
  -webkit-tap-highlight-color: rgba(255,213,79,.08);
  transition: color .2s, transform .12s;
}
.menu-item:active { transform: scale(0.96); }

.icon-wrap { position: relative; display: inline-block; line-height: 1; }
.menu-icon { display: block; font-size: 22px; line-height: 1; margin-bottom: 4px; }

.icon-badge {
  position: absolute; top: -4px; right: -8px;
  font-weight: 800; font-size: 0.85rem; color: var(--danger); pointer-events: none;
}

.menu-text {
  font-size: 11px; line-height: 1; letter-spacing: .1px; color: var(--text-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.menu-item.active,
.menu-item.active .menu-icon,
.menu-item.active .menu-text {
  color: var(--gold); font-weight: 600;
}

.menu-item.active::after {
  content: ""; position: absolute; bottom: 0; left: 30%; width: 40%; height: 2px;
  background: var(--gold); border-radius: 2px;
}

.menu-item:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,213,79,0.25); border-radius: 10px; }

@media (max-width: 360px) {
  .menu-item { min-height: 54px; padding: 4px 0; }
  .menu-icon { font-size: 20px; margin-bottom: 3px; }
  .menu-text { font-size: 10px; }
  .icon-badge { top: -5px; right: -7px; font-size: 0.8rem; }
}
</style>
