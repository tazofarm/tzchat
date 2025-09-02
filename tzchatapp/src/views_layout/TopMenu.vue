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
      <!-- 아이콘 + 배지 -->
      <span class="icon-wrap" aria-hidden="true">
        <IonIcon :icon="item.icon" class="menu-icon" />
        <!-- ✅ 친구 탭 ⓝ -->
        <span
          v-if="item.path === FRIENDS_PATH && badgeFriends"
          class="icon-badge"
          aria-label="새 친구 항목 있음"
        >ⓝ</span>

        <!-- ✅ 채팅 탭 ⓝ -->
        <span
          v-if="item.path === CHAT_PATH && badgeChat"
          class="icon-badge"
          aria-label="안읽은 채팅 있음"
        >ⓝ</span>
      </span>

      <!-- 텍스트 -->
      <span class="menu-text">{{ item.name }}</span>
    </div>
  </div>
</template>

<script setup>
// ------------------------------------------------------
// TopMenu.vue
// - 친구 탭: 기존 ⓝ 유지 (window + socket)
// - 채팅 탭: 총 미읽음(/api/chatrooms/unread-total) + socket('chatrooms:badge') 로 ⓝ 표시
// - 구조 최대 유지, 주석/로그 풍부
// ------------------------------------------------------
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonIcon } from '@ionic/vue'
import axios from '@/lib/axiosInstance'
import { io } from 'socket.io-client'
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
//  { name: '테스트',   path: '/home/5page', icon: warningOutline },
  { name: 'Premium',   path: '/home/0page', icon: warningOutline },
  { name: '타겟',   path: '/home/2page', icon: locateOutline },
  { name: '친구',   path: FRIENDS_PATH,  icon: peopleOutline },
  { name: '채팅',   path: CHAT_PATH,     icon: chatbubblesOutline },
  { name: '프로필', path: '/home/6page', icon: personCircleOutline },
  { name: '설정',   path: '/home/7page', icon: settingsOutline },
]

const goTo = (path) => router.push(path)
const isActive = (path) => (route.path === path ? 'active' : '')

/* ====== 상태 ====== */
const badgeFriends = ref(false)  // 기존 친구 배지
const badgeChat    = ref(false)  // ✅ 채팅 배지(총 미읽음 > 0)
const myId         = ref(null)
let socket

/* ====== 친구 탭: window 이벤트 연동 (기존) ====== */
const onFriendsState = (e) => {
  const hasNew = !!e?.detail?.hasNew
  badgeFriends.value = hasNew
}

/* ====== 채팅 탭: 총 미읽음 조회 ====== */
const refreshChatBadge = async (label = 'init') => {
  try {
    const res = await axios.get('/api/chatrooms/unread-total', { withCredentials: true })
    const total = Number(res?.data?.total || 0)
    badgeChat.value = total > 0
    console.log(`[TopMenu] refreshChatBadge(${label}) → total=`, total)
  } catch (e) {
    console.warn('[TopMenu] refreshChatBadge 실패:', e)
  }
}

/* ====== 소켓 연동 ====== */
function bindSocket() {
  if (socket) return
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
  socket = io(url, {
    withCredentials: true,
    transports: ['websocket'],
    autoConnect: true,
  })

  socket.on('connect', async () => {
    console.log('[TopMenu] socket connected:', socket.id)
    if (myId.value) socket.emit('join', { userId: myId.value })
    await refreshChatBadge('socket-connect')
  })

  // 친구 요청 생성 시 → 배지 ON
  socket.on('friendRequest:created', (req) => {
    const me = myId.value
    if (!me) return
    const fromId = req?.from?._id
    const toId   = req?.to?._id
    if (fromId === me || toId === me) {
      badgeFriends.value = true
    }
  })

  // ✅ 채팅 관련 배지 갱신 신호
  socket.on('chatrooms:badge', async (payload) => {
    console.log('[TopMenu] socket chatrooms:badge:', payload)
    await refreshChatBadge('socket-badge')
  })

  // (호환) 직접 chatMessage를 받는 경우에도 갱신
  socket.on('chatMessage', async () => {
    console.log('[TopMenu] socket chatMessage(compat): refresh')
    await refreshChatBadge('socket-chatMessage')
  })
}

/* ====== 라우트 변화에 반응 ====== */
watch(() => route.path, async (p) => {
  if (p === CHAT_PATH) {
    // 채팅 페이지 들어갈 때 한 번 갱신 (채팅방에서 읽음 처리 후 반영)
    setTimeout(() => refreshChatBadge('route-enter-chat'), 250)
  }
})

/* ====== 마운트 ====== */
onMounted(async () => {
  try {
    const me = await axios.get('/api/me', { withCredentials: true })
    myId.value = me.data?.user?._id || null
  } catch (e) {
    console.warn('[TopMenu] /api/me 실패', e)
  }

  bindSocket()

  window.addEventListener('friends:state', onFriendsState)

  // 3_list가 떠 있다면 현재 ⓝ 상태 요청 → 즉시 동기화(친구 탭)
  try {
    window.dispatchEvent(new CustomEvent('friends:requestState'))
  } catch {}

  // ✅ 채팅 탭: 최초 합계 조회
  await refreshChatBadge('mounted')
})

onUnmounted(() => {
  window.removeEventListener('friends:state', onFriendsState)
  // TopMenu가 앱 전체에서 유지된다면 socket 해제는 생략 가능
})
</script>

<style scoped>
/* ===========================================================
   TopMenu - GOLD THEME 대응
   - 라이트 하드코딩 제거 (#fff/#000/#007bff)
   - 테마 토큰 사용: --bg / --panel-border / --text / --text-dim / --gold / --danger
   =========================================================== */
.top-menu {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  background: var(--bg);                    /* ✅ 다크 배경 */
  border-bottom: 1px solid var(--panel-border);
  padding: 6px 0;
  text-align: center;
  color: var(--text);                       /* 기본 텍스트 */
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
  color: var(--text-dim);                   /* ✅ 비활성 톤다운 */
  user-select: none;
  -webkit-tap-highlight-color: rgba(255,213,79,.08); /* 골드 느낌의 탭 하이라이트 */
  transition: color .2s, transform .12s;
}
.menu-item:active { transform: scale(0.96); }

/* 아이콘 래퍼 + 배지 */
.icon-wrap {
  position: relative;
  display: inline-block;
  line-height: 1;
}
.menu-icon {
  display: block;
  font-size: 22px;
  line-height: 1;
  margin-bottom: 4px;
}

/* ⓝ 배지(아이콘 우상단) */
.icon-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  font-weight: 800;
  font-size: 0.85rem;
  color: var(--danger);                     /* ✅ 경고색 변수 사용 */
  pointer-events: none;
}

.menu-text {
  font-size: 11px;
  line-height: 1;
  letter-spacing: .1px;
  color: var(--text-dim);                   /* ✅ 비활성 텍스트 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 활성 상태: 텍스트/아이콘/밑줄 골드 */
.menu-item.active,
.menu-item.active .menu-icon,
.menu-item.active .menu-text {
  color: var(--gold);
  font-weight: 600;
}

/* 활성 밑줄도 골드 */
.menu-item.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 30%;
  width: 40%;
  height: 2px;
  background: var(--gold);
  border-radius: 2px;
}

/* 포커스 접근성: 골드 링 */
.menu-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255,213,79,0.25);
  border-radius: 10px;
}

@media (max-width: 360px) {
  .menu-item { min-height: 54px; padding: 4px 0; }
  .menu-icon { font-size: 20px; margin-bottom: 3px; }
  .menu-text { font-size: 10px; }
  .icon-badge { top: -5px; right: -7px; font-size: 0.8rem; }
}
</style>
