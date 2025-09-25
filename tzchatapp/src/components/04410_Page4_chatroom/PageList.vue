<template>
  <!-- ✅ 상단 고정 탭: 채팅리스트 / 친구리스트 -->
  <div class="top-tabs" role="tablist" aria-label="목록 전환">
    <ion-segment :value="currentTab" @ionChange="onTabChange">
      <ion-segment-button value="chat">
        <ion-label>채팅리스트</ion-label>
      </ion-segment-button>
      <ion-segment-button value="friends">
        <ion-label>친구리스트</ion-label>
      </ion-segment-button>
    </ion-segment>
  </div>

  <!-- 다크 배경 유지용 스코프 -->
  <div class="lists-wrapper fl-scope" role="region" aria-label="친구 신청 및 리스트">
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
              <ion-button
                size="small"
                color="medium"
                class="btn-gold-outline"
                @click.stop="onCancelClick(r._id)"
              >취소하기</ion-button>
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
          <span class="count">({{ receivedRequests.length }} / 30)</span>
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
              <ion-button
                size="small"
                color="primary"
                class="btn-gold-solid"
                @click.stop="openMessageModal(r)"
              >인사말보기</ion-button>
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
    @accepted="onAcceptClick"
    @rejected="onRejectClick"
    @blocked="onBlockClick"
  />
</template>

<script setup>
// ===============================================
// 상단 탭 추가: /home/4page(채팅), /home/3page(친구)
// ===============================================
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from '@/lib/api'
import { IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue'
import { useRouter, useRoute } from 'vue-router'
import ModalFriendMessage from '@/components/04310_Page3_list/Modal_FriendMessage.vue'
import { connectSocket, getSocket } from '@/lib/socket'

import {
  sendOutline, paperPlaneOutline, mailOpenOutline, mailOutline,
  peopleOutline, personCircleOutline, closeCircleOutline, removeCircleOutline,
  chevronDownOutline, chevronForwardOutline
} from 'ionicons/icons'

const icons = { sendOutline, paperPlaneOutline, mailOpenOutline, mailOutline, peopleOutline, personCircleOutline, closeCircleOutline, removeCircleOutline, chevronDownOutline, chevronForwardOutline }

const router = useRouter()
const route  = useRoute()
let socket

/* ===== 상단 탭 상태 ===== */
const currentTab = ref('friends') // 기본 활성: 친구리스트

// 경로 변화 시 탭 동기화(선택 사항)
watch(() => route.path, (p) => {
  currentTab.value = p.includes('/home/4page') ? 'chat' : 'friends'
})

// 탭 전환 → 라우팅
const onTabChange = (ev) => {
  const val = ev.detail?.value
  if (val === 'friends') router.push('/home/3page')
  else router.push('/home/4page')
}

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
  console.log('[UI][RES]', { page:'3_list', step:'removeById', id, before, after })
}

/* ===== 브로드캐스트 ===== */
function broadcastFriendsState () {
  try {
    const payload = { hasNew: hasAnyNew() }
    console.log('[UI][MSG]', { page:'3_list', step:'broadcastFriendsState', payload })
    window.dispatchEvent(new CustomEvent('friends:state', { detail: payload }))
  } catch (err) {
    console.log('[UI][ERR]', { page:'3_list', step:'broadcastFriendsState', message: err?.message })
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

/* ===== 공통: 프로필 이동 ===== */
const goToUserProfile = (userId) => {
  if (!userId) return console.log('[UI][ERR]', { page:'3_list', step:'goToUserProfile', message:'userId missing' })
  console.log('[UI][REQ]', { page:'3_list', step:'goToUserProfile', userId })
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

/* ===== API 리프레시 (baseURL=/api) ===== */
async function refreshSent () {
  const res = await axios.get('/api/friend-requests/sent')
  sentRequests.value = res.data.map(it => {
    const prev = sentRequests.value.find(x => x._id === it._id)
    return prev ? { ...it, _isNew: !!prev._isNew } : { ...it, _isNew: false }
  })
  broadcastFriendsState()
}
async function refreshReceived () {
  const res = await axios.get('/api/friend-requests/received')
  receivedRequests.value = res.data.map(it => {
    const prev = receivedRequests.value.find(x => x._id === it._id)
    return prev ? { ...it, _isNew: !!prev._isNew } : { ...it, _isNew: false }
  })
  broadcastFriendsState()
}
async function refreshFriends () {
  const res = await axios.get('/api/friends')
  friends.value = res.data
}
async function refreshBlocks () {
  const res = await axios.get('/api/blocks')
  blocks.value  = res.data
}

/* ===== 모달 ===== */
const openMessageModal = (request) => {
  selectedRequest.value = request
}

/* ===== 액션 ===== */
async function cancelFriendRequest (idOrObj) {
  try {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?._id
    if (!id) return
    await axios.delete(`/api/friend-request/${id}`)
    removeById(sentRequests, id)
    removeById(receivedRequests, id)
    broadcastFriendsState()
  } catch (err) {
    console.log('[API][ERR]', { path:'/friend-request/:id', action:'cancel', message: err?.response?.data || err?.message })
  }
}
async function acceptFriendRequest (payload) {
  try {
    const id = typeof payload === 'string' ? payload : payload?._id
    if (!id) return
    await axios.put(`/api/friend-request/${id}/accept`, {})
    removeById(receivedRequests, id)
    await refreshFriends()
    broadcastFriendsState()
    if (selectedRequest.value?.['_id'] === id) selectedRequest.value = null
  } catch (err) {
    console.log('[API][ERR]', { path:'/friend-request/:id/accept', message: err?.response?.data || err?.message })
  }
}
async function rejectFriendRequest (payload) {
  try {
    const id = typeof payload === 'string' ? payload : payload?._id
    if (!id) return
    await axios.put(`/api/friend-request/${id}/reject`, {})
    removeById(sentRequests, id)
    removeById(receivedRequests, id)
    broadcastFriendsState()
    if (selectedRequest.value?.['_id'] === id) selectedRequest.value = null
  } catch (err) {
    console.log('[API][ERR]', { path:'/friend-request/:id/reject', message: err?.response?.data || err?.message })
  }
}
async function blockFriendRequest (payload) {
  try {
    const id = typeof payload === 'string' ? payload : payload?._id
    if (!id) return
    await axios.put(`/api/friend-request/${id}/block`, {})
    removeById(receivedRequests, id)
    await refreshBlocks()
    broadcastFriendsState()
    if (selectedRequest.value?.['_id'] === id) selectedRequest.value = null
  } catch (err) {
    console.log('[API][ERR]', { path:'/friend-request/:id/block', message: err?.response?.data || err?.message })
  }
}

/* 템플릿 핸들러 */
const onCancelClick = (id) => cancelFriendRequest(id)
const onAcceptClick = (payload) => acceptFriendRequest(payload)
const onRejectClick = (payload) => rejectFriendRequest(payload)
const onBlockClick = (payload) => blockFriendRequest(payload)

/* ===== 소켓 ===== */
function bindSocketHandlers () {
  if (!socket) return
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
    removeById(sentRequests, req._id)
    removeById(receivedRequests, req._id)
    broadcastFriendsState()
  })
  socket.on('friendRequest:cancelled', (req) => {
    removeById(sentRequests, req._id)
    removeById(receivedRequests, req._id)
    broadcastFriendsState()
  })
  socket.on('block:created', async () => { await refreshBlocks() })
}

/* 초기 로드 + 소켓 연결 */
onMounted(async () => {
  try {
    const me = await axios.get('/api/me')
    myId.value = me.data.user?._id || null
    nickname.value = me.data.user?.nickname || ''
    const [s, r, f, b] = await Promise.all([
      axios.get('/api/friend-requests/sent'),
      axios.get('/api/friend-requests/received'),
      axios.get('/api/friends'),
      axios.get('/api/blocks')
    ])
    sentRequests.value     = s.data.map(it => ({ ...it, _isNew: false }))
    receivedRequests.value = r.data.map(it => ({ ...it, _isNew: false }))
    friends.value = f.data
    blocks.value  = b.data
    broadcastFriendsState()

    socket = connectSocket()
    if (socket) {
      socket.on('connect', () => {
        socket.emit('join', { userId: myId.value })
      })
      bindSocketHandlers()
    }

    window.addEventListener('friends:requestState', onRequestState)
  } catch (err) {
    console.log('[UI][ERR]', { page:'3_list', step:'mounted', message: err?.message || err })
  }
})

onUnmounted(() => {
  try {
    const s = getSocket()
    if (s) { s.off('friendRequest:created'); s.off('friendRequest:accepted'); s.off('friendRequest:rejected'); s.off('friendRequest:cancelled'); s.off('block:created') }
    window.removeEventListener('friends:requestState', onRequestState)
  } catch (e) {
    console.log('[UI][ERR]', { page:'3_list', step:'unmounted', message: e?.message || e })
  }
})
</script>

<style scoped>
/* ✅ 상단 고정 탭 */
.top-tabs {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 5;
  background: var(--bg-deep, #0a0a0a);
  padding: 6px 12px 10px;
  margin: 0;
  backdrop-filter: saturate(1.2) blur(2px);
  border-bottom: 1px solid var(--border, #333);
}
.top-tabs :deep(ion-segment) {
  --background: var(--panel, #141414);
  --indicator-color: var(--gold, #d4af37);
  --color: var(--ink, #f5f5f5);
  --color-checked: var(--ink, #ffffff);
  border: 1px solid var(--border, #333);
  border-radius: 10px;
  overflow: hidden;
}

/* =======================
   블랙 + 골드 다크 스타일
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
  pointer-events:none;
}

/* 리스트 */
.list-scroll{ overflow:visible; margin-top:6px; }
ul{ margin:0; padding:0; list-style:none; }

/* ✅ 행 전체 클릭 + 다크 배경 */
.row{
  position:relative; z-index:1;
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
