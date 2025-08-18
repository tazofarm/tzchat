<template>
  <!-- 페이지 전체 스크롤 / 섹션 내부 스크롤 없음 -->
  <div class="lists-wrapper" role="region" aria-label="친구 신청 및 리스트">
    <!-- 📤 보낸 친구 신청 -->
    <div class="list-section">
      <div
        class="section-header toggleable"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsedSent"
        @click="toggleSent()"
        @keydown="toggleOnKeydown($event, toggleSent)"
      >
        <ion-icon
          :icon="icons.chevronForwardOutline"
          v-if="collapsedSent"
          class="section-toggle-icon"
          aria-hidden="true"
        />
        <ion-icon
          :icon="icons.chevronDownOutline"
          v-else
          class="section-toggle-icon"
          aria-hidden="true"
        />
        <h3 class="section-title">
          <ion-icon :icon="icons.sendOutline" class="section-icon" aria-hidden="true" />
          보낸 친구 신청
          <span class="count">({{ sentRequests.length }})</span>
          <span v-if="anyNewSent && sentRequests.length" class="badge-new" aria-label="새 항목 있음">ⓝ</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedSent">
        <ul v-if="sentRequests.length">
          <li v-for="r in sentRequests" :key="r._id" class="row">
            <div class="user-row">
              <ion-icon :icon="icons.paperPlaneOutline" class="row-icon" aria-hidden="true" />
              <div class="user-info" @click="handleClickAndClearNew('sent', r)">
                <div class="user-name">
                  {{ r.to.nickname }}
                  <span v-if="r._isNew" class="badge-new" aria-label="신규">ⓝ</span>
                </div>
                <div class="user-meta">
                  출생년도: {{ r.to.birthyear }} / 성별: {{ r.to.gender === 'man' ? '남자' : '여자' }}
                </div>
              </div>
              <!-- ⛏ 버튼은 그대로 두되, CSS에서 블랙+골드 테마로 오버라이드 -->
              <ion-button size="small" color="medium" class="btn-gold-outline" @click="cancelRequest(r._id)">
                취소하기
              </ion-button>
            </div>
          </li>
        </ul>
        <p v-else class="empty">보낸 친구 신청이 없습니다.</p>
      </div>
    </div>

    <!-- 📥 받은 친구 신청 -->
    <div class="list-section">
      <div
        class="section-header toggleable"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsedReceived"
        @click="toggleReceived()"
        @keydown="toggleOnKeydown($event, toggleReceived)"
      >
        <ion-icon
          :icon="icons.chevronForwardOutline"
          v-if="collapsedReceived"
          class="section-toggle-icon"
          aria-hidden="true"
        />
        <ion-icon
          :icon="icons.chevronDownOutline"
          v-else
          class="section-toggle-icon"
          aria-hidden="true"
        />
        <h3 class="section-title">
          <ion-icon :icon="icons.mailOpenOutline" class="section-icon" aria-hidden="true" />
          받은 친구 신청
          <span class="count">({{ receivedRequests.length }})</span>
          <span v-if="anyNewReceived && receivedRequests.length" class="badge-new" aria-label="새 항목 있음">ⓝ</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedReceived">
        <ul v-if="receivedRequests.length">
          <li v-for="r in receivedRequests" :key="r._id" class="row">
            <div class="user-row">
              <ion-icon :icon="icons.mailOutline" class="row-icon" aria-hidden="true" />
              <div class="user-info" @click="handleClickAndClearNew('received', r)">
                <div class="user-name">
                  {{ r.from.nickname }}
                  <span v-if="r._isNew" class="badge-new" aria-label="신규">ⓝ</span>
                </div>
                <div class="user-meta">
                  출생년도: {{ r.from.birthyear }} / 성별: {{ r.from.gender === 'man' ? '남자' : '여자' }}
                </div>
              </div>
              <ion-button size="small" color="primary" class="btn-gold-solid" @click="openMessageModal(r)">
                인사말보기
              </ion-button>
            </div>
          </li>
        </ul>
        <p v-else class="empty">받은 친구 신청이 없습니다.</p>
      </div>
    </div>

    <!-- 👫 친구 리스트 -->
    <div class="list-section">
      <div
        class="section-header toggleable"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsedFriends"
        @click="toggleFriends()"
        @keydown="toggleOnKeydown($event, toggleFriends)"
      >
        <ion-icon
          :icon="icons.chevronForwardOutline"
          v-if="collapsedFriends"
          class="section-toggle-icon"
          aria-hidden="true"
        />
        <ion-icon
          :icon="icons.chevronDownOutline"
          v-else
          class="section-toggle-icon"
          aria-hidden="true"
        />
        <h3 class="section-title">
          <ion-icon :icon="icons.peopleOutline" class="section-icon" aria-hidden="true" />
          친구 리스트 <span class="count">({{ friends.length }})</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedFriends">
        <ul v-if="friends.length">
          <li v-for="f in friends" :key="f._id" class="row" @click="handleClick(f)">
            <div class="user-row">
              <ion-icon :icon="icons.personCircleOutline" class="row-icon" aria-hidden="true" />
              <div class="user-info">
                <div class="user-name">{{ f.nickname }}</div>
                <div class="user-meta">
                  출생년도: {{ f.birthyear }} / 성별: {{ f.gender === 'man' ? '남자' : '여자' }}
                </div>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="empty">아직 친구가 없습니다.</p>
      </div>
    </div>

    <!-- 🚫 차단한 친구 -->
    <div class="list-section">
      <div
        class="section-header toggleable"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsedBlocks"
        @click="toggleBlocks()"
        @keydown="toggleOnKeydown($event, toggleBlocks)"
      >
        <ion-icon
          :icon="icons.chevronForwardOutline"
          v-if="collapsedBlocks"
          class="section-toggle-icon danger"
          aria-hidden="true"
        />
        <ion-icon
          :icon="icons.chevronDownOutline"
          v-else
          class="section-toggle-icon danger"
          aria-hidden="true"
        />
        <h3 class="section-title">
          <ion-icon :icon="icons.closeCircleOutline" class="section-icon danger" aria-hidden="true" />
          차단한 친구 <span class="count">({{ blocks.length }})</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedBlocks">
        <ul v-if="blocks.length">
          <li v-for="b in blocks" :key="b._id" class="row" @click="handleClick(b)">
            <div class="user-row">
              <ion-icon :icon="icons.removeCircleOutline" class="row-icon danger" aria-hidden="true" />
              <div class="user-info">
                <div class="user-name">{{ b.username }} ({{ b.nickname }})</div>
                <div class="user-meta">
                  출생년도: {{ b.birthyear }} / 성별: {{ b.gender === 'man' ? '남자' : '여자' }}
                </div>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="empty">차단한 친구가 없습니다.</p>
      </div>
    </div>
  </div>

  <!-- 🔹 인사말 모달 -->
  <ModalFriendMessage
    v-if="selectedRequest"
    :request="selectedRequest"
    @close="selectedRequest = null"
    @accepted="acceptRequest"
    @rejected="rejectRequest"
    @blocked="blockRequest"
  />
</template>

<script setup>
// -------------------------------------------------------
// 블랙+골드 테마 반영 (UI만 변경, 로직/데이터 흐름은 기존 유지)
// - 주석/로그 대폭 추가
// -------------------------------------------------------
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton, IonIcon } from '@ionic/vue'
import { useRouter } from 'vue-router'
import ModalFriendMessage from '@/components/04310_Page3_list/Modal_FriendMessage.vue'
import { io } from 'socket.io-client'

import {
  sendOutline, paperPlaneOutline, mailOpenOutline, mailOutline,
  peopleOutline, personCircleOutline, closeCircleOutline, removeCircleOutline,
  chevronDownOutline, chevronForwardOutline
} from 'ionicons/icons'

const icons = {
  sendOutline, paperPlaneOutline, mailOpenOutline, mailOutline,
  peopleOutline, personCircleOutline, closeCircleOutline, removeCircleOutline,
  chevronDownOutline, chevronForwardOutline
}

const router = useRouter()
let socket // Socket.IO 인스턴스

/* ===== 상태 ===== */
const myId = ref(null)
const nickname = ref('')

const sentRequests = ref([])        // [{ _id, to: {...}, _isNew }]
const receivedRequests = ref([])    // [{ _id, from: {...}, _isNew }]
const friends = ref([])
const blocks = ref([])
const selectedRequest = ref(null)

/* 접기/펼치기(표시만) */
const collapsedSent = ref(false)
const collapsedReceived = ref(false)
const collapsedFriends = ref(true)
const collapsedBlocks = ref(true)

/* 제목 ⓝ */
const anyNewSent = computed(() => sentRequests.value.some(i => i._isNew))
const anyNewReceived = computed(() => receivedRequests.value.some(i => i._isNew))
const hasAnyNew = () => anyNewSent.value || anyNewReceived.value

/* ===== TopMenu 동기화 브로드캐스트 ===== */
function broadcastFriendsState () {
  try {
    const payload = { hasNew: hasAnyNew() }
    console.log('[FriendsList] broadcastFriendsState →', payload)
    window.dispatchEvent(new CustomEvent('friends:state', { detail: payload }))
  } catch (err) {
    console.warn('[FriendsList] broadcastFriendsState 실패:', err)
  }
}
// TopMenu가 현재 상태를 요청할 때 응답
const onRequestState = () => broadcastFriendsState()

/* 토글 공통 */
const toggleSent = () => { collapsedSent.value = !collapsedSent.value }
const toggleReceived = () => { collapsedReceived.value = !collapsedReceived.value }
const toggleFriends = () => { collapsedFriends.value = !collapsedFriends.value }
const toggleBlocks = () => { collapsedBlocks.value = !collapsedBlocks.value }
const toggleOnKeydown = (e, fn) => {
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault(); fn()
  }
}

/* ===== 리스트 업서트 (새 항목은 _isNew=true) ===== */
function upsert (listRef, item, key = '_id') {
  const idx = listRef.value.findIndex(x => x[key] === item[key])
  const merged = { ...item, _isNew: true }
  if (idx >= 0) {
    console.log('[FriendsList] upsert(merge) →', item)
    listRef.value.splice(idx, 1, merged)
  } else {
    console.log('[FriendsList] upsert(unshift) →', item)
    listRef.value.unshift(merged)
  }
  broadcastFriendsState()
}

/* ===== API 리프레시(초기/재동기화용) ===== */
async function refreshSent () {
  const res = await axios.get('/api/friend-requests/sent', { withCredentials: true })
  sentRequests.value = res.data.map(it => {
    const prev = sentRequests.value.find(x => x._id === it._id)
    return prev ? { ...it, _isNew: !!prev._isNew } : { ...it, _isNew: false }
  })
  console.log('[FriendsList] refreshSent →', sentRequests.value)
  broadcastFriendsState()
}
async function refreshReceived () {
  const res = await axios.get('/api/friend-requests/received', { withCredentials: true })
  receivedRequests.value = res.data.map(it => {
    const prev = receivedRequests.value.find(x => x._id === it._id)
    return prev ? { ...it, _isNew: !!prev._isNew } : { ...it, _isNew: false }
  })
  console.log('[FriendsList] refreshReceived →', receivedRequests.value)
  broadcastFriendsState()
}
async function refreshFriends () {
  const res = await axios.get('/api/friends', { withCredentials: true })
  friends.value = res.data
  console.log('[FriendsList] refreshFriends →', friends.value.length, '명')
}
async function refreshBlocks () {
  const res = await axios.get('/api/blocks', { withCredentials: true })
  blocks.value = res.data
  console.log('[FriendsList] refreshBlocks →', blocks.value.length, '명')
}

/* ===== 액션(API) ===== */
const cancelRequest = async (requestId) => {
  try {
    if (!confirm('정말로 신청을 취소하시겠습니까?')) return
    await axios.delete(`/api/friend-request/${requestId}`, { withCredentials: true })
    sentRequests.value = sentRequests.value.filter(r => r._id !== requestId)
    console.log('[FriendsList] 신청 취소 완료 →', requestId)
    broadcastFriendsState()
  } catch (e) {
    console.error('[FriendsList] 신청 취소 오류:', e)
    alert('신청 취소 중 오류')
  }
}
const acceptRequest = async (requestId) => {
  try {
    await axios.put(`/api/friend-request/${requestId}/accept`, {}, { withCredentials: true })
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== requestId)
    console.log('[FriendsList] 신청 수락 완료 →', requestId)
    broadcastFriendsState()
    await refreshFriends()
    selectedRequest.value = null
  } catch (e) {
    console.error('[FriendsList] 수락 오류:', e)
    alert('수락 중 오류')
  }
}
const rejectRequest = async (requestId) => {
  try {
    await axios.put(`/api/friend-request/${requestId}/reject`, {}, { withCredentials: true })
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== requestId)
    console.log('[FriendsList] 신청 거절 완료 →', requestId)
    broadcastFriendsState()
    selectedRequest.value = null
  } catch (e) {
    console.error('[FriendsList] 거절 오류:', e)
    alert('거절 중 오류')
  }
}
const blockRequest = async (requestId) => {
  try {
    if (!confirm('정말로 차단하시겠습니까?')) return
    await axios.put(`/api/friend-request/${requestId}/block`, {}, { withCredentials: true })
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== requestId)
    console.log('[FriendsList] 차단 완료 →', requestId)
    broadcastFriendsState()
    await refreshBlocks()
    selectedRequest.value = null
  } catch (e) {
    console.error('[FriendsList] 차단 오류:', e)
    alert('차단 중 오류')
  }
}

/* ===== 라우팅/클릭 (개별 읽음 처리) ===== */
const handleClickAndClearNew = (section, r) => {
  const user = section === 'sent' ? r.to : r.from
  if (!user || !user._id) return
  if (r._isNew) { r._isNew = false; broadcastFriendsState() }
  console.log('[FriendsList] 프로필 이동 →', user._id, 'from section:', section)
  router.push(`/home/user/${user._id}`)
}
const handleClick = (user) => {
  if (!user || !user._id) return
  console.log('[FriendsList] 프로필 이동 →', user._id)
  router.push(`/home/user/${user._id}`)
}
const openMessageModal = (request) => {
  selectedRequest.value = request
  console.log('[FriendsList] 인사말 모달 오픈 →', request?._id)
}

/* ===== 소켓 ===== */
function bindSocketHandlers () {
  if (!socket) return
  console.log('[FriendsList] Socket 바인딩')

  // 새 신청 생성 (서버가 양쪽에 방송)
  socket.on('friendRequest:created', (req) => {
    const me = myId.value
    if (!me) return
    console.log('[Socket] friendRequest:created 수신 →', req?._id)

    if (req.from?._id === me) upsert(sentRequests, req)
    if (req.to?._id === me) upsert(receivedRequests, req)
  })

  socket.on('friendRequest:accepted', async (req) => {
    const me = myId.value
    if (!me) return
    console.log('[Socket] friendRequest:accepted 수신 →', req?._id)

    if (req.to?._id === me) {
      receivedRequests.value = receivedRequests.value.filter(r => r._id !== req._id)
      broadcastFriendsState()
      await refreshFriends()
    }
  })

  socket.on('friendRequest:rejected', (req) => {
    const me = myId.value
    if (!me) return
    console.log('[Socket] friendRequest:rejected 수신 →', req?._id)

    sentRequests.value     = sentRequests.value.filter(r => r._id !== req._id)
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== req._id)
    broadcastFriendsState()
  })

  socket.on('friendRequest:cancelled', (req) => {
    const me = myId.value
    if (!me) return
    console.log('[Socket] friendRequest:cancelled 수신 →', req?._id)

    sentRequests.value     = sentRequests.value.filter(r => r._id !== req._id)
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== req._id)
    broadcastFriendsState()
  })

  socket.on('block:created', async () => {
    console.log('[Socket] block:created 수신 → blocks refresh')
    await refreshBlocks()
  })
}

/* 초기 로드 + 소켓 연결 */
onMounted(async () => {
  try {
    console.log('%c[FriendsList] 초기 로드 시작', 'color:#d4af37')
    const me = await axios.get('/api/me', { withCredentials: true })
    myId.value = me.data.user?._id || null
    nickname.value = me.data.user?.nickname || ''
    console.log('[FriendsList] me:', myId.value, nickname.value)

    const [s, r, f, b] = await Promise.all([
      axios.get('/api/friend-requests/sent', { withCredentials: true }),
      axios.get('/api/friend-requests/received', { withCredentials: true }),
      axios.get('/api/friends', { withCredentials: true }),
      axios.get('/api/blocks', { withCredentials: true })
    ])

    // 초기 로드는 신규 아님
    sentRequests.value     = s.data.map(it => ({ ...it, _isNew: false }))
    receivedRequests.value = r.data.map(it => ({ ...it, _isNew: false }))
    friends.value = f.data
    blocks.value  = b.data

    broadcastFriendsState()
    console.log('[FriendsList] 초기 데이터 동기화 완료')

    // === Socket.IO 연결 ===
    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
    socket = io(url, {
      withCredentials: true,
      transports: ['websocket'],
      autoConnect: true
    })
    socket.on('connect', () => {
      console.log('%c[FriendsList] Socket 연결됨', 'color:#d4af37')
      socket.emit('join', { userId: myId.value })
    })
    bindSocketHandlers()

    // TopMenu가 상태를 요청하면 응답
    window.addEventListener('friends:requestState', onRequestState)
  } catch (err) {
    console.error('[FriendsList] 초기 로드/소켓 연결 실패:', err)
  }
})

onUnmounted(() => {
  try {
    if (socket) { socket.off(); socket.disconnect(); socket = null }
    window.removeEventListener('friends:requestState', onRequestState)
    console.log('[FriendsList] 언마운트: 소켓/리스너 정리 완료')
  } catch (e) {
    console.warn('[FriendsList] 언마운트 정리 중 경고:', e)
  }
})
</script>

<style scoped>
/* ============================================
   블랙 + 골드 테마 (가독성: 콘텐츠는 '흰 카드 + 검은 글씨')
   - 골드: #d4af37
   - 백그라운드: 딥 블랙
   - 포커스/호버: 골드 글로우
============================================ */
:root {
  --gold: #d4af37;
  --gold-weak: #e6c964;
  --gold-strong: #b18f1a;
  --bg-deep: #0a0a0a;
  --ink: #111;        /* 본문 글자(검정) */
  --ink-weak: #444;   /* 서브 텍스트 */
  --card: #ffffff;    /* 카드 배경(흰색 유지) */
  --border: #eee;
}

:global(html, body) {
  scrollbar-gutter: stable both-edges;
  background: var(--bg-deep);
}

.lists-wrapper {
  padding: 10px 12px 14px;
  box-sizing: border-box;
  color: var(--ink); /* 기본 글자: 검정 */
}

/* 섹션 */
.list-section {
  display: block;
  margin: 10px 0 14px;
  padding: 0;
  position: relative;
}

/* 섹션 헤더 */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
  padding: 6px 4px;
  border-left: 4px solid var(--gold);
}
.section-header.toggleable {
  cursor: pointer;
  border-radius: 10px;
  transition: box-shadow .15s, background-color .15s;
}
.section-header.toggleable:hover {
  background: rgba(212, 175, 55, 0.08);
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.25) inset;
}
.section-header.toggleable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.45);
}

/* 타이틀 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--gold);
  font-weight: 800;
  letter-spacing: 0.2px;
  text-shadow: 0 0 10px rgba(212, 175, 55, 0.15);
}
.list-section h3 {
  margin: 0;
  font-size: clamp(15px, 2.6vw, 16px);
}
.section-icon {
  font-size: 18px;
  color: var(--gold);
}
.section-icon.danger { color: #ff6b6b; }
.count { font-weight: 800; color: var(--gold-weak); }
.section-toggle-icon {
  font-size: 18px;
  color: var(--gold);
}
.section-toggle-icon.danger { color: #ff6b6b; }

/* 신규 배지 */
.badge-new {
  display: inline-block;
  margin-left: 6px;
  font-weight: 900;
  font-size: 0.92em;
  color: #fff;
  background: linear-gradient(135deg, var(--gold), var(--gold-strong));
  padding: 0 6px;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(212, 175, 55, 0.55);
}

/* 카드 (리스트 컨테이너) */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 8px 10px;
  box-shadow:
    0 8px 24px rgba(0,0,0,0.28),
    0 0 0 1px rgba(212,175,55,0.05) inset;
  position: relative;
}
.card::before {
  /* 은은한 골드 테두리 하이라이트 */
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(212,175,55,0.6), rgba(212,175,55,0.15));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
}

/* 리스트 */
.list-scroll {
  overflow: visible; /* 섹션 내부 스크롤 없음 유지 */
  -webkit-overflow-scrolling: auto;
  margin-top: 6px;
}
ul { margin: 0; padding: 0; list-style: none; }

.row {
  color: var(--ink);
  padding: 10px 6px;
  border-bottom: 1px dashed #e9e9e9;
  font-size: clamp(14px, 2.4vw, 15px);
  transition: background-color .15s, transform .05s;
  border-radius: 10px;
}
.row:last-child { border-bottom: 0; }
.row:hover {
  background-color: #fafafa;
}
.row:active {
  transform: scale(0.998);
}

/* 유저 라인 */
.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.row-icon {
  font-size: 18px;
  color: var(--gold);
  margin-right: 6px;
  filter: drop-shadow(0 0 6px rgba(212,175,55,0.3));
}
.row-icon.danger { color: #e35252; }

.user-info {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  color: var(--ink);
}
.user-name {
  font-weight: 800;
  font-size: clamp(15px, 2.6vw, 16px);
  color: #000;
}
.user-meta {
  font-size: clamp(13px, 2.2vw, 14px);
  color: var(--ink-weak);
}

/* 빈 상태 */
.empty {
  color: var(--ink-weak);
  margin: 8px 2px 4px;
  font-size: 14px;
}

/* 버튼 테마 오버라이드 (Ionic) */
.btn-gold-solid {
  /* color="primary" 에 추가 클래스 부여하여 골드 솔리드 */
  --background: linear-gradient(135deg, var(--gold), var(--gold-strong));
  --color: #000;           /* 버튼 텍스트: 검정 */
  --box-shadow: 0 6px 16px rgba(212,175,55,0.45);
  border: none;
  font-weight: 800;
}
.btn-gold-solid:hover {
  --background: linear-gradient(135deg, var(--gold-weak), var(--gold));
}

.btn-gold-outline {
  --background: transparent;
  --color: var(--gold-strong);
  border: 1.5px solid var(--gold);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(212,175,55,0.25);
}
.btn-gold-outline:hover {
  background: rgba(212,175,55,0.08);
}

/* 포커스 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(212, 175, 55, .45);
  border-radius: 10px;
}

/* 작은 화면 보정 */
@media (max-width: 360px) {
  .lists-wrapper { padding: 8px 10px 10px; }
  .list-scroll { padding: 6px; }
}
</style>
