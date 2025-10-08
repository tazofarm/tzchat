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
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    const resUsers = await api.get('/api/users')
    users.value = Array.isArray(resUsers.data?.users) ? resUsers.data.users : []
  } catch (e) {
    errorMessage.value = '유저 목록을 불러오지 못했습니다.'
  }

  try {
    const resMe = await api.get('/api/me')
    nickname.value = resMe.data?.user?.nickname || ''
  } catch (e) {
    /* no-op */
  }

  loading.value = false
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
