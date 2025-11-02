<!-- src/components/views_layout/TopPoint.vue -->
<template>
  <!-- 상단 공백 + 포인트 표시 (클릭/키보드 진입 가능) -->
  <div
    class="space"
    :style="{ height }"
    role="button"
    tabindex="0"
    @click="goToPage"
    @keydown.enter.prevent="goToPage"
    @keydown.space.prevent="goToPage"
    aria-label="내 포인트 상세로 이동"
  >
    <div>
      ❤️ {{ heart }}　
      ⭐ {{ star }}　
      💎 {{ ruby }}
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { getSocket } from '@/lib/socket'

const props = defineProps({
  height: { type: String, default: '80px' },
  /** 클릭 시 이동할 경로 (원하시는 경로로 교체해서 사용하세요) */
  to: { type: String, default: '/home/setting/0002' }
})

const router = useRouter()
const goToPage = () => {
  router.push(props.to)
}

const store = useUserStore()

/**
 * computed에서 fallback 객체를 만들지 않고
 * store.user.wallet만 바라봅니다.
 */
const wallet = computed(() => store.user?.wallet)
const heart  = computed(() => Number(wallet.value?.heart ?? 0))
const star   = computed(() => Number(wallet.value?.star  ?? 0))
const ruby   = computed(() => Number(wallet.value?.ruby  ?? 0))

// ---- 실시간 반영: 소켓 + API 인터셉터 커스텀 이벤트 ----
let socket
const onApiWallet = (e) => {
  try {
    const w = (e)?.detail
    if (w && typeof w === 'object') {
      store.updateWallet(w) // 반응형 객체로 교체
    }
  } catch {}
}

function bindSocketListeners() {
  if (!socket) return
  // 서버가 지갑만 내려주는 경우
  socket.on('wallet:update', (data) => {
    if (!data) return
    if (data.wallet && typeof data.wallet === 'object') {
      store.updateWallet(data.wallet)
    } else {
      const partial = {}
      if (typeof data.heart === 'number') partial.heart = data.heart
      if (typeof data.star  === 'number') partial.star  = data.star
      if (typeof data.ruby  === 'number') partial.ruby  = data.ruby
      if (Object.keys(partial).length) store.updateWallet(partial)
    }
  })

  // 서버가 전체 me 업데이트를 내려주는 경우
  socket.on('me:update', (payload) => {
    const u = payload?.user
    if (u?.wallet) store.updateWallet(u.wallet)
  })
}

function unbindSocketListeners() {
  if (!socket) return
  socket.off('wallet:update')
  socket.off('me:update')
}

onMounted(async () => {
  // 초기 유저 정보 없으면 1회 동기화
  if (!store.user) {
    await store.fetchMe()
  }

  // API 인터셉터 전역 이벤트 수신(소켓 없어도 즉시 반영)
  window.addEventListener('api:wallet', onApiWallet)

  // 소켓 연결되어 있으면 즉시 바인딩, 아니면 연결 후 1회 바인딩
  socket = getSocket()
  if (socket) {
    if (socket.connected) {
      bindSocketListeners()
    } else {
      socket.once('connect', bindSocketListeners)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('api:wallet', onApiWallet)
  unbindSocketListeners()
})
</script>

<style scoped>
.space {
  width: 100%;
  background: #000000;

  /* 클릭 가능 */
  cursor: pointer;

  display: flex;
  justify-content: flex-end;
  align-items: center;

  color: white;
  font-size: 14px;
  padding: 1px 30px 10px 10px;
  font-family: 'Pretendard', sans-serif;

  /* 터치 하이라이트 완화 */
  -webkit-tap-highlight-color: rgba(255,255,255,0.1);
}
</style>
