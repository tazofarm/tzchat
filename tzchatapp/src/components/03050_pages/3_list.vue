<template>
  <!-- 🔹 상단 닉네임 + 로그아웃 -->
  <div class="top-bar">
    <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
    <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
  </div>

  <!-- 🔹 리스트 구역 -->
  <div class="lists-wrapper">
    <!-- 📤 보낸 친구 신청 -->
    <div class="list-section">
      <h3>📤 보낸 친구 신청</h3>
      <div class="list-scroll">
        <ul v-if="sentRequests.length">
          <li v-for="r in sentRequests" :key="r._id">
            <div class="user-row">
              <div class="user-info" @click="handleClick(r.to)">
                <div class="user-name">{{ r.to.username }} ({{ r.to.nickname }})</div>
                <div class="user-meta">출생년도: {{ r.to.birthyear }} / 성별: {{ r.to.gender === 'man' ? '남자' : '여자' }}</div>
              </div>
              <ion-button size="small" color="medium" @click="cancelRequest(r._id)">취소하기</ion-button>
            </div>
          </li>
        </ul>
        <p v-else>보낸 친구 신청이 없습니다.</p>
      </div>
    </div>

    <!-- 📥 받은 친구 신청 -->
    <div class="list-section">
      <h3>📥 받은 친구 신청</h3>
      <div class="list-scroll">
        <ul v-if="receivedRequests.length">
          <li v-for="r in receivedRequests" :key="r._id">
            <div class="user-row">
              <div class="user-info" @click="handleClick(r.from)">
                <div class="user-name">{{ r.from.username }} ({{ r.from.nickname }})</div>
                <div class="user-meta">출생년도: {{ r.from.birthyear }} / 성별: {{ r.from.gender === 'man' ? '남자' : '여자' }}</div>
              </div>
              <ion-button size="small" color="primary" @click="openMessageModal(r)">인사말보기</ion-button>
            </div>
          </li>
        </ul>
        <p v-else>받은 친구 신청이 없습니다.</p>
      </div>
    </div>

    <!-- 👫 친구 리스트 -->
    <div class="list-section">
      <h3>👫 친구 리스트</h3>
      <div class="list-scroll">
        <ul v-if="friends.length">
          <li v-for="f in friends" :key="f._id" @click="handleClick(f)">
            <div class="user-info">
              <div class="user-name">{{ f.username }} ({{ f.nickname }})</div>
              <div class="user-meta">출생년도: {{ f.birthyear }} / 성별: {{ f.gender === 'man' ? '남자' : '여자' }}</div>
            </div>
          </li>
        </ul>
        <p v-else>아직 친구가 없습니다.</p>
      </div>
    </div>

    <!-- 🚫 차단한 친구 -->
    <div class="list-section">
      <h3>🚫 차단한 친구</h3>
      <div class="list-scroll">
        <ul v-if="blocks.length">
          <li v-for="b in blocks" :key="b._id" @click="handleClick(b)">
            <div class="user-info">
              <div class="user-name">{{ b.username }} ({{ b.nickname }})</div>
              <div class="user-meta">출생년도: {{ b.birthyear }} / 성별: {{ b.gender === 'man' ? '남자' : '여자' }}</div>
            </div>
          </li>
        </ul>
        <p v-else>차단한 친구가 없습니다.</p>
      </div>
    </div>
  </div>

  <!-- 🔹 인사말 모달 -->
  <ModalFriendMessage
    v-if="selectedRequest"
    :request="selectedRequest"
    @close="selectedRequest = null"
    @accepted="acceptRequest"
    @rejected="rejectRequest"
    @blocked="blockRequest"
  />

  <!-- 🔹 하단 메뉴 고정 -->
  <BottomMenu class="bottom-menu" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'
import { useRouter } from 'vue-router'
import BottomMenu from '@/components/02050_layout/BottomMenu.vue'
import ModalFriendMessage from '@/components/04310_Page3_detail/Modal_FriendMessage.vue'

const router = useRouter()

const nickname = ref('')
const sentRequests = ref([])
const receivedRequests = ref([])
const friends = ref([])
const blocks = ref([])
const selectedRequest = ref(null)

// ✅ 항목 클릭 → 사용자 프로필 페이지로 이동
const handleClick = (user) => {
  if (!user || !user._id) return
  router.push(`/home/user/${user._id}`)
}

// ✅ 인사말 모달 열기
const openMessageModal = (request) => {
  selectedRequest.value = request
}

// ✅ 친구 신청 취소
const cancelRequest = async (requestId) => {
  try {
    const ok = confirm('정말로 신청을 취소하시겠습니까?')
    if (!ok) return

    await axios.delete(`/api/friend-request/${requestId}`, { withCredentials: true })
    sentRequests.value = sentRequests.value.filter(r => r._id !== requestId)
  } catch (err) {
    alert('신청 취소 중 오류가 발생했습니다.')
  }
}

// ✅ 수락
const acceptRequest = async (requestId) => {
  try {
    await axios.put(`/api/friend-request/${requestId}/accept`, {}, { withCredentials: true })
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== requestId)
    const res = await axios.get('/api/friends', { withCredentials: true })
    friends.value = res.data
    selectedRequest.value = null
  } catch (err) {
    alert('수락 중 오류 발생')
  }
}

// ✅ 거절
const rejectRequest = async (requestId) => {
  try {
    await axios.put(`/api/friend-request/${requestId}/reject`, {}, { withCredentials: true })
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== requestId)
    selectedRequest.value = null
  } catch (err) {
    alert('거절 중 오류 발생')
  }
}

// ✅ 차단
const blockRequest = async (requestId) => {
  try {
    const ok = confirm('정말로 차단하시겠습니까?')
    if (!ok) return

    await axios.put(`/api/friend-request/${requestId}/block`, {}, { withCredentials: true })
    receivedRequests.value = receivedRequests.value.filter(r => r._id !== requestId)
    const res = await axios.get('/api/blocks', { withCredentials: true })
    blocks.value = res.data
    selectedRequest.value = null
  } catch (err) {
    alert('차단 중 오류 발생')
  }
}

// ✅ 데이터 로드
onMounted(async () => {
  try {
    const res1 = await axios.get('/api/me', { withCredentials: true })
    nickname.value = res1.data.user?.nickname || ''

    const res2 = await axios.get('/api/friend-requests/sent', { withCredentials: true })
    sentRequests.value = res2.data

    const res3 = await axios.get('/api/friend-requests/received', { withCredentials: true })
    receivedRequests.value = res3.data

    const res4 = await axios.get('/api/friends', { withCredentials: true })
    friends.value = res4.data

    const res5 = await axios.get('/api/blocks', { withCredentials: true })
    blocks.value = res5.data
  } catch (err) {
    console.error('❌ 데이터 불러오기 오류:', err)
  }
})

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
html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
  font-size: 0.85rem;
}

.top-bar {
  height: 50px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  background-color: #f1f1f1;
  border-bottom: 1px solid #ccc;
  font-size: 0.9rem;
}

.welcome-text {
  font-weight: bold;
  color: black;
}

.lists-wrapper {
  height: calc(80vh - 50px - 60px);
  display: flex;
  flex-direction: column;
}

.list-section {
  flex: 1;
  padding: 0.3rem 0.8rem;
  display: flex;
  flex-direction: column;
}

.list-section h3 {
  margin: 0 0 0.3rem;
  font-size: 0.9rem;
  color: black;
}

.list-scroll {
  flex: 1;
  overflow-y: auto;
}

ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

li {
  color: black;
  padding: 0.3rem 0;
  border-bottom: 1px solid #eee;
  font-size: 0.85rem;
  cursor: default;
  transition: background-color 0.2s;
}
li:hover {
  background-color: #f5f5f5;
}

.user-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.user-info {
  display: flex;
  flex-direction: column;
  color: black;
  flex: 1;
}

.user-name {
  font-weight: bold;
  font-size: 0.88rem;
}

.user-meta {
  font-size: 0.8rem;
  color: #444;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

p {
  margin: 0.3rem 0;
  color: black;
  font-size: 0.85rem;
}

.bottom-menu {
  position: fixed;
  bottom: 0;
  width: 100%;
  height: 60px;
}
</style>
