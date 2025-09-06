<template>
  <div class="page-wrapper">
    <div class="top-bar">
      <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
      <ion-button size="small" color="danger" @click="logout">로그아웃</ion-button>
    </div>

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

            <tr @click="openPopup(4, user.nickname)" class="editable-row">
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
              <td class="readonly">{{ toAll(user.search_birthyear1) }} ~ {{ toAll(user.search_birthyear2) }}</td>
            </tr>
            <tr>
              <td><strong>검색지역</strong></td>
              <td class="readonly">{{ user.search_region1 }} {{ user.search_region2 }}</td>
            </tr>
            <tr>
              <td><strong>검색특징</strong></td>
              <td class="readonly">{{ user.search_preference }}</td>
            </tr>

            <tr>
              <td><strong>친구목록</strong></td>
              <td class="readonly">
                <div v-if="user.friendlist.length === 0">친구 없음</div>
                <ul>
                  <li v-for="f in user.friendlist" :key="f._id">
                    {{ f.nickname }} ({{ f.username }}) - {{ f.birthyear }}년생 / {{ f.gender === 'man' ? '남자' : f.gender === 'woman' ? '여자' : '' }}
                  </li>
                </ul>
              </td>
            </tr>

            <tr>
              <td><strong>차단목록</strong></td>
              <td class="readonly">
                <div v-if="user.blocklist.length === 0">차단 없음</div>
                <ul>
                  <li v-for="b in user.blocklist" :key="b._id">
                    {{ b.nickname }} ({{ b.username }}) - {{ b.birthyear }}년생 / {{ b.gender === 'man' ? '남자' : b.gender === 'woman' ? '여자' : '' }}
                  </li>
                </ul>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
      <p v-else class="loading-text">유저 정보를 불러오는 중입니다...</p>
    </div>

    <!-- 모달 -->
    <PopupModal_1 v-if="showModal1" :message="popupMessage" @close="showModal1 = false" @updated="handleRegionUpdate" />
    <PopupModal_2 v-if="showModal2" :message="popupMessage" @close="showModal2 = false" @updated="handlePreferenceUpdate" />
    <PopupModal_3 v-if="showModal3" :message="popupMessage" @close="showModal3 = false" @updated="handleIntroUpdate" />
    <PopupModal_4 v-if="showModal4" :message="popupMessage" @close="showModal4 = false" @updated="handleNicknameUpdate" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/lib/api'
import { IonButton } from '@ionic/vue'
import { useRouter } from 'vue-router'

import PopupModal_1 from '@/components/04610_Page6_profile/Modal_region.vue'
import PopupModal_2 from '@/components/04610_Page6_profile/Modal_preference.vue'
import PopupModal_3 from '@/components/04610_Page6_profile/Modal_mention.vue'
import PopupModal_4 from '@/components/04610_Page6_profile/Modal_nickname.vue'

const router = useRouter()
const nickname = ref('')
const user = ref(null)

const showModal1 = ref(false)
const showModal2 = ref(false)
const showModal3 = ref(false)
const showModal4 = ref(false)
const popupMessage = ref('')

// null, '', undefined → '전체'
const toAll = (v) => (v === null || v === undefined || v === '' ? '전체' : v)

const openPopup = (modalNum, value) => {
  popupMessage.value = value
  showModal1.value = modalNum === 1
  showModal2.value = modalNum === 2
  showModal3.value = modalNum === 3
  showModal4.value = modalNum === 4
}

const handleNicknameUpdate = (newName) => {
  if (user.value) {
    user.value.nickname = newName
    nickname.value = newName
  }
}
const handleRegionUpdate = (r1, r2) => {
  if (user.value) {
    user.value.region1 = r1
    user.value.region2 = r2
  }
}
const handlePreferenceUpdate = (newPref) => {
  if (user.value) {
    user.value.preference = newPref
  }
}
const handleIntroUpdate = (newIntro) => {
  if (user.value) {
    user.value.selfintro = newIntro
  }
}

onMounted(async () => {
  try {
    const res = await axios.get('/api/me', { withCredentials: true })
    nickname.value = res.data.user?.nickname || ''
    user.value = res.data.user
  } catch (err) {
    console.error('유저 정보 로딩 실패:', err)
  }
})

const formatDate = (dateStr) => {
  if (!dateStr) return '없음'
  return new Date(dateStr).toLocaleString()
}

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
  max-width: 100%;
  padding: 1rem;
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

/* 수정 가능한 항목 */
.editable-row {
  cursor: pointer;
}
.editable-text {
  color: #000;
}
.editable-row:hover {
  background-color: #f5f5f5;
}

/* 읽기 전용 항목 → 회색 글씨 */
.readonly {
  color: #aaa;
}

.loading-text {
  color: #999;
  text-align: center;
}
</style>
