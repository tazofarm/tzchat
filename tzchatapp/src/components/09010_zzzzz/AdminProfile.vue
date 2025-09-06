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

            <!-- ✅ 친구 목록 표시 -->
            <tr>
              <td><strong>친구목록</strong></td>
              <td>
                <div v-if="user.friendlist.length === 0">친구 없음</div>
                <ul>
                  <li v-for="f in user.friendlist" :key="f._id">
                    {{ f.nickname }} ({{ f.username }}) - {{ f.birthyear }}년생 / {{ f.gender === 'man' ? '남자' : f.gender === 'woman' ? '여자' : '' }}
                  </li>
                </ul>
              </td>
            </tr>

            <!-- ✅ 차단 목록 표시 -->
            <tr>
              <td><strong>차단목록</strong></td>
              <td>
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

import PopupModal_1 from '@/components/06050_Modalprofile/Modal_region.vue'
import PopupModal_2 from '@/components/06050_Modalprofile/Modal_preference.vue'
import PopupModal_3 from '@/components/06050_Modalprofile//Modal_mention.vue'
import PopupModal_4 from '@/components/06050_Modalprofile/Modal_nickname.vue'

const router = useRouter()
const nickname = ref('')
const user = ref(null)

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

// 모달 emit 처리
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

// ✅ 유저 정보 로드 (friends, blocks populate 포함)
onMounted(async () => {
  try {
    const res = await axios.get('/api/me', { withCredentials: true })
    nickname.value = res.data.user?.nickname || ''
    user.value = res.data.user
  } catch (err) {
    console.error('유저 정보 로딩 실패:', err)
  }
})

// 날짜 포맷
const formatDate = (dateStr) => {
  if (!dateStr) return '없음'
  return new Date(dateStr).toLocaleString()
}

// 로그아웃 처리
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
/* ── profile page: CSS 보정만 적용 ──
   - 상단바 높이/간격 통일(50px)
   - 카드/테이블 가독성 스케일 통일
   - 클릭 편의/접근성 강화
   - safe-area 보정
*/

/* Ion 컨텐츠 톤(필요 시 유지) */
/* ion-content { --background:#fff; color:#000; } */

/* 상단 바 */
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto;   /* 텍스트 | 버튼 */
  align-items: center;
  gap: 10px;

  height: 50px;                      /* 고정 높이(프로젝트 공통) */
  padding: 0 12px;
  background-color: #f1f1f1;
  border-bottom: 1px solid #ccc;
  color: #000;
}
.welcome-text {
  font-weight: 700;
  color: #000;
  font-size: clamp(15px, 2.6vw, 16px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top-bar ion-button {
  --border-radius: 12px;
  --padding-start: 12px;
  --padding-end: 12px;
  min-height: 40px;
}

/* 컨테이너 */
.container {
  width: 100%;
  max-width: 100%;
  padding: 12px;
  margin: 0 auto;
  box-sizing: border-box;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

/* 카드 */
.card {
  border: 1px solid #ccc;
  border-radius: 12px;
  padding: 14px;
  background-color: #fff;
  color: #222;
  box-shadow: 0 2px 6px rgba(0,0,0,.04);
}
.card h3 {
  margin: 0 0 8px;
  font-size: clamp(16px, 3.2vw, 18px);
  font-weight: 700;
  color: #111;
  text-align: left;
  line-height: 1.3;                  /* 0.2 → 가독성 보정 */
}

/* 정보 테이블 */
.info-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 6px;
  font-size: clamp(14px, 2.6vw, 15px);
}
.info-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #e6e6e6;
  vertical-align: top;
}
.info-table td:first-child {
  font-weight: 700;
  width: 32%;
  color: #333;
  white-space: nowrap;
}
.info-table td:last-child {
  text-align: left;
  word-break: break-word;
}

/* 수정 가능한 행 */
.editable-row {
  cursor: pointer;
  transition: background-color .15s;
}
.editable-row:hover {
  background-color: #f7f7f7;
}
.editable-text { color: #000; }

/* 읽기 전용 톤 */
.readonly { color: #777; }

/* 리스트(친구/차단) 가독성 */
.info-table ul {
  margin: 6px 0 0;
  padding-left: 16px;
}
.info-table li {
  margin: 4px 0;
  line-height: 1.35;
  color: #111;
  font-size: clamp(14px, 2.6vw, 15px);
}

/* 로딩 텍스트 */
.loading-text {
  color: #666;
  text-align: center;
  font-size: clamp(15px, 2.6vw, 16px);
  margin: 16px 0;
}

/* 초소형 화면 보정 */
@media (max-width: 360px) {
  .top-bar { padding: 0 10px; gap: 8px; }
  .container { padding: 10px; }
  .card { padding: 12px; }
  .info-table td { padding: 8px 6px; }
}

</style>
