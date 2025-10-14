<!-- src/components/03050_pages/1_alluser.vue -->
<template>
  <ion-page>
    <ion-content>
      <!-- 에러 -->
      <ion-text v-if="errorMessage" color="danger">
        <p class="ion-text-center">{{ errorMessage }}</p>
      </ion-text>

      <!-- 스와이프 리스트 (공용 컴포넌트) -->
      <SwapeList
        v-else
        :users="users"
        :is-loading="loading"
        :viewer-level="viewerLevel"
        :is-premium="isPremium"
        @userClick="onCardTapById"
      />
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { IonPage, IonContent, IonText } from '@ionic/vue'

/** ✅ 공용 스와이프 리스트 컴포넌트 */
import SwapeList from '@/components/02010_minipage/mini_list/swapeList.vue'

const router = useRouter()

const users = ref([])
const nickname = ref('')
const viewerLevel = ref('')   // '일반회원' | '여성회원' | '프리미엄' 등
const isPremium = ref(false)   // 명시적으로 전달
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    // 1) 내 정보 조회
    const resMe = await api.get('/api/me')
    const me = resMe.data?.user || {}
    nickname.value = me?.nickname || ''

    // 등급/프리미엄 여부 설정 (백엔드 필드 다양성 대응)
    const levelFromApi =
      me?.level ||
      me?.user_level ||
      me?.membership ||
      ''

    viewerLevel.value = String(levelFromApi || '').trim()

    const premiumBool =
      me?.isPremium ??
      me?.premium ??
      (String(levelFromApi || '').trim() === '프리미엄')

    isPremium.value = Boolean(premiumBool)

    // 2) 타겟 검색 라우터 사용 (target과 동일한 기준)
    const regions = Array.isArray(me?.search_regions) ? me.search_regions : []
    const resUsers = await api.post('/api/search/users', { regions })

    // 응답 형태: [] 또는 { users: [] } 모두 대응
    const list = Array.isArray(resUsers.data)
      ? resUsers.data
      : Array.isArray(resUsers.data?.users)
        ? resUsers.data.users
        : []

    users.value = list
  } catch (e) {
    console.error('❌ 유저 목록 로딩 실패:', e)
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

const onCardTapById = (userId) => {
  if (!userId) return
  router.push(`/home/user/${userId}`)
}
</script>

<style scoped>
/* 페이지 공통 배경 */
ion-content{
  --background:#000;
  --padding-top: 0;
  --padding-bottom: 0;
  color:#fff;
  padding:0;
  overscroll-behavior:none;
}
</style>
