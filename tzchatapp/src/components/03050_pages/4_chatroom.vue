<template>
  <!-- 🔹 최상단 인사 + 로그아웃 -->
  <div class="top-bar">
    <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
    <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
  </div>

  <!-- 🔸 채팅방 리스트 -->
  <div class="container">
    <ion-list v-if="chatRooms.length">
      <ion-item
        v-for="room in chatRooms"
        :key="room._id"
        button
        @click="goToChat(room._id)"
      >
        <ion-label class="black-text">
          <h3>{{ getPartnerNickname(room.participants) }}</h3>
          <p>{{ room.messages[0]?.content || '메시지가 없습니다.' }}</p>
        </ion-label>
      </ion-item>
    </ion-list>

    <ion-text color="medium" v-else>
      <p class="ion-text-center">채팅방이 없습니다.</p>
    </ion-text>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import {
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonButton
} from '@ionic/vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const nickname = ref('')
const myId = ref('')
const chatRooms = ref([])

// ✅ 닉네임, 내 ID 불러오기 + 채팅방 목록
onMounted(async () => {
  try {
    const meRes = await axios.get('/api/me', { withCredentials: true })
    nickname.value = meRes.data.user?.nickname || ''
    myId.value = meRes.data.user?._id || ''

    const roomRes = await axios.get('/api/chatrooms')
    chatRooms.value = roomRes.data
  } catch (err) {
    console.error('❌ 데이터 로드 실패:', err)
  }
})

// ✅ 상대방 닉네임 반환
const getPartnerNickname = (participants) => {
  const other = participants.find(p => p._id !== myId.value)
  return other?.nickname || '(알 수 없음)'
}

// ✅ 채팅방으로 이동
const goToChat = (roomId) => {
  router.push(`/home/chat/${roomId}`)
}

// ✅ 로그아웃
const logout = async () => {
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    router.push('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
  }
}
</script>

<style scoped>
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0rem;
  background-color: #f1f1f1;
  font-size: 0.95rem;
  border-bottom: 1px solid #ccc;
}

.welcome-text {
  font-weight: bold;
  color: black;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
}

.black-text {
  color: black;
}

h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: bold;
  color: black;
}

p {
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  color: #444;
}
</style>
