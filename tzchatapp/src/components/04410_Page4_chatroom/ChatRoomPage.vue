<template>
  <ion-page>
    <!-- 상단 고정 헤더 -->
    <ion-header :translucent="true">
      <ion-toolbar class="chat-toolbar">
        <div class="chatroom-header" @click="closeEmojiIfOpen">
          <span class="chat-title" @click="goToPartnerProfile">{{ partnerNickname }} 님과의 대화</span>
          <ion-button size="small" fill="clear" @click="goBack" aria-label="뒤로가기">나가기</ion-button>
        </div>
      </ion-toolbar>
    </ion-header>

    <!-- 본문: 메시지 스크롤 + 하단 입력창(플로우) -->
    <ion-content class="chat-content">
      <div class="chatroom-container">
        <!-- 메시지 리스트 (내부 스크롤 전담) -->
        <div
          class="chat-messages"
          ref="chatScroll"
          @scroll.passive="scheduleMarkAsRead(250)"
          @click="closeEmojiIfOpen"
        >
          <div
            v-for="item in displayItems"
            :key="item._id"
            class="message-row"
            :class="{ mine: item.type==='message' && isMine(item) }"
          >
            <!-- 날짜 구분선 -->
            <template v-if="item.type === 'divider'">
              <div class="date-divider" role="separator" :aria-label="`타임라인 ${item.label}`">
                <span class="date-chip">{{ item.label }}</span>
              </div>
            </template>

            <!-- 내 메시지 -->
            <template v-else-if="isMine(item)">
              <div class="my-message">
                <div class="bubble-row mine-row">
                  <span
                    v-if="item._meta?.showTime && !isReadByPartner(item)"
                    class="read-flag"
                    aria-label="상대가 아직 읽지 않음"
                  >안읽음</span>
                  <span v-if="item._meta?.showTime" class="time right-time">{{ formatTime(item.createdAt) }}</span>

                  <div class="bubble my-bubble">
                    <template v-if="item.imageUrl">
                      <img :src="getImageUrl(item.imageUrl)" class="chat-image" @click="openImage(getImageUrl(item.imageUrl))" />
                    </template>
                    <template v-else>
                      {{ item.content }}
                    </template>
                  </div>
                </div>
              </div>
            </template>

            <!-- 상대 메시지 -->
            <template v-else>
              <div class="other-message">
                <div
                  v-if="item._meta?.showAvatarName"
                  class="avatar-col"
                  @click="goToPartnerProfile"
                  role="button"
                  aria-label="상대 프로필 보기"
                >
                  <ProfilePhotoViewer
                    v-if="partnerId"
                    :userId="partnerId"
                    :gender="partnerGender"
                    :size="AVATAR_SIZE"
                  />
                  <div v-else class="avatar-fallback">{{ partnerNickname.charAt(0) || '상' }}</div>
                </div>
                <div v-else class="avatar-spacer" />

                <div class="content-col">
                  <div class="name-line" v-if="item._meta?.showAvatarName">
                    <span class="name" @click="goToPartnerProfile">{{ partnerNickname }}</span>
                  </div>
                  <div class="bubble-row">
                    <div class="bubble other-bubble">
                      <template v-if="item.imageUrl">
                        <img :src="getImageUrl(item.imageUrl)" class="chat-image" @click="openImage(getImageUrl(item.imageUrl))" />
                      </template>
                      <template v-else>
                        {{ item.content }}
                      </template>
                    </div>
                    <span v-if="item._meta?.showTime" class="time right-time">{{ formatTime(item.createdAt) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 하단 입력창 (플로우 하단) -->
        <div class="chat-input-wrapper" ref="composerWrapperRef">
          <div v-if="showEmoji" class="emoji-picker-wrapper" @click.stop>
            <emoji-picker @emoji-click="insertEmoji"></emoji-picker>
          </div>

          <div class="chat-input" @click.stop>
            <ion-button size="small" fill="outline" class="icon-btn" @click="triggerFileInput" aria-label="파일 첨부">📎</ion-button>
            <input type="file" accept="image/*" ref="fileInput" style="display: none" @change="uploadImage" />
            <ion-button
              size="small"
              fill="outline"
              class="icon-btn"
              @click="toggleEmoji"
              aria-label="이모지 선택"
            >😊</ion-button>

            <!-- textarea 자동 높이 & 최대 높이 동적 제한 -->
            <textarea
              ref="textareaRef"
              v-model="newMessage"
              placeholder="메시지를 입력하세요"
              @keydown="handleKeydown"
              @input="autoResizeComposer"
              rows="1"
              autocomplete="off"
              autocorrect="on"
              spellcheck="true"
            ></textarea>

            <ion-button
              size="small"
              color="primary"
              aria-label="전송"
              @mousedown.prevent
              @touchstart.prevent
              @click="sendMessage"
            >전송</ion-button>
          </div>
        </div>
      </div>

      <!-- 이미지 확대 팝업 -->
      <transition name="fade">
        <div
          v-if="enlargedImage"
          class="image-modal"
          role="dialog"
          aria-modal="true"
          aria-label="이미지 보기"
          tabindex="-1"
          @click.self="closeImageModal"
          @keyup.esc="closeImageModal"
        >
          <div class="image-wrapper">
            <button class="close-button" @click="closeImageModal" aria-label="닫기">×</button>
            <img :src="enlargedImage" class="modal-image" @click.stop />
          </div>
        </div>
      </transition>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { IonPage, IonHeader, IonToolbar, IonContent, IonButton } from '@ionic/vue'
import { Keyboard } from '@capacitor/keyboard'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/lib/api'
import { connectSocket, getSocket } from '@/lib/socket'
import ProfilePhotoViewer from '@/components/02010_minipage/mini_profile/ProfilePhotoViewer.vue'

const route = useRoute()
const router = useRouter()

const roomId = String(route.params.id || '')
let socket = null

const myId = ref('')
const partnerId = ref('')
const partnerNickname = ref('상대방')
const partnerGender = ref('')

const AVATAR_SIZE = 40

const messages = ref([])
const newMessage = ref('')
const chatScroll = ref(null)
const textareaRef = ref(null)
const composerWrapperRef = ref(null)
const showEmoji = ref(false)
const fileInput = ref(null)
const enlargedImage = ref('')

// ===== 유틸 =====
const pad2 = (n)=> String(n).padStart(2,'0')
const minuteKey = (d) => { const t=new Date(d); return `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}` }
const toLocalYMD = (d) => { const t=new Date(d); return `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}` }
const formatKDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'long' })
const formatTime=(iso)=> new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})

// ===== 포커스 헬퍼 =====
const focusComposer = async (delay = 0) => {
  await nextTick()
  window.setTimeout(() => {
    const el = textareaRef.value
    if (el) {
      el.focus()
      const len = el.value?.length ?? 0
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(len, len)
    }
  }, delay)
}

// 판별
const isMine = (msg)=> !!(msg?.sender && (msg.sender._id===myId.value || msg.sender===myId.value))
const isReadByPartner = (msg)=> partnerId.value && (msg?.readBy||[]).some(id=>String(id)===String(partnerId.value))

// ===== 렌더 배열(날짜 + 그룹 메타) =====
const displayItems = computed(() => {
  const out = []
  let lastYmd = null
  const list = messages.value
  const sameMinute = (a,b)=> a && b && (minuteKey(a.createdAt||a._id)===minuteKey(b.createdAt||b._id))

  for (let i=0; i<list.length; i++){
    const m = list[i]
    const created = m.createdAt || m._id
    const ymd = toLocalYMD(created)

    if (ymd !== lastYmd) {
      out.push({_id:`divider-${ymd}`, type:'divider', label:formatKDate(created)})
      lastYmd = ymd
    }

    const prev = list[i-1]
    const next = list[i+1]
    const meta = {}

    if (isMine(m)) {
      const nextMine = next && isMine(next)
      const groupWithNext = nextMine && sameMinute(m,next)
      meta.showTime = !groupWithNext
    } else {
      const prevOther = prev && !isMine(prev)
      const nextOther = next && !isMine(next)
      const groupWithPrev = prevOther && sameMinute(prev,m)
      const groupWithNext = nextOther && sameMinute(m,next)
      meta.showAvatarName = !groupWithPrev
      meta.showTime = !groupWithNext
    }

    out.push({ ...m, type:'message', _meta: meta })
  }
  return out
})

// 이미지/모달
const openImage = (url)=>{ enlargedImage.value=url; requestAnimationFrame(()=>document.querySelector('.image-modal')?.focus()) }
const closeImageModal = ()=>{ enlargedImage.value='' }
const getImageUrl = (path)=>{
  if(!path) return ''
  if(/^https?:\/\//.test(path)) return path
  const base=window.location.origin.replace(/\/+$/,'')
  const p=String(path).startsWith('/')?path:`/${path}`
  return `${base}${p}`
}

// 데이터 로딩
const loadMessages = async ()=>{
  const res = await axios.get(`/api/chatrooms/${roomId}`)
  messages.value = res.data.messages || []
  myId.value = res.data.myId
  const partner = res.data.participants?.find?.(p=>String(p._id)!==String(myId.value))
  partnerNickname.value = partner?.nickname || '상대방'
  partnerId.value = partner?._id || ''
  partnerGender.value = partner?.gender || ''
  await nextTick(); scrollToBottom(); scheduleMarkAsRead()
}

// 전송
const sendMessage = async ()=>{
  const content=newMessage.value.trim()
  if(!content) return
  const res = await axios.post(`/api/chatrooms/${roomId}/message`,{content,type:'text'})
  newMessage.value=''
  getSocket()?.emit('chatMessage',{roomId,message:res.data})
  pushMessageSafe({...res.data,createdAt:res.data.createdAt||new Date().toISOString()})
  scrollToBottom()
  showEmoji.value = false
  await focusComposer(0)
}

// 업로드
const MAX_SIZE=10*1024*1024
const ACCEPTED=['image/png','image/jpeg','image/webp','image/gif']
const validateImage=(f)=>ACCEPTED.includes(f.type)&&f.size<=MAX_SIZE
const uploadImage=async(e)=>{
  const file=e.target.files?.[0]; if(!file) return
  if(!validateImage(file)){ e.target.value=''; return }
  const formData=new FormData(); formData.append('image',file)
  const up=await axios.post(`/api/chatrooms/${roomId}/upload-image`,formData,{headers:{'Content-Type':'multipart/form-data'},withCredentials:true})
  const relativePath=up.data?.relativePath||up.data?.imageUrl
  const msg=await axios.post(`/api/chatrooms/${roomId}/message`,{content:relativePath,type:'image'},{withCredentials:true})
  getSocket()?.emit('chatMessage',{roomId,message:msg.data})
  pushMessageSafe({...msg.data,createdAt:msg.data.createdAt||new Date().toISOString()})
  scrollToBottom(); e.target.value=''
  showEmoji.value = false
  await focusComposer(0)
}

// 붙여넣기
const onPaste=async(e)=>{
  const items=e.clipboardData?.items||[]
  for(const it of items){
    if(it.kind==='file'){
      const f=it.getAsFile()
      if(f && validateImage(f)){
        const form=new FormData(); form.append('image',f)
        const up=await axios.post(`/api/chatrooms/${roomId}/upload-image`,form,{headers:{'Content-Type':'multipart/form-data'},withCredentials:true})
        const relativePath=up.data?.relativePath||up.data?.imageUrl
        const msg=await axios.post(`/api/chatrooms/${roomId}/message`,{content:relativePath,type:'image'},{withCredentials:true})
        getSocket()?.emit('chatMessage',{roomId,message:msg.data})
        pushMessageSafe({...msg.data,createdAt:msg.data.createdAt||new Date().toISOString()})
        scrollToBottom(); e.preventDefault()
        showEmoji.value = false
        await focusComposer(0)
        break
      }
    }
  }
}

const closeEmojiIfOpen = async ()=>{
  if(showEmoji.value){
    showEmoji.value=false
    await focusComposer(0)
  }
}

const toggleEmoji = ()=>{
  showEmoji.value = !showEmoji.value
  if (showEmoji.value) {
    requestAnimationFrame(autoResizeComposer)
  } else {
    requestAnimationFrame(() => textareaRef.value?.focus())
  }
}

const handleKeydown=(e)=>{
  if(e.key==='Enter' && !e.shiftKey){
    e.preventDefault()
    sendMessage()
  }
}
const triggerFileInput=()=>fileInput.value?.click()
const insertEmoji=(ev)=>{
  const emoji=ev?.detail?.unicode||''
  if(emoji){
    newMessage.value+=emoji
    requestAnimationFrame(()=>textareaRef.value?.focus())
    autoResizeComposer()
  }
}
const scrollToBottom=async()=>{ await nextTick(); const el=chatScroll.value; if(el) el.scrollTop=el.scrollHeight }

// 읽음 처리
let readTimer=null
const scheduleMarkAsRead=(delay=200)=>{ if(readTimer) clearTimeout(readTimer); readTimer=setTimeout(markAsReadNow,delay) }
const markAsReadNow=async()=>{ try{ if(!roomId||!myId.value) return; const r=await axios.put(`/api/chatrooms/${roomId}/read`); const ids=r?.data?.updatedMessageIds||[]; if(!ids.length) return; for(const m of messages.value){ if(ids.includes(m._id)){ const arr=m.readBy||[]; if(!arr.includes(myId.value)) m.readBy=[...arr,myId.value] } } getSocket()?.emit('messagesRead',{roomId,readerId:myId.value,messageIds:ids}) }catch(e){} }

// 중복 방지
const seenMsgIds=new Set()
const pushMessageSafe=(m)=>{ const id=m?._id; if(!id||seenMsgIds.has(id)) return; seenMsgIds.add(id); messages.value.push(m); if(seenMsgIds.size>1000){ const fid=messages.value[0]?._id; if(fid) seenMsgIds.delete(fid) } }

// ===== [키보드] 가상 키보드 대응 =====
let removeKeyboardListeners = null
let vv = null
let baseVh = 0
let kbOpen = false

const setCssVar = (name, value) => document.documentElement.style.setProperty(name, value)

// textarea 자동 리사이즈 (+ 최대 높이 제한) + 입력창 높이 반영
const autoResizeComposer = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const line = Math.max(32, Math.min(el.scrollHeight, getComposerMaxPx()))
  el.style.height = line + 'px'
  updateComposerHeight()
}

// 입력창 wrapper 실제 높이를 CSS 변수로 반영 → 리스트 하단 여백으로 사용
const updateComposerHeight = () => {
  const wrap = composerWrapperRef.value
  if (!wrap) return
  const h = Math.round(wrap.getBoundingClientRect().height)
  setCssVar('--composer-h', `${h}px`)
}

const COMPOSER_MAX_CLOSED = 120
const COMPOSER_MAX_OPEN_RATIO = 0.33

const getComposerMaxPx = () => {
  const vh = Number(getComputedStyle(document.documentElement).getPropertyValue('--vh').replace('px','')) || window.innerHeight
  return kbOpen ? Math.round(vh * COMPOSER_MAX_OPEN_RATIO) : COMPOSER_MAX_CLOSED
}

const updateKeyboardState = (kbHeightPx = 0) => {
  kbOpen = kbHeightPx > 0
  setCssVar('--kb', kbOpen ? `${kbHeightPx}px` : '0px')
  setCssVar('--composer-max', `${getComposerMaxPx()}px`)
  // 키보드 상태에 따른 홈바 여유 패딩 (열린다음 메세지와 키보드 사이 간격 앞쪽 4가 그거야)
  setCssVar('--homebar-pad', kbOpen ? '4px' : '80px')
  updateComposerHeight()
  scrollToBottom()
}

// visualViewport 기반 추정
const handleViewportResize = () => {
  if (!vv) return
  const current = Math.round(vv.height)
  setCssVar('--vh', `${current}px`)
  const SLOP = 8
  const kbHeight = Math.max(0, Math.round(baseVh - current) + SLOP)
  updateKeyboardState(kbHeight)
}

onMounted(async()=>{
  socket=connectSocket()
  window.addEventListener('paste', onPaste)
  await loadMessages()

  // onMounted 내부 초기 설정 부분
  setCssVar('--kb','0px')
  setCssVar('--composer-max','110px')
  setCssVar('--vh', `${window.innerHeight}px`)
  setCssVar('--homebar-pad','80px')  // ⬅️ 키보드 닫힘 기본값
  updateComposerHeight()

  // Capacitor Keyboard: 웹뷰 리사이즈 방식 (화면을 키보드 높이만큼 줄임)
  try {
    await Keyboard.setResizeMode({ mode: 'native' })
    await Keyboard.setScroll({ isDisabled: true })
  } catch (e) {}

  // visualViewport 리스너
  if (window.visualViewport) {
    vv = window.visualViewport
    baseVh = Math.round(vv.height)
    vv.addEventListener('resize', handleViewportResize)
    vv.addEventListener('scroll', handleViewportResize)
  } else {
    baseVh = window.innerHeight
    const onResize = () => {
      setCssVar('--vh', `${window.innerHeight}px`)
      const kbHeight = Math.max(0, baseVh - window.innerHeight)
      updateKeyboardState(kbHeight)
    }
    window.addEventListener('resize', onResize)
  }

  // Capacitor Keyboard 이벤트
  try {
    const listeners = []
    listeners.push(await Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      updateKeyboardState(Math.round(keyboardHeight || 0))
    }))
    listeners.push(await Keyboard.addListener('keyboardWillHide', () => {
      updateKeyboardState(0)
    }))
    listeners.push(await Keyboard.addListener('keyboardDidShow', ({ keyboardHeight }) => {
      updateKeyboardState(Math.round(keyboardHeight || 0))
    }))
    listeners.push(await Keyboard.addListener('keyboardDidHide', () => {
      updateKeyboardState(0)
    }))
    removeKeyboardListeners = () => listeners.forEach(l => l?.remove?.())
  } catch (e) {}

  socket.emit('joinRoom',roomId)
  socket.on('chatMessage',(msg)=>{
    const message=msg?.message||msg
    const inSameRoom = msg?.roomId===roomId || msg?.chatRoom===roomId || msg?.chatRoom?._id===roomId || message?.chatRoom===roomId || message?.chatRoom?._id===roomId
    if(!inSameRoom) return
    if(!message.createdAt) message.createdAt=new Date().toISOString()
    pushMessageSafe(message); scrollToBottom()
    if(!isMine(message)) scheduleMarkAsRead(250)
  })
  socket.on('messagesRead',({roomId:rid,readerId,messageIds}={})=>{
    if(String(rid)!==String(roomId)) return
    if(!readerId || !Array.isArray(messageIds) || !messageIds.length) return
    for(const m of messages.value){
      if(!isMine(m)) continue
      if(!messageIds.includes(m._id)) continue
      const arr=m.readBy||[]; if(!arr.includes(readerId)) m.readBy=[...arr,readerId]
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
  if (vv) {
    vv.removeEventListener('resize', handleViewportResize)
    vv.removeEventListener('scroll', handleViewportResize)
  }
  removeKeyboardListeners?.()
  setCssVar('--kb','0px')
  setCssVar('--composer-max','110px')
  setCssVar('--homebar-pad','80px') // ⬅️ 리셋(선택)
})


watch(messages,()=>{ scrollToBottom(); scheduleMarkAsRead(250) },{deep:true})
watch(showEmoji, async ()=>{ await nextTick(); updateComposerHeight() })

// 네비게이션
const goBack=()=>router.push('/home/4page')
const goToPartnerProfile=()=>{ if(partnerId.value) router.push(`/home/user/${partnerId.value}`) }
</script>

<style scoped>
/* 상단 여백 강제 제거: 헤더를 최상단으로 붙임 */
:deep(ion-header){ padding-top:0 !important; --ion-safe-area-top:0px; }
:deep(ion-toolbar){ --padding-top:0 !important; --min-height:44px; }




/* ion-content 내부 여백 제거 & 키보드 리사이즈 반영 */
.chat-content {
  --padding-top: 0px;
  --padding-bottom: 0px;
  display: flex;
  flex-direction: column;
  height: auto;
  flex: 1;
  background: var(--page-bg, #0b0b0b);
}

/* 컨테이너는 flex column으로 전체 영역 차지 */
.chatroom-container{
  display:flex; flex-direction:column;
  height:100%; min-height:100%;
  width:100%;
  overflow:hidden;

  --gold-500:#d4af37; --gold-400:#e0be53; --black-900:#0b0b0b;
  --color-text:#000; --color-muted:#9aa0a6;
  --page-bg:#0b0b0b; --section-bg:#0b0b0b;
  --bubble-other:#f1f3f4; --bubble-me:#ffefb3;
  --radius:10px; --radius-lg:14px;
  --gap-xxs:4px; --gap-xs:6px; --gap-sm:6px; --gap-md:10px;
  --fz-base:13px; --fz-time:11px; --fz-title:14px;
}

/* Header 를 더 위로 밀착 */
.chat-toolbar{
  --background: #0b0b0b;
  --border-color: rgba(255,255,255,.06);
  --min-height: 44px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.chatroom-header {
  display:flex; align-items:center; gap:var(--gap-sm);
  height:44px; padding: var(--gap-md);
  background:#0b0b0b;
  box-sizing:border-box;
  /* 상단 여백 제거 */
  /* padding-top: calc(env(safe-area-inset-top, 0px) - 0px); */
}
.chatroom-header ion-button{
  --padding-start:6px; --padding-end:6px; --border-radius:8px; --color:var(--gold-500);
  --background:transparent; --border-color:transparent;
  min-height:30px; font-size:16px; margin-left:auto;
}
.chat-title{
  font-weight:800;
  letter-spacing:.2px;
  color:var(--gold-500);
  font-size:16px; /* 🔹글씨 크기 키움 (기존 var(--fz-title) ≈ 14px) */
  line-height:2.15;
  cursor:pointer;
  margin-left:8px;
}
/* Messages (inner scroll) */
.chat-messages{
  flex:1 1 0; min-height:0;
  overflow:auto; -webkit-overflow-scrolling:touch;
  padding: var(--gap-md);
  /* 리스트 바닥 여백 = 실제 입력창 높이만큼 확보 (키보드 높이 추가 금지) */
  padding-bottom: 4px; /* 또는 0px */
  background:var(--section-bg);
  scrollbar-gutter:stable;
  overscroll-behavior: contain;
  touch-action: manipulation;
}
.chat-messages::-webkit-scrollbar{ width:6px; height:6px; }

.message-row{ margin-bottom:var(--gap-xs); }

.other-message,.my-message{ display:flex; gap:var(--gap-xxs); }
.my-message{ width:100%; justify-content:flex-end; align-items:flex-end; }
.other-message{ justify-content:flex-start; align-items:flex-start; }

.avatar-col,
.avatar-spacer{
  width:var(--avatar-size, 40px); min-width:var(--avatar-size, 40px); height:var(--avatar-size, 40px);
  margin-right:6px; margin-top:var(--avatar-offset-y, 8px);
}
.avatar-col{
  display:flex; align-items:center; justify-content:center;
  border-radius:var(--avatar-radius, 50%); overflow:hidden;
  border:1px solid rgba(255,255,255,0.12); background:rgba(212,175,55,0.10);
  cursor:pointer;
}
.avatar-fallback{ width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#222; color:#eee; font-weight:800; font-size:12px; }
.avatar-col :deep(.viewer-host){ width:100%; height:100%; }
.avatar-col :deep(.avatar){ width:100%!important; height:100%!important; object-fit:cover; border-radius:0!important; box-shadow:none!important; pointer-events:none; }

.content-col{ display:flex; flex-direction:column; max-width:min(78%,560px); }
.name-line{ margin:0 0 2px 4px; }
.name{ font-size:11px; color:#cfcfcf; letter-spacing:.2px; user-select:none; }
.name:hover{ text-decoration:underline; cursor:pointer; }

.bubble-row{ display:flex; align-items:flex-end; gap:6px; }
.bubble-row.mine-row{ justify-content:flex-end; }
.bubble{
  max-width:100%; padding:6px 10px; border-radius:var(--radius);
  background-color:#fff; color:var(--color-text);
  word-break:break-word; white-space:pre-wrap;
  font-size:var(--fz-base); line-height:1.4;
  box-shadow:0 1px 0 rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.06);
}
.other-bubble{ background:var(--bubble-other); }
.my-bubble{ background:var(--bubble-me); border-color:#f6e6ad; }

.chat-image{ max-width:150px; max-height:150px; border-radius:10px; cursor:pointer; display:block; box-shadow:0 1px 0 rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.06); }

.time{ font-size:var(--fz-time); color:#9aa0a6; white-space:nowrap; user-select:none; }
.right-time{ align-self:flex-end; margin:0 0 2px 2px; }
.read-flag{
  font-size:var(--fz-time); color:#1f1f1f; background:#fff3f3; border:1px solid #ffc9c9;
  border-radius:999px; padding:2px 6px; margin-left:4px; line-height:1.3; user-select:none;
}

/* 날짜 구분선 — 왼쪽 정렬 */
.date-divider{
  display:flex; align-items:center; justify-content:flex-start; gap:60px; margin:10px 0;
}
.date-divider::before{ content:""; flex:0 0 36px; }
.date-chip{
  font-size:12px; color:#e6c766; background:rgba(230,199,102,0.08);
  border:1px solid rgba(230,199,102,0.35); border-radius:999px; padding:4px 10px; line-height:1.2;
}

/* 홈바 여유패딩을 변수로 치환: 키보드 상태에 따라 JS에서 갱신 */
.chat-input-wrapper {
  position: sticky;
  bottom: 0;
  z-index: 3;
  background: var(--page-bg);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  /* 키보드 닫힘(80px) / 열림(8px) 을 JS에서 --homebar-pad로 제어 */
  padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--homebar-pad, 80px));
}

.chat-input{
  display:grid; grid-template-columns:auto auto 1fr auto; align-items:end; gap:var(--gap-sm);
  padding:8px var(--gap-md);              /* ⬅️ 내부 여백 소폭 ↑ */
  background:var(--page-bg); box-sizing:border-box;
}


.chat-input ion-button.icon-btn{ --padding-start:4px; --padding-end:4px; width:34px; min-width:34px; font-size:16px; --border-color:var(--gold-500); --background:transparent; --background-hover:#1a1a1a; }
.chat-input ion-button[fill="outline"]{ --border-color:var(--gold-500); --color:#fff; --background:transparent; --background-hover:#1a1a1a; --border-radius:9px; min-height:26px; font-size:13px; border:1px solid var(--gold-500); }
.chat-input ion-button[color="primary"]{ --background:var(--gold-500); --color:#111; --border-radius:10px; min-height:26px; }

.chat-input textarea{
  flex:1 1 auto; padding:6px 8px; border:1.5px solid #333; border-radius:9px; margin:0;
  font-size:var(--fz-base); background:#ffffff; color:#000000; resize:none; line-height:1.4;
  min-height:32px;
  max-height: var(--composer-max, 110px);
  box-shadow:0 0 0 2px rgba(212,175,55,0.08);
}
.chat-input textarea::placeholder{ color:#7a7a7a; }
.chat-input textarea:focus{ outline:none; box-shadow:0 0 0 2px rgba(212,175,55,0.35); border-color:var(--gold-500); }

/* 이모지 피커 */
.emoji-picker-wrapper{
  position:absolute; left:var(--gap-md);
  bottom: calc(100% + 8px);
  z-index:999; background:#111; border:1px solid var(--gold-500);
  border-radius:var(--radius-lg); overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,.5);
}

/* Modal */
.image-modal{
  position: fixed; inset: 0; z-index: 9999;
  display:flex; align-items:center; justify-content:center;
  background: rgba(0,0,0,.72);
}
.image-wrapper{
  position: relative; max-width: 92vw; max-height: 82vh;
  display:flex; align-items:center; justify-content:center;
}
.modal-image{
  max-width: 100%; max-height: 100%; border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.5);
}
.close-button{
  position:absolute; top:-10px; right:-10px; width:32px; height:32px;
  border:none; border-radius:50%; background:#000; color:#fff; font-size:20px;
  display:flex; align-items:center; justify-content:center; cursor:pointer;
}
</style>
