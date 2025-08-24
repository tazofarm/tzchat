<template>
  <!-- 다크 배경 유지용 스코프 -->
  <div class="lists-wrapper fl-scope" role="region" aria-label="친구 신청 및 리스트">
    <!-- 📤 보낸 친구 신청 -->
    <div class="list-section">
      <div
        class="section-header toggleable"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsedSent"
        @click="toggleSent()
        "
        @keydown="toggleOnKeydown($event, toggleSent)"
      >
        <ion-icon :icon="icons.chevronForwardOutline" v-if="collapsedSent" class="section-toggle-icon" aria-hidden="true" />
        <ion-icon :icon="icons.chevronDownOutline" v-else class="section-toggle-icon" aria-hidden="true" />
        <h3 class="section-title">
          <ion-icon :icon="icons.sendOutline" class="section-icon" aria-hidden="true" />
          보낸 친구 신청
          <span class="count">({{ sentRequests.length }})</span>
          <span v-if="anyNewSent && sentRequests.length" class="badge-new" aria-label="새 항목 있음">ⓝ</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedSent">
        <ul v-if="sentRequests.length">
          <li
            v-for="r in sentRequests"
            :key="r._id"
            class="row"
            role="button"
            tabindex="0"
            @click="handleClickAndClearNew('sent', r)"
            @keydown="rowKeydown($event, () => handleClickAndClearNew('sent', r))"
          >
            <div class="user-row">
              <ion-icon :icon="icons.paperPlaneOutline" class="row-icon" aria-hidden="true" />
              <div class="user-info">
                <div class="user-name">
                  {{ r.to.nickname }}
                  <span v-if="r._isNew" class="badge-new" aria-label="신규">ⓝ</span>
                </div>
                <div class="user-meta">출생년도: {{ r.to.birthyear }} / 성별: {{ r.to.gender === 'man' ? '남자' : '여자' }}</div>
              </div>
              <!-- 버튼은 행 클릭과 분리 -->
              <ion-button size="small" color="medium" class="btn-gold-outline" @click.stop="cancelRequest(r._id)">취소하기</ion-button>
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
        <ion-icon :icon="icons.chevronForwardOutline" v-if="collapsedReceived" class="section-toggle-icon" aria-hidden="true" />
        <ion-icon :icon="icons.chevronDownOutline" v-else class="section-toggle-icon" aria-hidden="true" />
        <h3 class="section-title">
          <ion-icon :icon="icons.mailOpenOutline" class="section-icon" aria-hidden="true" />
          받은 친구 신청
          <span class="count">({{ receivedRequests.length }} / 50)</span>
          <span v-if="anyNewReceived && receivedRequests.length" class="badge-new" aria-label="새 항목 있음">ⓝ</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedReceived">
        <ul v-if="receivedRequests.length">
          <li
            v-for="r in receivedRequests"
            :key="r._id"
            class="row"
            role="button"
            tabindex="0"
            @click="handleClickAndClearNew('received', r)"
            @keydown="rowKeydown($event, () => handleClickAndClearNew('received', r))"
          >
            <div class="user-row">
              <ion-icon :icon="icons.mailOutline" class="row-icon" aria-hidden="true" />
              <div class="user-info">
                <div class="user-name">
                  {{ r.from.nickname }}
                  <span v-if="r._isNew" class="badge-new" aria-label="신규">ⓝ</span>
                </div>
                <div class="user-meta">출생년도: {{ r.from.birthyear }} / 성별: {{ r.from.gender === 'man' ? '남자' : '여자' }}</div>
              </div>
              <ion-button size="small" color="primary" class="btn-gold-solid" @click.stop="openMessageModal(r)">인사말보기</ion-button>
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
        <ion-icon :icon="icons.chevronForwardOutline" v-if="collapsedFriends" class="section-toggle-icon" aria-hidden="true" />
        <ion-icon :icon="icons.chevronDownOutline" v-else class="section-toggle-icon" aria-hidden="true" />
        <h3 class="section-title">
          <ion-icon :icon="icons.peopleOutline" class="section-icon" aria-hidden="true" />
          친구 리스트 <span class="count">({{ friends.length }})</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedFriends">
        <ul v-if="friends.length">
          <li
            v-for="f in friends"
            :key="f._id"
            class="row"
            role="button"
            tabindex="0"
            @click="handleClick(f)"
            @keydown="rowKeydown($event, () => handleClick(f))"
          >
            <div class="user-row">
              <ion-icon :icon="icons.personCircleOutline" class="row-icon" aria-hidden="true" />
              <div class="user-info">
                <div class="user-name">{{ f.nickname }}</div>
                <div class="user-meta">출생년도: {{ f.birthyear }} / 성별: {{ f.gender === 'man' ? '남자' : '여자' }}</div>
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
        <ion-icon :icon="icons.chevronForwardOutline" v-if="collapsedBlocks" class="section-toggle-icon danger" aria-hidden="true" />
        <ion-icon :icon="icons.chevronDownOutline" v-else class="section-toggle-icon danger" aria-hidden="true" />
        <h3 class="section-title">
          <ion-icon :icon="icons.closeCircleOutline" class="section-icon danger" aria-hidden="true" />
          차단한 친구 <span class="count">({{ blocks.length }})</span>
        </h3>
      </div>

      <div class="list-scroll card" v-show="!collapsedBlocks">
        <ul v-if="blocks.length">
          <li
            v-for="b in blocks"
            :key="b._id"
            class="row"
            role="button"
            tabindex="0"
            @click="handleClick(b)"
            @keydown="rowKeydown($event, () => handleClick(b))"
          >
            <div class="user-row">
              <ion-icon :icon="icons.removeCircleOutline" class="row-icon danger" aria-hidden="true" />
              <div class="user-info">
                <div class="user-name">{{ b.username }} ({{ b.nickname }})</div>
                <div class="user-meta">출생년도: {{ b.birthyear }} / 성별: {{ b.gender === 'man' ? '남자' : '여자' }}</div>
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
// ===============================================
// 유지: 로직 동일 / 보강: 클릭영역, 다크테마 가독성, 로그
// ===============================================
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

const icons = { sendOutline, paperPlaneOutline, mailOpenOutline, mailOutline, peopleOutline, personCircleOutline, closeCircleOutline, removeCircleOutline, chevronDownOutline, chevronForwardOutline }

const router = useRouter()
let socket

/* ===== 상태 ===== */
const myId = ref(null)
const nickname = ref('')

const sentRequests = ref([])
const receivedRequests = ref([])
const friends = ref([])
const blocks = ref([])
const selectedRequest = ref(null)

/* 접기/펼치기 */
const collapsedSent = ref(false)
const collapsedReceived = ref(false)
const collapsedFriends = ref(true)
const collapsedBlocks = ref(true)

/* 제목 ⓝ */
const anyNewSent = computed(() => sentRequests.value.some(i => i._isNew))
const anyNewReceived = computed(() => receivedRequests.value.some(i => i._isNew))
const hasAnyNew = () => anyNewSent.value || anyNewReceived.value

/* ===== 유틸: 리스트에서 id로 제거 ===== */
function removeById (listRef, id, key = '_id') {
  const before = listRef.value.length
  listRef.value = listRef.value.filter(x => x?.[key] !== id)
  const after = listRef.value.length
  console.log(`[FriendsList] removeById ${id}: ${before} → ${after}`)
}

/* ===== 브로드캐스트 ===== */
function broadcastFriendsState () {
  try {
    const payload = { hasNew: hasAnyNew() }
    console.log('[FriendsList] broadcastFriendsState →', payload)
    window.dispatchEvent(new CustomEvent('friends:state', { detail: payload }))
  } catch (err) {
    console.warn('[FriendsList] broadcastFriendsState 실패:', err)
  }
}
const onRequestState = () => broadcastFriendsState()

/* 토글 */
const toggleSent = () => { collapsedSent.value = !collapsedSent.value }
const toggleReceived = () => { collapsedReceived.value = !collapsedReceived.value }
const toggleFriends = () => { collapsedFriends.value = !collapsedFriends.value }
const toggleBlocks = () => { collapsedBlocks.value = !collapsedBlocks.value }
const toggleOnKeydown = (e, fn) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); fn() } }

/* 행 키보드 접근성 */
const rowKeydown = (e, fn) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); fn() } }

/* 리스트 업서트 */
function upsert (listRef, item, key = '_id') {
  const idx = listRef.value.findIndex(x => x[key] === item[key])
  const merged = { ...item, _isNew: true }
  if (idx >= 0) listRef.value.splice(idx, 1, merged)
  else listRef.value.unshift(merged)
  broadcastFriendsState()
}

/* ===== 공통: 프로필 이동 (제공하신 패턴 그대로) ===== */
const goToUserProfile = (userId) => {
  if (!userId) return console.warn('❗ userId 없음')
  console.log('➡️ 유저 프로필 페이지 이동:', userId)
  router.push(`/home/user/${userId}`)
}

/* 라우팅 + 신규표시 제거 */
const handleClickAndClearNew = (section, r) => {
  const user = section === 'sent' ? r.to : r.from
  if (!user || !user._id) return
  if (r._isNew) { r._isNew = false; broadcastFriendsState() }
  goToUserProfile(user._id)
}
const handleClick = (user) => {
  if (!user || !user._id) return
  goToUserProfile(user._id)
}

/* ===== API 리프레시 ===== */
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

/* ===== 모달 ===== */
const openMessageModal = (request) => {
  selectedRequest.value = request
  console.log('[FriendsList] 인사말 모달 오픈 →', request?._id)
}

/* ===================================================
   ✅ 추가: 친구신청 취소 / 수락 / 거절 / 차단 액션 함수
   - 라우터 규약(모델 메모리 상):
     * 취소:    DELETE /api/friend-request/:id
     * 수락:    PUT    /api/friend-request/:id/accept
     * 거절:    PUT    /api/friend-request/:id/reject
     * 차단:    PUT    /api/friend-request/:id/block
   - 성공 시 목록/카운트/배지/소켓 반영
=================================================== */
async function cancelRequest (idOrObj) {
  try {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?._id
    if (!id) return console.warn('[FriendsList] cancelRequest: id 없음', idOrObj)
    console.log('[FriendsList] 친구신청 취소 요청 →', id)

    await axios.delete(`/api/friend-request/${id}`, { withCredentials: true })

    // 낙관적 업데이트: 보낸/받은 목록에서 제거
    removeById(sentRequests, id)
    removeById(receivedRequests, id)
    broadcastFriendsState()

    console.log('%c[FriendsList] 친구신청 취소 완료', 'color:#0bd60b', id)
  } catch (err) {
    console.error('[FriendsList] 친구신청 취소 실패:', err?.response?.data || err?.message || err)
  }
}

async function acceptRequest (payload) {
  try {
    const id = typeof payload === 'string' ? payload : payload?._id
    if (!id) return console.warn('[FriendsList] acceptRequest: id 없음', payload)
    console.log('[FriendsList] 친구신청 수락 요청 →', id)

    await axios.put(`/api/friend-request/${id}/accept`, {}, { withCredentials: true })

    // 받은 목록에서 제거 + 친구 목록 갱신
    removeById(receivedRequests, id)
    await refreshFriends()
    broadcastFriendsState()

    if (selectedRequest.value?.['_id'] === id) selectedRequest.value = null
    console.log('%c[FriendsList] 친구신청 수락 완료', 'color:#0bd60b', id)
  } catch (err) {
    console.error('[FriendsList] 친구신청 수락 실패:', err?.response?.data || err?.message || err)
  }
}

async function rejectRequest (payload) {
  try {
    const id = typeof payload === 'string' ? payload : payload?._id
    if (!id) return console.warn('[FriendsList] rejectRequest: id 없음', payload)
    console.log('[FriendsList] 친구신청 거절 요청 →', id)

    await axios.put(`/api/friend-request/${id}/reject`, {}, { withCredentials: true })

    // 보낸/받은 양쪽에서 제거 (상대 상태와 무관하게 로컬 정리)
    removeById(sentRequests, id)
    removeById(receivedRequests, id)
    broadcastFriendsState()

    if (selectedRequest.value?.['_id'] === id) selectedRequest.value = null
    console.log('%c[FriendsList] 친구신청 거절 완료', 'color:#0bd60b', id)
  } catch (err) {
    console.error('[FriendsList] 친구신청 거절 실패:', err?.response?.data || err?.message || err)
  }
}

async function blockRequest (payload) {
  try {
    const id = typeof payload === 'string' ? payload : payload?._id
    if (!id) return console.warn('[FriendsList] blockRequest: id 없음', payload)
    console.log('[FriendsList] 친구신청 차단 요청 →', id)

    await axios.put(`/api/friend-request/${id}/block`, {}, { withCredentials: true })

    // 받은 목록에서 제거 + 차단 목록 갱신
    removeById(receivedRequests, id)
    await refreshBlocks()
    broadcastFriendsState()

    if (selectedRequest.value?.['_id'] === id) selectedRequest.value = null
    console.log('%c[FriendsList] 친구신청 차단 완료', 'color:#0bd60b', id)
  } catch (err) {
    console.error('[FriendsList] 친구신청 차단 실패:', err?.response?.data || err?.message || err)
  }
}

/* ===== 소켓 ===== */
function bindSocketHandlers () {
  if (!socket) return
  console.log('[FriendsList] Socket 바인딩')

  socket.on('friendRequest:created', (req) => {
    const me = myId.value; if (!me) return
    if (req.from?._id === me) upsert(sentRequests, req)
    if (req.to?._id === me) upsert(receivedRequests, req)
  })

  socket.on('friendRequest:accepted', async (req) => {
    const me = myId.value; if (!me) return
    if (req.to?._id === me) {
      removeById(receivedRequests, req._id)
      await refreshFriends()
      broadcastFriendsState()
    }
  })

  socket.on('friendRequest:rejected', (req) => {
    const me = myId.value; if (!me) return
    removeById(sentRequests, req._id)
    removeById(receivedRequests, req._id)
    broadcastFriendsState()
  })

  socket.on('friendRequest:cancelled', (req) => {
    const me = myId.value; if (!me) return
    removeById(sentRequests, req._id)
    removeById(receivedRequests, req._id)
    broadcastFriendsState()
  })

  socket.on('block:created', async () => { await refreshBlocks() })
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

    sentRequests.value     = s.data.map(it => ({ ...it, _isNew: false }))
    receivedRequests.value = r.data.map(it => ({ ...it, _isNew: false }))
    friends.value = f.data
    blocks.value  = b.data

    broadcastFriendsState()
    console.log('[FriendsList] 초기 데이터 동기화 완료')

    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
    socket = io(url, { withCredentials: true, transports: ['websocket'], autoConnect: true })
    socket.on('connect', () => {
      console.log('%c[FriendsList] Socket 연결됨', 'color:#d4af37')
      socket.emit('join', { userId: myId.value })
    })
    bindSocketHandlers()

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
/* =======================
   블랙 + 골드 다크 스타일
   (가독성 강화, 행 전체 클릭)
======================= */
:root{
  --gold:#d4af37; --gold-weak:#e6c964; --gold-strong:#b18f1a;
  --bg-deep:#0a0a0a; --panel:#141414; --row:#1b1b1b;
  --ink:#f5f5f5; --ink-weak:#c9c9c9; --border:#333;
}

:global(html,body){ background:var(--bg-deep); color:var(--ink); }

.lists-wrapper{ padding:10px 12px 14px; box-sizing:border-box; color:var(--ink); }

/* 섹션 헤더 */
.section-header{
  display:flex; align-items:center; gap:8px; user-select:none;
  padding:8px 10px; border-left:4px solid var(--gold);
  background:#0f0f0f; border-radius:10px;
  box-shadow: inset 0 0 0 1px rgba(212,175,55,.08);
}
.section-header.toggleable{ cursor:pointer; transition:box-shadow .15s, background-color .15s; }
.section-header.toggleable:hover{ background:#121212; box-shadow: 0 0 0 2px rgba(212,175,55,.18) inset; }
.section-header.toggleable:focus-visible{ outline:none; box-shadow:0 0 0 3px rgba(212,175,55,.35); }

.section-title{ display:flex; align-items:center; gap:8px; margin:0; color:var(--gold); font-weight:800; letter-spacing:.2px; }
.list-section h3{ margin:0; font-size:clamp(15px, 2.6vw, 16px); }
.section-icon,.section-toggle-icon{ font-size:18px; color:var(--gold); }
.section-icon.danger,.section-toggle-icon.danger{ color:#ff6b6b; }
.count{ font-weight:800; color:var(--gold-weak); }

/* 카드 컨테이너(다크) */
.card{
  background:var(--panel) !important;
  border:1px solid var(--border) !important;
  border-radius:14px; padding:10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 1px rgba(212,175,55,.05) inset;
  position:relative;
}
.card::before{
  content:''; position:absolute; inset:0; border-radius:14px; padding:1px;
  background:linear-gradient(135deg, rgba(212,175,55,.35), rgba(212,175,55,.08));
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  pointer-events:none;                 /* ✅ 오버레이가 클릭을 가로채지 않게 */
}

/* 리스트 */
.list-scroll{ overflow:visible; margin-top:6px; }
ul{ margin:0; padding:0; list-style:none; }

/* ✅ 행 전체 클릭 + 다크 배경 */
.row{
  position:relative; z-index:1;        /* ✅ 오버레이 위로 */
  background:var(--row) !important; color:var(--ink) !important;
  border:1px solid #2a2a2a; border-radius:12px;
  padding:12px 10px; margin-bottom:10px;
  transition: background-color .12s ease, transform .04s ease;
  cursor:pointer; pointer-events:auto;
}
.row:last-child{ margin-bottom:0; }
.row:hover{ background:#222; }
.row:active{ transform:scale(.998); }

/* 유저 라인 */
.user-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.row-icon{ font-size:18px; color:var(--gold); margin-right:6px; filter:drop-shadow(0 0 6px rgba(212,175,55,.25)); }
.row-icon.danger{ color:#e35252; }

.user-info{ display:flex; flex-direction:column; flex:1 1 auto; min-width:0; pointer-events:auto; }
.user-name{
  font-weight:800; font-size:clamp(15px, 2.6vw, 16px);
  color:#fff !important; text-shadow:none !important;
}
.user-meta{ font-size:clamp(13px, 2.2vw, 14px); color:var(--ink-weak) !important; }

/* 신규 배지 */
.badge-new{
  display:inline-block; margin-left:6px; font-weight:900; font-size:.92em;
  color:#000; background:linear-gradient(135deg, var(--gold), var(--gold-strong));
  padding:0 6px; border-radius:10px; box-shadow:0 1px 6px rgba(212,175,55,.45);
}

/* 빈 상태 */
.empty{ color:#9b9b9b !important; margin:8px 2px 4px; font-size:14px; }

/* 버튼(행 클릭과 분리) */
.btn-gold-solid{
  --background:linear-gradient(135deg, var(--gold), var(--gold-strong));
  --color:#000; --box-shadow:0 6px 16px rgba(212,175,55,.35);
  border:none; font-weight:800; pointer-events:auto;
}
.btn-gold-solid:hover{ --background:linear-gradient(135deg, var(--gold-weak), var(--gold)); }
.btn-gold-outline{
  --background:transparent; --color:var(--gold-weak);
  border:1.5px solid var(--gold); font-weight:800; pointer-events:auto;
}
.btn-gold-outline:hover{ background:rgba(212,175,55,.08); }

/* 접근성 포커스 */
:focus-visible{ outline:none; box-shadow:0 0 0 3px rgba(212,175,55,.35); border-radius:10px; }

/* 작은 화면 */
@media (max-width:360px){
  .lists-wrapper{ padding:8px 10px 10px; }
  .list-scroll{ padding:6px; }
}
</style>
