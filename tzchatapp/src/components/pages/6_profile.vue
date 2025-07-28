<template>
  <div class="page-wrapper">
    <!-- 🔹 최상단 인사 + 로그아웃 -->
    <div class="top-bar">
      <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
      <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
    </div>

    <!-- 🔹 사용자 정보 카드 -->
    <div class="container">
      <div v-if="user" class="card">
        <h3>{{ user.nickname }} ({{ user.username }})</h3>
        <table class="info-table">
          <tbody>
            <tr>
              <td><strong>출생년도</strong></td>
              <td class="readonly">{{ user.birthyear || '미입력' }}</td>
            </tr>


            <tr>
              <td><strong>성별</strong></td>
              <td class="readonly">
                {{ user.gender === 'man' ? '남자' : user.gender === 'woman' ? '여자' : '미입력' }}
              </td>
            </tr>



            <tr @click="openPopup(4, user.preference)" class="editable-row">
              <td><strong>닉네임</strong></td>
              <td class="editable-text">{{ user.nickname }}</td>
            </tr>

            <tr @click="openPopup(1, user.region1 + ' ' + user.region2)" class="editable-row">
              <td><strong>지역</strong></td>
              <td class="editable-text">{{ user.region1 }} {{ user.region2 }}</td>
            </tr>
            <tr @click="openPopup(2, user.preference)" class="editable-row">
              <td><strong>특징</strong></td>
              <td class="editable-text">{{ user.preference }}</td>
            </tr>
            <tr @click="openPopup(3, user.selfintro || '소개 없음')" class="editable-row">
              <td><strong>소개</strong></td>
              <td class="editable-text">{{ user.selfintro || '소개 없음' }}</td>
            </tr>
            <tr>
              <td><strong>가입일</strong></td>
              <td class="readonly">{{ formatDate(user.createdAt) }}</td>
            </tr>
            <tr>
              <td><strong>마지막 접속</strong></td>
              <td class="readonly">{{ formatDate(user.last_login) }}</td>
            </tr>
            <tr>
              <td><strong>검색나이</strong></td>
              <td class="readonly">{{ user.search_birthyear1 }} ~ {{ user.search_birthyear2 }}</td>
            </tr>
            <tr>
              <td><strong>검색지역</strong></td>
              <td class="readonly">{{ user.search_region1 }} {{ user.search_region2 }}</td>
            </tr>
            <tr>
              <td><strong>검색특징</strong></td>
              <td class="readonly">{{ user.search_preference }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>
    </div>

    <!-- 🔹 외부 팝업 모달 연결 -->
    <PopupModal_1 v-if="showModal1" :message="popupMessage" @close="showModal1 = false" />
    <PopupModal_2 v-if="showModal2" :message="popupMessage" @close="showModal2 = false" />
    <PopupModal_3 v-if="showModal3" :message="popupMessage" @close="showModal3 = false" />
    <PopupModal_4 v-if="showModal4" :message="popupMessage" @close="showModal4 = false" />



  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/lib/axiosInstance'
import { IonButton } from '@ionic/vue'
import { useRouter } from 'vue-router'

// 외부 팝업 컴포넌트
import PopupModal_1 from '@/components/modal/Modal_region.vue'
import PopupModal_2 from '@/components/modal/Modal_preference.vue'
import PopupModal_3 from '@/components/modal/Modal_mention.vue'
import PopupModal_4 from '@/components/modal/Modal_nickname.vue'

const router = useRouter()
const nickname = ref('')
const user = ref(null)

// 팝업 상태
const showModal1 = ref(false)
const showModal2 = ref(false)
const showModal3 = ref(false)
const showModal4 = ref(false)
const popupMessage = ref('')

// 팝업 열기
const openPopup = (modalNum, value) => {
  popupMessage.value = value
  showModal1.value = modalNum === 1
  showModal2.value = modalNum === 2
  showModal3.value = modalNum === 3
  showModal4.value = modalNum === 4

}

// 사용자 정보 로딩
onMounted(async () => {
  try {
    const resUser = await axios.get('/api/me', { withCredentials: true })
    nickname.value = resUser.data.user?.nickname || ''
    user.value = resUser.data.user
  } catch (err) {
    console.error('유저 정보 로딩 실패:', err)
  }
})

const formatDate = (dateStr) => {
  if (!dateStr) return '없음'
  return new Date(dateStr).toLocaleString()
}

// 로그아웃
const logout = async () => {
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    router.push('/login')
  } catch (err) {
    console.error('로그아웃 실패:', err)
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
  color: #000;
}

.container {
  width: 100%;
  height: 100%;
  max-width: 100%;
  padding: 1rem;
  box-sizing: border-box;
  margin: 0 auto;
}

.card {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 1rem;
  background-color: #fff;
  color: #222;
}
.card h3 {
  margin: 0.3rem 0;
  font-size: 1rem;
  font-weight: 500;
  color: #111;
  text-align: left;
  line-height: 0.2;
}

.info-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  font-size: 0.9rem;
}
.info-table td {
  padding: 0.5rem;
  border-bottom: 1px solid #ddd;
}
.info-table td:first-child {
  font-weight: bold;
  width: 30%;
  color: #333;
}
.info-table td:last-child {
  text-align: left;
}

/* ✅ 수정 가능 항목 */
.editable-row {
  cursor: pointer;
}
.editable-text {
  color: #000;
}
.editable-row:hover {
  background-color: #f5f5f5;
}

/* ❌ 수정 불가능 항목 */
.readonly {
  color: #aaa;
}

.loading-text {
  color: #999;
  text-align: center;
}
</style>
