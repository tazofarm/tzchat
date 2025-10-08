<template>
  <div class="blocks-only-wrapper">
    <!-- ✅ 상단 헤더: 차단 리스트 (N) -->
    <div class="section-header" role="heading" aria-level="2">
      <ion-icon :icon="icons.closeCircleOutline" class="section-icon danger" aria-hidden="true" />
      <h3 class="section-title">
        차단 리스트
        <span class="count">({{ blocksCount }})</span>
      </h3>
    </div>

    <!-- ✅ 공통 리스트 + 하단 액션(차단 해제) -->
    <UserList
      :users="users"
      :isLoading="isLoading"
      emptyText="차단한 친구가 없습니다."
      @select="u => goToUserProfile(u._id)"
    >
      <template #item-actions="{ user }">
        <ion-button
          size="small"
          color="medium"
          class="btn-gold-outline"
          @click.stop="onUnblockClick(user._id)"
        >차단해제</ion-button>
      </template>
    </UserList>
  </div>
</template>

<script setup>
/* -----------------------------------------------------------
   Blocks List (헤더 카운트 + 공통 UserList + 차단해제)
   ✅ 항상 id를 추출해 재조회하여 전체 필드를 확보
----------------------------------------------------------- */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import { IonButton, IonIcon } from '@ionic/vue'
import { closeCircleOutline } from 'ionicons/icons'

const router = useRouter()
const icons = { closeCircleOutline }

/* 상태 */
const users = ref([])      // 화면 표시용: 차단한 유저 객체들
const isLoading = ref(true)

/* 유틸 */
const uniq = (arr = []) => Array.from(new Set(arr.map(String)))
function toTS(v){ if(!v) return 0; try{const t=new Date(v).getTime();return Number.isFinite(t)?t:0}catch{ return 0 } }
function sortByRecent(list){
  return [...list].sort((a,b)=>{
    const aTS=toTS(a.last_login||a.lastLogin||a.updatedAt||a.createdAt)
    const bTS=toTS(b.last_login||b.lastLogin||b.updatedAt||b.createdAt)
    return bTS-aTS
  })
}
/** UserList 정규화 */
function normalizeUser(u={}){
  const r1=u.region1 ?? u.region1Name ?? u.regionName1 ?? u.city1 ?? u.area1 ?? (Array.isArray(u.region)?u.region[0]:undefined) ?? '/'
  const r2=u.region2 ?? u.region2Name ?? u.regionName2 ?? u.city2 ?? u.area2 ?? (Array.isArray(u.region)?u.region[1]:undefined) ?? '/'
  const pref=u.preference ?? u.preferenceText ?? u.pref ?? u.trait ?? u.feature ?? (Array.isArray(u.tags)?u.tags.join(', '):undefined) ?? '-'
  const lastLogin=u.last_login || u.lastLogin || u.updatedAt || u.createdAt
  return { ...u, region1:r1, region2:r2, preference:pref, last_login:lastLogin }
}

/* 네비게이션 */
const goToUserProfile = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}

/* /api/blocks 응답 파싱: ids 배열/객체 배열 모두 대응 */
function extractBlockIds(data){
  if (Array.isArray(data) && data.length){
    if (typeof data[0] === 'object' && data[0]?._id){
      return uniq(data.map(x=>x?._id).filter(Boolean).map(String))
    }
    if (typeof data[0] !== 'object'){
      return uniq(data.map(String))
    }
  }
  if (Array.isArray(data?.ids)) return uniq(data.ids.map(String))
  return []
}

/* 사용자 조회: bulk → 개별, 최종 id 필터 */
async function fetchUsersByIdsStrict(ids=[]){
  if(!ids.length) return []
  let bulkList=[]
  try{
    const res=await api.post('/api/search/users',{ ids })
    bulkList = Array.isArray(res?.data?.users) ? res.data.users
             : (Array.isArray(res?.data) ? res.data : [])
  }catch(e){ console.warn('[blocks] bulk failed; fallback per-id:', e?.message||e) }

  if(Array.isArray(bulkList) && bulkList.length){
    const set=new Set(ids.map(String))
    const filtered=bulkList.filter(u=>u && set.has(String(u._id)))
    if(filtered.length===ids.length) return filtered
    console.warn('[blocks] bulk suspicious; using per-id fallback')
  }

  const per=await Promise.all(ids.map(async id=>{
    try{
      const r=await api.get(`/api/users/${id}`)
      return r?.data?.user || r?.data || null
    }catch{ return null }
  }))
  return per.filter(Boolean)
}

/* 헤더 카운트 */
const blocksCount = computed(()=> users.value.length)

/* 차단 해제 */
async function unblock(userId){
  if(!userId) return
  await api.delete(`/api/blocks/${userId}`)
  users.value = users.value.filter(u=> String(u._id)!==String(userId))
}
const onUnblockClick = (userId) => unblock(userId)

/* 초기 로딩 */
onMounted(async ()=>{
  try{
    isLoading.value=true
    const res=await api.get('/api/blocks')

    // ✅ 항상 ids를 추출해 정식 조회로 전체 필드 확보
    const blockIds = extractBlockIds(res?.data)
    if (!blockIds.length){ users.value=[]; return }

    const raw = await fetchUsersByIdsStrict(blockIds)
    const set = new Set(blockIds)
    const strictFinal = raw.filter(u=>u && set.has(String(u._id)))
    users.value = sortByRecent(strictFinal.map(normalizeUser))
  }catch(e){
    console.error('❌ 차단 리스트 로딩 실패:', e)
    users.value=[]
  }finally{
    isLoading.value=false
  }
})
</script>

<style scoped>
/* 상단 헤더: 기존 톤과 맞춤 */
.section-header{
  display:flex; align-items:center; gap:10px;
  padding:8px 10px; margin:4px 0 10px;
  border-left:4px solid var(--gold, #d4af37);
  background:#0f0f0f; border-radius:10px;
  box-shadow: inset 0 0 0 1px rgba(212,175,55,.08);
}
.section-title{
  display:flex; align-items:center; gap:8px;
  margin:0; color:var(--gold, #d4af37); font-weight:800;
  font-size:15px
}
.section-icon{ font-size:18px; color:var(--gold, #d4af37); }
.section-icon.danger{ color:#ff6b6b; }
.count{ font-weight:800; color:var(--gold-weak, #e6c964); }

/* 버튼 공통 톤 */
/* (필요시 버튼 높이는 --min-height/height로 조정 가능) */
.btn-gold-solid,
.btn-gold-outline {
  --height: 18px;      /* 참고: Ionic은 --min-height 권장 */
  --border-radius: 12px;
  --padding-start: 1px;
  --padding-end: 1px;
  --padding-top: 0;
  --padding-bottom: 0;

  font-size: 12px;
  font-weight: 800;
  min-width: 65px;
  min-height: 30px;

  --background: linear-gradient(135deg, var(--gold, #d4af37), var(--gold-strong, #b18f1a));
  --color: #000;
}
.btn-gold-outline {
  --background: transparent;
  --color: var(--gold-weak, #e6c964);
  border: 1.5px solid var(--gold, #d4af37);
}

:deep(.actions-bar) {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 12px;
  padding: 0 20px;
}

/* 배경 */
:root, :host{ --bg:#0b0b0d; --text:#d7d7d9; }
.blocks-only-wrapper{ color:var(--text); }
</style>
