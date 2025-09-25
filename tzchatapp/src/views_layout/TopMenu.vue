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
        <span
          v-if="item.path === FRIENDS_PATH && badgeFriends"
          class="icon-badge"
          aria-label="새 친구 항목 있음"
        >ⓝ</span>
        <span
          v-if="item.path === CHAT_PATH && badgeChat"
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
 * TopMenu.vue (fixed + de-dup listeners)
 * - 공용 소켓 모듈 사용(connectSocket/getSocket)
 * - 공용 api 인스턴스 사용('/me', '/chatrooms/unread-total')
 * - 소켓 이벤트 중복 바인딩 방지: off → on 패턴
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
} from 'ionicons/icons'

const route = useRoute()
const router = useRouter()

const FRIENDS_PATH = '/home/3page'
const CHAT_PATH    = '/home/4page'

const menuItems = [
{ name: 't-emer', path: '/home/91page', icon: warningOutline },
{ name: 't-tar', path: '/home/92page', icon: warningOutline },
{ name: 't-all', path: '/home/93page', icon: warningOutline },



  //{ name: 'all', path: '/home/5page', icon: warningOutline },
  { name: 'Premium', path: '/home/0page', icon: warningOutline },
  { name: '타겟',    path: '/home/2page', icon: locateOutline },
  //{ name: '친구',    path: FRIENDS_PATH,  icon: peopleOutline },
  { name: '채팅',    path: CHAT_PATH,     icon: chatbubblesOutline },
  { name: '프로필',  path: '/home/6page', icon: personCircleOutline },
  { name: '설정',    path: '/home/7page', icon: settingsOutline },
]

const goTo = (path) => router.push(path)
const isActive = (path) => (route.path === path ? 'active' : '')

/* ===== 상태 ===== */
const badgeFriends = ref(false)
const badgeChat    = ref(false)
const myId         = ref(null)
let socket = null

/* ===== 친구 탭: window 이벤트 연동(기존) ===== */
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

/* ===== 소켓 핸들러 (중복 방지용 참조) ===== */
const hConnect = async () => {
  console.log('[TopMenu] socket connected:', socket.id)
  if (myId.value) socket.emit('join', { userId: myId.value })
  await refreshChatBadge('socket-connect')
}
const hFriendReq = (req) => {
  const me = myId.value
  if (!me) return
  const fromId = req?.from?._id
  const toId   = req?.to?._id
  if (fromId === me || toId === me) badgeFriends.value = true
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

/* ===== 소켓 바인딩 (off → on 보장) ===== */
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

/* ===== 라우트 변화에 반응 ===== */
watch(() => route.path, (p) => {
  if (p === CHAT_PATH) {
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

  window.addEventListener('friends:state', onFriendsState)

  // 친구 탭 즉시 동기화(기존 로직 유지)
  try { window.dispatchEvent(new CustomEvent('friends:requestState')) } catch {}

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
