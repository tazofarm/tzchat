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
 * ✅ "홈 진입 체감 딜레이" 줄이기:
 * - onMounted에서 await 제거 (초기 렌더 블로킹 방지)
 * - /api/me는 캐시(localStorage) 우선 사용, 없을 때만 백그라운드 조회
 * - unread-total은 디바운스 + inFlight로 중복 호출 방지
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonIcon } from '@ionic/vue'
import api from '@/lib/api'
import { connectSocket, getSocket } from '@/lib/socket'
import {
  peopleOutline,
  chatbubblesOutline,
  personCircleOutline,
  diamondOutline,
} from 'ionicons/icons'

const route = useRoute()
const router = useRouter()

const menuItems = [
  { name: 'Search', path: '/home/targetpage', icon: diamondOutline },
  { name: 'List', path: '/home/3page', icon: peopleOutline },
  { name: 'Chat', path: '/home/4page', icon: chatbubblesOutline },
  { name: 'Profile', path: '/home/6page', icon: personCircleOutline },
]

const goTo = (path) => router.push(path)
const isActive = (path) => (route.path === path ? 'active' : '')

/* ===== 상태 ===== */
const badgeFriends = ref(false) // ✅ "받은" 친구 신청 전용 배지
const badgeChat = ref(false)
const myId = ref(null)
let socket = null

// ✅ 내 아이디 캐시 키 (TopMenu가 /me를 매번 치지 않도록)
const MYID_KEY = 'TZCHAT_MY_ID'

/* ===== 받은신청 상태: window 이벤트 연동 =====
   - detail.hasNew: boolean (새로운 '받은' 친구 신청 존재 여부)
*/
const onFriendsState = (e) => {
  const hasNew = !!e?.detail?.hasNew
  badgeFriends.value = hasNew
}

/* ===== 채팅 탭: 총 미읽음 조회 (디바운스 + 중복방지) ===== */
let unreadTimer = null
let unreadInFlight = false
let unreadQueued = false

const refreshChatBadgeNow = async (label = 'init') => {
  if (unreadInFlight) {
    unreadQueued = true
    return
  }
  unreadInFlight = true
  unreadQueued = false

  try {
    const res = await api.get('/api/chatrooms/unread-total')
    const total = Number(res?.data?.total || 0)
    badgeChat.value = total > 0
    console.log(`[TopMenu] refreshChatBadge(${label}) → total=`, total)
  } catch (e) {
    console.warn('[TopMenu] refreshChatBadge 실패:', e)
  } finally {
    unreadInFlight = false
    if (unreadQueued) {
      // 큐가 있으면 한번 더
      unreadQueued = false
      refreshChatBadgeNow('queued')
    }
  }
}

const refreshChatBadge = (label = 'init', delayMs = 150) => {
  if (unreadTimer) clearTimeout(unreadTimer)
  unreadTimer = setTimeout(() => {
    unreadTimer = null
    refreshChatBadgeNow(label)
  }, delayMs)
}

/* ===== 소켓 핸들러 ===== */
const hConnect = () => {
  console.log('[TopMenu] socket connected:', socket?.id)
  if (myId.value) socket.emit('join', { userId: myId.value })
  // ✅ 기다리지 말고 백그라운드로 갱신
  refreshChatBadge('socket-connect', 0)
}

/* ✅ 핵심: "받은 친구 신청"일 때만 배지 ON */
const hFriendReq = (req) => {
  const me = myId.value
  if (!me) return
  const toId = req?.to?._id || req?.to
  if (toId === me) {
    badgeFriends.value = true
  }
}

const hRoomsBadge = (payload) => {
  console.log('[TopMenu] socket chatrooms:badge:', payload)
  refreshChatBadge('socket-badge', 0)
}
const hRoomsUpdated = (payload) => {
  console.log('[TopMenu] socket chatrooms:updated:', payload)
  refreshChatBadge('socket-updated', 0)
}
const hChatMsg = () => {
  console.log('[TopMenu] socket chatMessage(compat): refresh')
  refreshChatBadge('socket-chatMessage', 0)
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
  socket.on('friendRequest:created', hFriendReq)
  socket.on('chatrooms:badge', hRoomsBadge)
  socket.on('chatrooms:updated', hRoomsUpdated)
  socket.on('chatMessage', hChatMsg)
}

/* ===== 라우트 변화 반응 ===== */
watch(() => route.path, (p) => {
  if (p === '/home/4page') {
    // 채팅탭 진입 시 즉시 갱신 (디바운스 안에서 처리)
    refreshChatBadge('route-enter-chat', 100)
  }
})

/* ===== 내 아이디 빠른 로드 (캐시 우선) ===== */
function loadMyIdFromCache() {
  try {
    const v = localStorage.getItem(MYID_KEY)
    if (v && v.trim()) return v.trim()
  } catch {}
  return null
}

/* ===== /api/me 는 필요할 때만 "백그라운드"로 ===== */
async function fetchMyIdInBackground() {
  try {
    const me = await api.get('/api/me')
    const id = me.data?.user?._id || null
    if (id) {
      myId.value = id
      try { localStorage.setItem(MYID_KEY, String(id)) } catch {}

      // 소켓이 이미 연결돼 있으면 join 한번 더
      if (socket && socket.connected) {
        socket.emit('join', { userId: myId.value })
      }
    }
  } catch (e) {
    console.warn('[TopMenu] /me 실패', e)
  }
}

/* ===== 마운트 ===== */
onMounted(() => {
  // 1) 친구 Received 페이지 이벤트 수신
  window.addEventListener('friends:state', onFriendsState)

  // 2) 현재 상태 요청(Received 페이지가 friends:state로 응답)
  try {
    window.dispatchEvent(new CustomEvent('friends:requestState'))
  } catch {}

  // 3) 내 ID는 캐시 우선
  const cachedId = loadMyIdFromCache()
  if (cachedId) myId.value = cachedId
  else fetchMyIdInBackground() // ✅ await 금지

  // 4) 소켓 연결/바인딩
  socket = getSocket() || connectSocket()
  bindSocket()

  // 5) unread 갱신도 "백그라운드" (await 금지)
  refreshChatBadge('mounted', 0)
})

onUnmounted(() => {
  window.removeEventListener('friends:state', onFriendsState)

  if (unreadTimer) {
    clearTimeout(unreadTimer)
    unreadTimer = null
  }

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
  padding: 1px 0;
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
