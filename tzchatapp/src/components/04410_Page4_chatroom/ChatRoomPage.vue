<template> 
  <div class="chatroom-container">
    <!-- 상단바 (전역 헤더 아래 sticky) -->
    <div class="chatroom-header" @click="closeEmojiIfOpen">
      <span class="chat-title" @click="goToPartnerProfile">{{ partnerNickname }} 님과의 대화</span>
      <ion-button size="small" fill="clear" @click="goBack" aria-label="뒤로가기">←뒤로</ion-button>
    </div>

    <!-- 메시지 리스트 -->
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
        <!-- 날짜 구분선 (⬅ 왼쪽 정렬) -->
        <template v-if="item.type === 'divider'">
          <div class="date-divider" role="separator" :aria-label="`타임라인 ${item.label}`">
            <span class="date-chip">{{ item.label }}</span>
          </div>
        </template>

        <!-- ░ 내 메시지 (오른쪽 정렬, 그룹 마지막만 시간/안읽음) ░ -->
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

        <!-- ░ 상대 메시지 (아바타/닉네임은 그룹 첫 메시지만, 시간은 마지막만) ░ -->
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

    <!-- 입력창 -->
    <div class="chat-input-wrapper">
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

        <textarea
          ref="textareaRef"
          v-model="newMessage"
          placeholder="메시지를 입력하세요"
          @keydown="handleKeydown"
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

    <!-- 이미지 확대 팝업 (화면 중앙 고정, 입력바 위로 뜸) -->
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
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { IonButton } from '@ionic/vue'
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
const showEmoji = ref(false)
const fileInput = ref(null)
const enlargedImage = ref('')

/* ===== 유틸 ===== */
const pad2 = (n)=> String(n).padStart(2,'0')
const minuteKey = (d) => { const t=new Date(d); return `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}` }
const toLocalYMD = (d) => { const t=new Date(d); return `${t.getFullYear()}-${pad2(t.getMonth()+1)}-${pad2(t.getDate())}` }
const formatKDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'long' })
const formatTime=(iso)=> new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})

/** 포커스 헬퍼: 모바일에서 전송/토글 뒤 키보드 유지 */
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

/* 판별 */
const isMine = (msg)=> !!(msg?.sender && (msg.sender._id===myId.value || msg.sender===myId.value))
const isReadByPartner = (msg)=> partnerId.value && (msg?.readBy||[]).some(id=>String(id)===String(partnerId.value))

/* ===== 렌더 배열(날짜 + 그룹 메타) ===== */
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

/* 이미지/모달 */
const openImage = (url)=>{ enlargedImage.value=url; requestAnimationFrame(()=>document.querySelector('.image-modal')?.focus()) }
const closeImageModal = ()=>{ enlargedImage.value='' }
const getImageUrl = (path)=>{
  if(!path) return ''
  if(/^https?:\/\//.test(path)) return path
  const base=window.location.origin.replace(/\/+$/,'')
  const p=String(path).startsWith('/')?path:`/${path}`
  return `${base}${p}`
}

/* 데이터 로딩 */
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

/* 전송 */
const sendMessage = async ()=>{
  const content=newMessage.value.trim()
  if(!content) return
  const res = await axios.post(`/api/chatrooms/${roomId}/message`,{content,type:'text'})
  newMessage.value=''
  getSocket()?.emit('chatMessage',{roomId,message:res.data})
  pushMessageSafe({...res.data,createdAt:res.data.createdAt||new Date().toISOString()})
  scrollToBottom()
  showEmoji.value = false         // 전송 후 이모지 닫기
  await focusComposer(0)          // 전송 후 즉시 입력창 포커스(키보드 유지)
}

/* 업로드 */
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
  await focusComposer(0)          // 이미지 전송 뒤에도 포커스 유지
}

/* 붙여넣기 */
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

/* 채팅 화면 클릭 시 이모지 접기 */
const closeEmojiIfOpen = async ()=>{
  if(showEmoji.value){
    showEmoji.value=false
    await focusComposer(0) // 화면을 탭해 접어도 포커스 복구 → 키보드 유지
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
  }
}
const toggleEmoji=async ()=>{
  showEmoji.value=!showEmoji.value
  if(!showEmoji.value) await focusComposer(0)
}
const scrollToBottom=async()=>{ await nextTick(); const el=chatScroll.value; if(el) el.scrollTop=el.scrollHeight }

/* 읽음 처리 */
let readTimer=null
const scheduleMarkAsRead=(delay=200)=>{ if(readTimer) clearTimeout(readTimer); readTimer=setTimeout(markAsReadNow,delay) }
const markAsReadNow=async()=>{ try{ if(!roomId||!myId.value) return; const r=await axios.put(`/api/chatrooms/${roomId}/read`); const ids=r?.data?.updatedMessageIds||[]; if(!ids.length) return; for(const m of messages.value){ if(ids.includes(m._id)){ const arr=m.readBy||[]; if(!arr.includes(myId.value)) m.readBy=[...arr,myId.value] } } getSocket()?.emit('messagesRead',{roomId,readerId:myId.value,messageIds:ids}) }catch(e){} }

/* 중복 방지 */
const seenMsgIds=new Set()
const pushMessageSafe=(m)=>{ const id=m?._id; if(!id||seenMsgIds.has(id)) return; seenMsgIds.add(id); messages.value.push(m); if(seenMsgIds.size>1000){ const fid=messages.value[0]?._id; if(fid) seenMsgIds.delete(fid) } }

/* 라이프사이클 */
onMounted(async()=>{
  socket=connectSocket()
  window.addEventListener('paste', onPaste)
  await loadMessages()

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
watch(messages,()=>{ scrollToBottom(); scheduleMarkAsRead(250) },{deep:true})

/* 네비게이션 */
const goBack=()=>router.push('/home/4page')
const goToPartnerProfile=()=>{ if(partnerId.value) router.push(`/home/user/${partnerId.value}`) }
</script>

<style scoped>
/* ───────── Theme & avatar variables ───────── */

.chatroom-container{
  display:flex; flex-direction:column; height:100svh; min-height:0; width:100%;
  --gold-500:#d4af37; --gold-400:#e0be53; --black-900:#0b0b0b;
  --color-text:#000; --color-muted:#9aa0a6;
  --page-bg:#0b0b0b; --section-bg:#0b0b0b;
  --bubble-other:#f1f3f4; --bubble-me:#ffefb3;
  --radius:10px; --radius-lg:14px;
  --gap-xxs:4px; --gap-xs:6px; --gap-sm:8px; --gap-md:10px;
  --fz-base:13px; --fz-time:11px; --fz-title:14px;
  background:var(--page-bg); color:var(--color-text); overscroll-behavior:contain;

  --avatar-size: 40px;
  --avatar-radius: 50%;
  --avatar-offset-y: 8px;

  /* 전역 상단바(메인 헤더) 높이 — 필요시 페이지 레이아웃에서 재정의 */
  --main-header-height: -10px;
}

/* 상단바: 전역 상단바 아래에서만 고정 */
.chatroom-header {
  position: sticky;
  top: var(--main-header-height);
  z-index: 5;

  display:flex; align-items:center; gap:var(--gap-sm);
  height:44px; padding:0 var(--gap-md);
  background:#0b0b0b; border-bottom:1px solid rgba(255,255,255,.06);
  box-sizing:border-box;
}
.chatroom-header ion-button{
  --padding-start:116px; --padding-end:6px; --border-radius:8px; --color:var(--gold-500);
  --background:transparent; --border-color:transparent;
  min-height:30px; font-size:13px; margin-right: 6px;
}
.chat-title{ font-weight:800; letter-spacing:.2px; color:var(--gold-500); font-size:var(--fz-title); line-height:2.15; cursor:pointer;  margin-left: 8px; }

/* 메시지 리스트 */
.chat-messages{
  flex:1 1 0; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding: var(--gap-md);
  /* fixed 헤더가 아니므로 상단 패딩 불필요 */
  padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)); /* 입력창 높이 + 세이프에어리어 */
  background:var(--section-bg); scrollbar-gutter:stable;
}
.chat-messages::-webkit-scrollbar{ width:6px; height:6px; }
.chat-messages::-webkit-scrollbar-thumb{ background:#333; border-radius:8px; }
.message-row{ margin-bottom:var(--gap-xs); }

/* 공통 행 */
.other-message,.my-message{ display:flex; gap:var(--gap-xxs); }
.my-message{
  width:100%; justify-content:flex-end; align-items:flex-end;
}

/* 상대방 */
.other-message{ justify-content:flex-start; align-items:flex-start; }
.avatar-col,
.avatar-spacer{
  width:var(--avatar-size); min-width:var(--avatar-size); height:var(--avatar-size);
  margin-right:6px; margin-top:var(--avatar-offset-y);
}
.avatar-col{
  display:flex; align-items:center; justify-content:center;
  border-radius:var(--avatar-radius); overflow:hidden;
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

/* 말풍선 + 시간 */
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

/* 이미지 메시지 */
.chat-image{ max-width:150px; max-height:150px; border-radius:10px; cursor:pointer; display:block; box-shadow:0 1px 0 rgba(0,0,0,0.06); border:1px solid rgba(0,0,0,0.06); }

/* 시간/읽음 */
.time{ font-size:var(--fz-time); color:var(--color-muted); white-space:nowrap; user-select:none; }
.right-time{ align-self:flex-end; margin:0 0 2px 2px; }
.read-flag{
  font-size:var(--fz-time); color:#1f1f1f; background:#fff3f3; border:1px solid #ffc9c9;
  border-radius:999px; padding:2px 6px; margin-left:4px; line-height:1.3; user-select:none;
}

/* 날짜 구분선 — ⬅ 왼쪽 정렬 */
.date-divider{
  display:flex; align-items:center; justify-content:flex-start; gap:60px; margin:10px 0;
}
.date-divider::before{ content:""; flex:0 0 36px; } /* 아바타 폭만큼 여백 */
.date-chip{
  font-size:12px; color:#e6c766; background:rgba(230,199,102,0.08);
  border:1px solid rgba(230,199,102,0.35); border-radius:999px; padding:4px 10px; line-height:1.2;
}

/* 입력 영역 */
.chat-input-wrapper{ 
  position: fixed; bottom:0; left:0; right:0; z-index: 9;
  background:var(--page-bg); border-top:1px solid rgba(255,255,255,.06); 
}
.chat-input{
  display:grid; grid-template-columns:auto auto 1fr auto; align-items:end; gap:var(--gap-sm);
  padding:var(--gap-sm) var(--gap-md); background:var(--page-bg); box-sizing:border-box;
}
.chat-input ion-button.icon-btn{ --padding-start:4px; --padding-end:4px; width:34px; min-width:34px; font-size:16px; --border-color:var(--gold-500); --background:transparent; --background-hover:#1a1a1a; }
.chat-input ion-button[fill="outline"]{ --border-color:var(--gold-500); --color:#fff; --background:transparent; --background-hover:#1a1a1a; --border-radius:9px; min-height:26px; font-size:13px; border:1px solid var(--gold-500); }
.chat-input ion-button[color="primary"]{ --background:var(--gold-500); --color:#111; --border-radius:10px; min-height:26px; }

/* textarea */
.chat-input textarea{
  flex:1 1 auto; padding:6px 8px; border:1.5px solid #333; border-radius:9px; margin:0;
  font-size:var(--fz-base); background:#ffffff; color:#000000; resize:none; line-height:1.4;
  min-height:32px; max-height:110px; box-shadow:0 0 0 2px rgba(212,175,55,0.08);
}
.chat-input textarea::placeholder{ color:#7a7a7a; }
.chat-input textarea:focus{ outline:none; box-shadow:0 0 0 2px rgba(212,175,55,0.35); border-color:var(--gold-500); }

/* 이모지 */
.emoji-picker-wrapper{
  position:absolute; left:var(--gap-md);
  bottom:calc(46px + env(safe-area-inset-bottom,0px));
  z-index:999; background:#111; border:1px solid var(--gold-500);
  border-radius:var(--radius-lg); overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,.5);
}

/* 이미지 모달: 화면 중앙, 입력바 위로 */
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
