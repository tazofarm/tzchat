<template>
  <div class="friends-only-wrapper">
    <!-- ✅ 상단 헤더: 친구 리스트 (N) -->
    <div class="section-header" role="heading" aria-level="2">
      <ion-icon :icon="icons.peopleOutline" class="section-icon" aria-hidden="true" />
      <h3 class="section-title">
        친구 리스트
        <span class="count">({{ friendsCount }})</span>
      </h3>
    </div>

    <!-- ✅ 공통 리스트 + 하단 액션(대화하기/친구삭제/차단하기)
         ✅ 프리미엄회원 가림을 위해 viewer-level / is-premium 전달 -->
    <UserList
      :users="users"
      :isLoading="isLoading"
      :viewer-level="viewerLevel"
      :is-premium="isPremium"
      emptyText="아직 친구가 없습니다."
      @select="u => goToUserProfile(u._id)"
    >
      <template #item-actions="{ user }">
        <ion-button
          size="small"
          color="primary"
          class="btn-gold-solid"
          @click.stop="onChatClick(user._id)"
        >대화하기</ion-button>

        <ion-button
          size="small"
          color="medium"
          class="btn-gold-outline"
          @click.stop="onRemoveClick(user._id)"
        >친구삭제</ion-button>

        <ion-button
          size="small"
          color="danger"
          class="btn-gold-outline"
          @click.stop="onBlockClick(user._id)"
        >차단하기</ion-button>
      </template>
    </UserList>
  </div>
</template>

<script setup>
/* -----------------------------------------------------------
   Friends List (헤더 카운트 + 공통 UserList + 하단 액션)
   - 항상 id로 재조회하여 전체 필드 확보
   - 액션: 대화하기 / 친구삭제 / 차단하기
   - ✅ Premium 가림: viewerLevel / isPremium을 UserList로 전달
----------------------------------------------------------- */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import UserList from '@/components/02010_minipage/mini_list/UserList.vue'
import { IonButton, IonIcon } from '@ionic/vue'
import { peopleOutline } from 'ionicons/icons'

const router = useRouter()
const icons = { peopleOutline }

/* 상태 */
const users = ref([])
const isLoading = ref(true)

/* ✅ 프리미엄회원 가림 로직 전달용 */
const viewerLevel = ref('')  // '일반회원' | '라이트회원' | '프리미엄회원' 등
const isPremium   = ref(false)

/* 유틸 */
const uniq = (arr = []) => Array.from(new Set(arr.map(String)))
function toTS(v){ if(!v) return 0; try{const t=new Date(v).getTime(); return Number.isFinite(t)?t:0}catch{return 0} }
function sortByRecent(list){
  return [...list].sort((a,b)=>{
    const aTS=toTS(a.last_login||a.lastLogin||a.updatedAt||a.createdAt)
    const bTS=toTS(b.last_login||b.lastLogin||b.updatedAt||b.createdAt)
    return bTS-aTS
  })
}
function normalizeUser(u = {}){
  const r1=u.region1??u.region1Name??u.regionName1??u.city1??u.area1??(Array.isArray(u.region)?u.region[0]:undefined)??'/'
  const r2=u.region2??u.region2Name??u.regionName2??u.city2??u.area2??(Array.isArray(u.region)?u.region[1]:undefined)??'/'
  const pref=u.preference??u.preferenceText??u.pref??u.trait??u.feature??(Array.isArray(u.tags)?u.tags.join(', '):undefined)??'-'
  const lastLogin=u.last_login||u.lastLogin||u.updatedAt||u.createdAt
  return { ...u, region1:r1, region2:r2, preference:pref, last_login:lastLogin }
}

/* 네비게이션 */
const goToUserProfile = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}
/* 대화하기 */
const onChatClick = (userId) => {
  if (!userId) return
  router.push(`/home/chat/${userId}`)
}

/* friends 응답 → id 추출 (객체/문자열 모두 지원) */
function extractFriendIds(data){
  if (Array.isArray(data) && data.length){
    if (typeof data[0] === 'object') {
      // 객체 배열일 경우에도 _id를 모아 재조회 (프로젝션 응답 대비)
      return uniq(data.map(x => x?._id).filter(Boolean).map(String))
    }
    return uniq(data.map(String))
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
    bulkList=Array.isArray(res?.data?.users)?res.data.users:(Array.isArray(res?.data)?res.data:[])
  }catch(e){ console.warn('[friends] bulk failed; per-id fallback', e?.message||e) }
  if(Array.isArray(bulkList)&&bulkList.length){
    const set=new Set(ids.map(String))
    const filtered=bulkList.filter(u=>u && set.has(String(u._id)))
    if(filtered.length===ids.length) return filtered
  }
  const per=await Promise.all(ids.map(async id=>{
    try{
      const r=await api.get(`/api/users/${id}`)
      return r?.data?.user||r?.data||null
    }catch{return null}
  }))
  return per.filter(Boolean)
}

/* 액션: 친구삭제 / 차단하기
   ⚠️ 백엔드 라우터와 정확히 맞춤:
   - 친구삭제: DELETE /api/friend/:id   (단수 friend)
   - 차단하기: PUT    /api/block/:id    (단수 block)
*/
async function removeFriend(userId){
  if(!userId) return
  await api.delete(`/api/friend/${userId}`)
  users.value = users.value.filter(u => String(u._id) !== String(userId))
}
async function blockUser(userId){
  if(!userId) return
  await api.put(`/api/block/${userId}`)
  users.value = users.value.filter(u => String(u._id) !== String(userId))
}
const onRemoveClick = (userId) => removeFriend(userId)
const onBlockClick  = (userId) => blockUser(userId)

/* 헤더 카운트 */
const friendsCount = computed(()=> users.value.length)

/* 초기 로딩 */
onMounted(async ()=>{
  try{
    isLoading.value=true

    // ✅ 뷰어 등급/프리미엄회원 여부 설정 (서버 우선 → 로컬 폴백)
    try {
      const me = (await api.get('/api/me')).data?.user || {}
      const levelFromApi =
        me?.level ||
        me?.user_level ||
        me?.membership ||
        ''
      viewerLevel.value = String(levelFromApi || '').trim()

      const premiumBool =
        me?.isPremium ??
        me?.premium ??
        (String(levelFromApi || '').trim() === '프리미엄회원')
      isPremium.value = Boolean(premiumBool)
    } catch {
      const lv = (localStorage.getItem('user_level') || localStorage.getItem('level') || '').trim().toLowerCase()
      viewerLevel.value = lv
      const boolish = (localStorage.getItem('isPremium') || '').trim().toLowerCase()
      isPremium.value = ['  회원','premium','premium_member','prem'].includes(lv) ||
                        ['true','1','yes','y'].includes(boolish)
    }

    const res=await api.get('/api/friends')

    // ✅ 항상 ids를 추출하고, 정식 조회로 전체 필드를 확보
    const friendIds = extractFriendIds(res?.data)
    const raw = await fetchUsersByIdsStrict(friendIds)
    const set = new Set(friendIds)
    const strictFinal = raw.filter(u=>u && set.has(String(u._id)))
    users.value = sortByRecent(strictFinal.map(normalizeUser))
  }catch(e){
    console.error('❌ 친구 리스트 로딩 실패:', e)
    users.value=[]
  }finally{
    isLoading.value=false
  }
})
</script>

<style scoped>
/* 상단 헤더 */
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
.friends-only-wrapper{ color:var(--text); }
</style>
