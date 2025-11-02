<!-- src/components/04310_Page3_list/Page_Send.vue -->
<template>
  <!-- 상단 헤더(상위 IonContent가 스크롤 담당) -->
  <div class="section-header">
    <ion-icon :icon="icons.sendOutline" class="section-icon" aria-hidden="true" />
    <h3 class="section-title">
      보낸 친구 신청
      <span class="count">({{ pendingCount }})</span>
    </h3>
  </div>

  <div class="sent-wrapper">
    <div class="page-container">
      <UserList
        :users="users"
        :isLoading="isLoading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        emptyText="보낸 친구 신청이 없습니다."
        @select="u => goToUserProfile(u._id)"
      >
        <template #item-actions="{ user }">
          <ion-button
            size="small"
            color="medium"
            class="btn-gold-outline"
            :disabled="isActing || !reqByUserId[user._id]"
            @click.stop="onCancelClick(reqByUserId[user._id]?._id)"
          >신청 취소</ion-button>

          <ion-button
            size="small"
            color="danger"
            class="btn-gold-outline"
            :disabled="isActing || !reqByUserId[user._id]"
            @click.stop="onBlockClick(user._id)"
          >차단</ion-button>
        </template>
      </UserList>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import { IonButton, IonIcon } from '@ionic/vue'
import { sendOutline } from 'ionicons/icons'

/** ✅ 부모에서 전달되는 prop / 이벤트를 명시해 경고 제거 */
const props = defineProps({
  /** kebab-case `viewer-level` 로 전달됨 */
  viewerLevel: { type: [String], default: '' },
  /** kebab-case `is-premium` 로 전달됨 */
  isPremium: { type: [Boolean, String], default: undefined },
})
const emit = defineEmits(['openReceive', 'closeReceive'])

const router = useRouter()
const icons = { sendOutline }

/* ===== 상태 ===== */
const users = ref([])            // 보낸신청 대상 유저들(to)만
const isLoading = ref(true)
const isActing  = ref(false)     // 중복 클릭 방지
const sentRequests = ref([])     // [{ _id, to, status:'pending', ... }]

/* 프리미엄 표시 전달용(부모 우선, 미제공 시 보정) */
const viewerLevel = ref(String(props.viewerLevel ?? '').trim())
const isPremium   = ref(
  props.isPremium === undefined
    ? false
    : (typeof props.isPremium === 'string'
        ? ['true','1','yes','y','프리미엄회원','premium','premium_member','prem'].includes(String(props.isPremium).toLowerCase())
        : Boolean(props.isPremium))
)

/* ===== 유틸 ===== */
const uniq = (arr = []) => Array.from(new Set(arr.map(String)))
function toTS(v){ if(!v) return 0; try{ const t=new Date(v).getTime(); return Number.isFinite(t)?t:0 }catch{return 0} }
function sortByRecent(list){
  return [...list].sort((a,b)=>{
    const aTS=toTS(a.last_login||a.lastLogin||a.updatedAt||a.createdAt)
    const bTS=toTS(b.last_login||b.lastLogin||b.updatedAt||b.createdAt)
    return bTS-aTS
  })
}
function normalizeUser(u = {}){
  const r1 = u.region1 ?? u.region1Name ?? u.regionName1 ?? u.city1 ?? u.area1 ?? (Array.isArray(u.region)?u.region[0]:undefined) ?? '/'
  const r2 = u.region2 ?? u.region2Name ?? u.regionName2 ?? u.city2 ?? u.area2 ?? (Array.isArray(u.region)?u.region[1]:undefined) ?? '/'
  const pref = u.preference ?? u.preferenceText ?? u.pref ?? u.trait ?? u.feature ?? (Array.isArray(u.tags)?u.tags.join(', '):undefined) ?? '-'
  const lastLogin = u.last_login || u.lastLogin || u.updatedAt || u.createdAt
  return { ...u, region1:r1, region2:r2, preference:pref, last_login:lastLogin }
}

/* ===== 네비게이션 ===== */
const goToUserProfile = (userId) => { if (userId) router.push(`/home/user/${userId}`) }

/* ===== 보낸신청 파서 ===== */
function extractPendingRequests(data){
  const arr = Array.isArray(data)?data
           : (Array.isArray(data?.requests)?data.requests
           : (Array.isArray(data?.pending)?data.pending:[]))
  const reqs = (arr||[]).filter(r=>r && typeof r==='object')
  return reqs.filter(r => (r.status ?? 'pending') === 'pending')
}
function extractRecipientIdsFromAny(data){
  const pendingReqs = extractPendingRequests(data)
  const ids1 = pendingReqs.map(r=> (typeof r.to==='object'? r.to?._id : r.to)).filter(Boolean).map(String)
  const idList =
    (Array.isArray(data?.pendingIds) && data.pendingIds) ||
    (Array.isArray(data?.ids) && data.ids) ||
    (Array.isArray(data) && typeof data[0] !== 'object' && data) || []
  const ids2 = idList.map(String)
  return uniq([...ids1, ...ids2])
}

/* ===== 사용자 조회 ===== */
async function fetchUsersByIdsStrict(ids=[]){
  if(!ids.length) return []
  let bulkList=[]
  try{
    const res=await api.post('/api/search/users',{ids})
    bulkList = Array.isArray(res?.data?.users)?res.data.users : (Array.isArray(res?.data)?res.data:[])
  }catch(e){
    console.warn('[sent] bulk search failed, fallback per-id:', e?.message||e)
  }
  if(Array.isArray(bulkList)&&bulkList.length){
    const set=new Set(ids.map(String))
    const filtered=bulkList.filter(u=>u && set.has(String(u._id)))
    if(filtered.length===ids.length) return filtered
  }
  const per = await Promise.all(ids.map(async id=>{
    try{ const r=await api.get(`/api/users/${id}`); return r?.data?.user||r?.data||null }catch{ return null }
  }))
  return per.filter(Boolean)
}

/* ===== 카운트 및 매핑 ===== */
const pendingCount = computed(()=> sentRequests.value.length)

/** userId -> request */
const reqByUserId = computed(()=>{
  const m=Object.create(null)
  for(const r of sentRequests.value){
    const uid = typeof r?.to==='object' ? r.to?._id : r?.to
    if(uid) m[String(uid)] = r
  }
  return m
})

/** 🔑 requestId -> userId (취소 시 즉시 제거용) */
const userIdByReqId = computed(()=>{
  const m=Object.create(null)
  for(const r of sentRequests.value){
    const uid = typeof r?.to==='object' ? r.to?._id : r?.to
    if(uid && r?._id) m[String(r._id)] = String(uid)
  }
  return m
})

/* ===== 액션 ===== */
async function cancelFriendRequest(friendRequestId){
  if(!friendRequestId) return
  const targetUserId = userIdByReqId.value[friendRequestId]
  try{
    isActing.value = true
    await api.delete(`/api/friend-request/${friendRequestId}`)
    // 1) 요청 목록에서 제거
    sentRequests.value = sentRequests.value.filter(x=>x._id!==friendRequestId)
    // 2) 사용자 목록에서도 즉시 제거 (회색 상태 방지)
    if (targetUserId){
      users.value = users.value.filter(u=> String(u._id)!==String(targetUserId))
    }
  }catch(e){
    console.error('❌ 신청 취소 실패:', e)
  }finally{
    isActing.value = false
  }
}

async function blockUser(userId){
  if(!userId) return
  try{
    isActing.value = true
    await api.put(`/api/block/${userId}`,{})
    const fr = reqByUserId.value[userId]
    if(fr) sentRequests.value = sentRequests.value.filter(x=>x._id!==fr._id)
    users.value = users.value.filter(u=>String(u._id)!==String(userId))
  }catch(e){
    console.error('❌ 차단 실패:', e)
  }finally{
    isActing.value = false
  }
}

const onCancelClick = (payload)=> cancelFriendRequest(typeof payload==='string'? payload : payload?._id)
const onBlockClick  = (userId)=> blockUser(userId)

/* ===== 초기 로딩 ===== */
onMounted(async ()=>{
  try{
    isLoading.value=true
    // viewer level/premium — 부모 미제공 시에만 보정
    const needLv  = !props.viewerLevel || String(props.viewerLevel).trim()===''
    const needPre = props.isPremium === undefined || props.isPremium === null
    if (needLv || needPre){
      try{
        const me=(await api.get('/api/me')).data?.user||{}
        const levelFromApi = me?.level || me?.user_level || me?.membership || ''
        if (needLv)  viewerLevel.value = String(levelFromApi||'').trim()
        if (needPre){
          const premiumBool = me?.isPremium ?? me?.premium ?? (String(levelFromApi||'').trim()==='프리미엄회원')
          isPremium.value = Boolean(premiumBool)
        }
      }catch{
        const lv=(localStorage.getItem('user_level')||localStorage.getItem('level')||'').trim().toLowerCase()
        if (needLv) viewerLevel.value = lv
        if (needPre){
          const boolish=(localStorage.getItem('isPremium')||'').trim().toLowerCase()
          isPremium.value =
            ['프리미엄회원','premium','premium_member','prem'].includes(lv) ||
            ['true','1','yes','y'].includes(boolish)
        }
      }
    }

    const res = await api.get('/api/friend-requests/sent')
    const pendingReqs = extractPendingRequests(res?.data)
    sentRequests.value = pendingReqs

    const recipientIds = extractRecipientIdsFromAny(res?.data)
    if(!recipientIds.length){ users.value=[]; return }

    const raw = await fetchUsersByIdsStrict(recipientIds)
    const set = new Set(recipientIds.map(String))
    const strictFinal = raw.filter(u=>u && set.has(String(u._id)))

    users.value = sortByRecent(strictFinal.map(normalizeUser))
  }catch(e){
    console.error('❌ 보낸신청 전용 리스트 로딩 실패:', e)
    users.value=[]; sentRequests.value=[]
  }finally{
    isLoading.value=false
  }
})
</script>

<style scoped>
:root, :host{
  --gold:#d4af37; --gold-weak:#e6c964; --gold-strong:#b18f1a;
  --bg-deep:#0a0a0a; --panel:#141414; --row:#1b1b1b;
  --ink:#f5f5f5; --ink-weak:#c9c9c9; --border:#333;
}

.section-toolbar{
  --background: var(--bg-deep);
  border-bottom: 1px solid var(--border);
}
.section-header{
  display:flex; align-items:center; gap:10px;
  padding:8px 10px; margin:0px 10px 0px 10px;
  border-left:4px solid var(--gold);
  background:#000000; border-radius:10px;
  box-shadow: inset 0 0 0 1px rgba(212,175,55,.08);
}
.section-title{ display:flex; gap:8px; margin:0; color:var(--gold); font-weight:800; font-size:15px; }
.section-icon{ font-size:18px; color: var(--gold); }
.count{ font-weight:800; color:var(--gold-weak); }

.sent-wrapper{
  background:#0a0a0a; color:#f5f5f5;
  padding-top: calc(0px + var(--ion-safe-area-top, 0px));
  display:flex; flex-direction:column; justify-content:flex-start; align-items:stretch;
  min-height: 100%;
  width: 100%;
}
.page-container{ padding:10px 12px 16px 12px; }

.btn-gold-solid,
.btn-gold-outline{
  --height:18px; --border-radius:12px;
  --padding-start:1px; --padding-end:1px; --padding-top:0; --padding-bottom:0;
  font-size:12px; font-weight:800; min-width:65px; min-height:30px;
  --background: linear-gradient(135deg, var(--gold), var(--gold-strong));
  --color:#000;
}
.btn-gold-outline{
  --background: transparent;
  --color: var(--gold-weak);
  border:1.5px solid var(--gold);
}

:deep(.actions-bar){
  display:flex; flex-wrap:wrap; justify-content:flex-start; gap:12px; padding:0 20px;
}
</style>
