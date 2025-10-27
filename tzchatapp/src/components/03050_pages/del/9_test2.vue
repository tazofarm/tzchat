<!-- src/components/03050_pages/2_target.vue -->
<template>
  <ion-page>
    <ion-content fullscreen class="no-gutter">
      <ion-text v-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- ✅ SwapeList (분산 선정 결과 + Tail 빈공간 1장) -->
      <SwapeList
        v-else
        :key="swipeKey"
        :users="usersWithTail"
        :is-loading="loading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        @userClick="onCardTapById"
      />

      <!-- ✅ 확인/취소 모달 (호스트에 클래스 부여: css-class) -->
      <ion-modal
        :is-open="showResetConfirm"
        @didDismiss="cancelReset"
        :backdrop-dismiss="true"
        css-class="reset-modal"
      >
        <div class="reset-modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-title">
          <h3 id="reset-title">새로운 친구 보기</h3>
          <p class="reset-modal-text">지금 보이는 7명이 바뀝니다. 진행할까요?</p>
          <div class="reset-modal-actions">
            <button class="btn-confirm" type="button" @click="confirmReset">확인</button>
            <button class="btn-cancel"  type="button" @click="cancelReset">취소</button>
          </div>
        </div>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup>
/* -----------------------------------------------------------
   Target (스와이프형)
   - 마지막 실제 카드를 넘기면, "카드가 아닌" 빈 배경 페이지가 나오고
     그 중앙에 버튼 1개만 보이도록 구성
----------------------------------------------------------- */
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { IonPage, IonContent, IonText, IonModal } from '@ionic/vue'
import SwapeList from '@/components/02010_minipage/mini_list/swapeList.vue'
import { applyTotalFilterNormal } from '@/components/04210_Page2_target/Filter/Total_Filter_normal'
import { applyDistributedSelection } from '@/components/04210_Page2_target/Logic/distribution'
import { connectSocket, getSocket } from '@/lib/socket'

/* -----------------------------------------------------------
   상태
----------------------------------------------------------- */
const users = ref([])                 // 분산 선정된 7명
const rawServerList = ref([])         // 서버 원본(필터 전)
const currentUser = ref({})
const nickname = ref('')
const loading = ref(true)
const errorMessage = ref('')

const excludeIds = ref(new Set())
const socket = ref(null)
const viewerLevel = ref('')
const isPremium = ref(false)

/* 분산 시드 */
const seedDay = ref('')
const viewerId = ref('')
const resetIndex = ref(0)

/* 리셋 상태 */
const resetLimit = 500
const resetUsed = ref(0)
const showResetConfirm = ref(false)
const swipeKey = ref(0)

/* 라우팅 */
const router = useRouter()
const goToUserProfile = (userId) => { if (userId) router.push(`/home/user/${userId}`) }

/* ===== Tail 빈공간 더미 ===== */
const TAIL_ID = '__TAIL_EMPTY__'
const usersWithTail = computed(() => {
  const tail = { _id: TAIL_ID, nickname: '', profileImageUrl: '' }
  return [...users.value, tail]
})

/* 카드 탭 핸들러 */
function onCardTapById(userId) {
  if (userId === TAIL_ID) { openResetConfirm(); return }
  goToUserProfile(userId)
}

function isElement(node) {
  return !!(node && typeof node === 'object' && node.nodeType === 1)
}

/* ============ 리셋 로컬 상태 ============ */
function yyyymmddKST(d = new Date()) {
  const f = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  const p = f.formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {})
  return `${p.year}${p.month}${p.day}`
}
function loadResetState() {
  const key = `reco:${viewerId.value || 'anon'}:${seedDay.value || yyyymmddKST()}`
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    resetUsed.value = Number(saved.used || 0)
    resetIndex.value = Number(saved.idx || 0)
  } catch { resetUsed.value = 0; resetIndex.value = 0 }
}
function saveResetState() {
  const key = `reco:${viewerId.value || 'anon'}:${seedDay.value || yyyymmddKST()}`
  localStorage.setItem(key, JSON.stringify({ used: resetUsed.value, idx: resetIndex.value }))
}

/* ============ 분산 재선정 ============ */
function recompute(me) {
  users.value = applyDistributedSelection(rawServerList.value, me, {
    seedDay: seedDay.value,
    viewerId: viewerId.value,
    resetIndex: resetIndex.value,
    excludeIdsSet: excludeIds.value,
    applyTotalFilter: (list, meArg) => applyTotalFilterNormal(list, meArg, { log: false }),
  })
}

/* ============ 관계 로딩 ============ */
const toIdList = (arr) => (Array.isArray(arr) ? arr : [])
  .map(v => typeof v === 'object' ? (v?._id || v?.id || v?.userId || v?.user_id) : v)
  .filter(Boolean).map(String)

async function fetchRelations() {
  try {
    const [friendsRes, blocksRes, sentRes, recvRes, chatsRes] = await Promise.all([
      api.get('/api/friends'),
      api.get('/api/blocks'),
      api.get('/api/friend-requests/sent'),
      api.get('/api/friend-requests/received'),
      api.get('/api/chatrooms/partners'),
    ])
    const friends     = friendsRes?.data?.ids ?? friendsRes?.data ?? []
    const blocks      = blocksRes?.data?.ids ?? blocksRes?.data ?? []
    const pendingSent = sentRes?.data?.pendingIds ?? sentRes?.data ?? []
    const pendingRecv = recvRes?.data?.pendingIds ?? recvRes?.data ?? []
    const chatUserIds = chatsRes?.data?.ids ?? []

    excludeIds.value = new Set([
      ...toIdList(friends),
      ...toIdList(blocks),
      ...toIdList(pendingSent),
      ...toIdList(pendingRecv),
      ...toIdList(chatUserIds),
    ])

    currentUser.value = { ...currentUser.value, chatUserIds }
  } catch {
    excludeIds.value = new Set()
  }
}

/* ============ 소켓 ============ */
const sockHandlers = {
  connect: null, disconnect: null, connect_error: null,
  users_refresh: null, users_patch: null, users_last_login: null,
}
function initUsersSocket(me) {
  const s = connectSocket(); socket.value = s
  sockHandlers.connect = () => { try { s.emit('users:join', { scope: 'swipe' }) } catch {} }
  sockHandlers.disconnect = r => console.warn('[swipe][socket] disconnected:', r)
  sockHandlers.connect_error = e => console.error('[swipe][socket] connect_error:', e?.message || e)

  sockHandlers.users_refresh = (payload) => {
    rawServerList.value = Array.isArray(payload) ? payload : []
    recompute(me)
    nextTick(applyTailEmptySpace)
  }
  sockHandlers.users_patch = (u) => {
    if (!u || !u._id) return
    const i = rawServerList.value.findIndex(x => x._id === u._id)
    if (i >= 0) rawServerList.value[i] = { ...rawServerList.value[i], ...u }
    else rawServerList.value.push(u)
    recompute(me)
    nextTick(applyTailEmptySpace)
  }
  sockHandlers.users_last_login = ({ userId, last_login }) => {
    const i = rawServerList.value.findIndex(x => x._id === userId)
    if (i >= 0) { rawServerList.value[i] = { ...rawServerList.value[i], last_login }; recompute(me); nextTick(applyTailEmptySpace) }
  }

  s.on('connect', sockHandlers.connect)
  s.on('disconnect', sockHandlers.disconnect)
  s.on('connect_error', sockHandlers.connect_error)
  s.on('users:refresh', sockHandlers.users_refresh)
  s.on('users:patch', sockHandlers.users_patch)
  s.on('users:last_login', sockHandlers.users_last_login)
}

/* ============ Tail 빈공간 스킨(카드 제거 + 버튼만) ============ */
/* ✅ 인라인 스타일 제거: 색/테두리는 CSS(.tail-empty-slide)에서 통일 관리 */
let tailButtonHandler = null
let tailRetryTimer = null
function buildTail(last) {
  if (!isElement(last)) return
  const btn = last.querySelector('.tail-reset-button')
  if (btn) {
    const cnt = btn.querySelector('.cnt')
    if (cnt) cnt.textContent = `(${resetUsed.value}/${resetLimit})`
    return
  }

  // 마지막 슬라이드를 "빈공간"처럼 만들기 (클래스만 부여)
  last.classList.add('tail-empty-slide')

  // 기존 자식 숨김
  ;[...last.children].forEach(ch => ch.classList.add('tail-hide'))

  // 버튼만 중앙에 추가
  const wrap = document.createElement('div')
  wrap.className = 'tail-overlay'
  wrap.innerHTML = `
    <button type="button" class="tail-reset-button" aria-label="새로운 친구 보기">
      새로운 친구 보기 <span class="cnt">(${resetUsed.value}/${resetLimit})</span>
    </button>
  `
  last.appendChild(wrap)

  // 버튼 클릭 → 모달
  const buttonEl = wrap.querySelector('.tail-reset-button')
  if (tailButtonHandler) buttonEl?.removeEventListener('click', tailButtonHandler)
  tailButtonHandler = (e) => { e.stopPropagation(); openResetConfirm() }
  buttonEl?.addEventListener('click', tailButtonHandler, { passive: true })
}

function getLastSlideEl() {
  return document.querySelector('.swiper-wrapper .swiper-slide:last-child')
}

function tryBuildTail(maxTries = 12, interval = 60) {
  let tries = 0
  clearInterval(tailRetryTimer)
  tailRetryTimer = setInterval(() => {
    const last = getLastSlideEl()
    if (last) {
      buildTail(last)
      clearInterval(tailRetryTimer)
    }
    if (++tries >= maxTries) clearInterval(tailRetryTimer)
  }, interval)
}

function applyTailEmptySpace() {
  const last = getLastSlideEl()
  if (isElement(last)) buildTail(last)
  tryBuildTail()
}

/* 리스트/키/카운트 변경, 창 크기 변경 시 Tail 유지 */
watch([usersWithTail, swipeKey, resetUsed], () => nextTick(applyTailEmptySpace))
window.addEventListener('resize', applyTailEmptySpace)

/* ============ 리셋 모달/동작 ============ */
function openResetConfirm() {
  if (resetUsed.value >= resetLimit || loading.value) return
  showResetConfirm.value = true
}
function cancelReset() { showResetConfirm.value = false }
async function confirmReset() {
  showResetConfirm.value = false
  if (resetUsed.value >= resetLimit) return
  resetUsed.value += 1
  resetIndex.value += 1
  saveResetState()
  recompute(currentUser.value)
  await nextTick()
  swipeKey.value += 1
  await nextTick(applyTailEmptySpace)
}

/* -----------------------------------------------------------
   Mount
----------------------------------------------------------- */
onMounted(async () => {
  try {
    const me = (await api.get('/api/me')).data.user
    currentUser.value = me
    nickname.value = me?.nickname || ''
    viewerId.value = String(me?._id || '')

    seedDay.value = yyyymmddKST()
    loadResetState()

    const lvl = me?.level || me?.user_level || me?.membership || ''
    viewerLevel.value = String(lvl || '').trim()
    isPremium.value = Boolean(me?.isPremium ?? me?.premium ?? (viewerLevel.value === '프리미엄회원'))

    await fetchRelations()

    const regionFilter = me.search_regions || []
    const res = await api.post('/api/search/users', { regions: regionFilter })
    rawServerList.value = Array.isArray(res.data) ? res.data
                          : Array.isArray(res.data?.users) ? res.data.users
                          : []
    recompute(me)

    initUsersSocket(me)
    await nextTick(applyTailEmptySpace)
  } catch (e) {
    console.error('❌ 초기 로딩 실패:', e)
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  try {
    const s = getSocket()
    if (s) {
      try { s.emit('users:leave', { scope: 'swipe' }) } catch {}
      if (sockHandlers.connect)          s.off('connect', sockHandlers.connect)
      if (sockHandlers.disconnect)       s.off('disconnect', sockHandlers.disconnect)
      if (sockHandlers.connect_error)    s.off('connect_error', sockHandlers.connect_error)
      if (sockHandlers.users_refresh)    s.off('users:refresh', sockHandlers.users_refresh)
      if (sockHandlers.users_patch)      s.off('users:patch', sockHandlers.users_patch)
      if (sockHandlers.users_last_login) s.off('users:last_login', sockHandlers.users_last_login)
    }
  } catch (e) {
    console.error('❌ 소켓 정리 실패:', e)
  } finally {
    clearInterval(tailRetryTimer)
    window.removeEventListener('resize', applyTailEmptySpace)
  }
})
</script>

<style scoped>
/* 기본 레이아웃 */
.no-gutter{
  --background:#000;
  --padding-start:0; --padding-end:0; --padding-top:0; --padding-bottom:0;
  --ion-safe-area-top:0; --ion-safe-area-bottom:0; --ion-safe-area-left:0; --ion-safe-area-right:0;
  padding:0 !important; margin:0 !important; color:#fff; overscroll-behavior:none;
}
.no-gutter :deep(.inner-scroll),
.no-gutter :deep(.scroll-content),
.no-gutter :deep(.content-scroll){ padding:0 !important; margin:0 !important; }

/* ⭐ 마지막 빈공간 슬라이드 색상/테두리/레이아웃은 여기서 변경하세요 */
:deep(.tail-empty-slide){
  background: #121214 !important;          /* ← 원하는 배경색으로 수정 */
  border: 10px solid #3a3a3f !important;   /* ← 원하는 테두리 색/두께로 수정 */
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,.5);
  min-height: 100dvh;
  width: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 0 !important; margin: 0 !important;
}

/* 마지막 슬라이드의 기존 콘텐츠는 모두 숨김 */
:deep(.tail-hide){
  visibility: hidden !important;
  pointer-events: none !important;
}

/* 중앙 버튼 오버레이 */
:deep(.tail-overlay){
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
}
:deep(.tail-reset-button){
  padding: 240px 90px; border-radius: 10px;
  border: 10px solid #545458; background: #111114; color: #e7e7ea;
  font-weight: 700; cursor: pointer; user-select: none;
  box-shadow: 0 8px 24px rgba(0,0,0,.45);
}
:deep(.tail-reset-button:active){ transform: scale(.98); }
:deep(.tail-reset-button .cnt){ font-weight: 500; color:#bdbdc2; margin-left:6px; }

.reset-modal-text{ margin:10px 0 18px; color:#bdbdc2; }
.reset-modal-actions{ display:flex; gap:10px; justify-content:flex-end; }
.btn-confirm,.btn-cancel{
  padding:8px 12px;
  border-radius:10px;
  border:1px solid #2a2a2e;
  background:#111114;
  color:#e7e7ea;
  cursor:pointer;
}
.btn-confirm{ background:#2a2a2e; }
.btn-confirm:focus,.btn-cancel:focus{ outline:2px solid #3a3a3f; outline-offset:2px; }
</style>

<!-- ✅ 모달 전역 스타일: scoped 없이 별도 블록 -->
<style>
/* 모달 호스트에 부여한 클래스 기준으로 파트/컨텐츠 타겟팅 */
ion-modal.reset-modal::part(backdrop){ background: rgba(0,0,0,.55); }
ion-modal.reset-modal::part(content){ --background: transparent; }

/* 모달 내부 카드 색상 */
ion-modal.reset-modal .reset-modal-card{
  width:min(88vw,420px); margin:10vh auto;
  background:#d9d9d9 !important;  /* 카드 회색 */
  color:#111 !important;
  border:1px solid #999;
  border-radius:14px; padding:18px;
  box-shadow:0 10px 30px rgba(0,0,0,.25);
}
</style>
