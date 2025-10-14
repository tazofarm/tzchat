<template>
  <!-- 🔹 상단바 (반갑습니다 / 관리자 / 로그아웃) -->
  <div class="top-bar">
    <!-- 왼쪽: 인사말 -->
    <div class="top-left">
      <ion-icon :icon="icons.happyOutline" class="icon-left" aria-hidden="true" />
      <span class="welcome-text">{{ nickname }} 관리자 페이지</span>
    </div>

    <!-- 가운데: 관리자 버튼 (role이 master일 때만) -->
    <div class="top-center">
      <ion-button
        v-if="meRole === 'master'"
        size="small"
        class="btn-outline admin-btn"
        @click="goAdmin"
      >
        <ion-icon :icon="icons.settingsOutline" slot="start" />
        Set
      </ion-button>
    </div>

    <!-- 오른쪽: 로그아웃 -->
    <div class="top-right">
      <ion-button size="small" class="btn-danger" @click="logout">
        <ion-icon :icon="icons.logOutOutline" slot="start" />
        로그아웃
      </ion-button>
    </div>
  </div>

  <!-- 🔹 리스트 (0001~0020 + 회원탈퇴) -->
  <section class="page-wrap" role="region" aria-label="설정 목록">
    <div class="list-wrap">
      <ul class="list">
        <!-- 번호 리스트 -->

        
        <li class="list-item" @click="goPage('/home/legals/v2')">약관 및 법적조치(수정)</li>
        <li class="list-item" @click="goPage('/home/admin/0001')">0001_Heartbeat</li>
        <li class="list-item" @click="goPage('/home/admin/0002')">0002_회원검색</li>
        <li class="list-item" @click="goPage('/home/admin/0003')">0003_alluser</li>
        <li class="list-item" @click="goPage('/home/admin/0004')">0004_통계요약</li>
        <li class="list-item" @click="goPage('/home/admin/0005')">0005_온라인현황</li>
        <li class="list-item" @click="goPage('/home/admin/0006')">0006_공지사항</li>
        <li class="list-item" @click="goPage('/home/admin/0007')">0007_신고관리</li>
        <li class="list-item" @click="goPage('/home/admin/0008')">0008_채팅룸관리</li>
        <li class="list-item" @click="goPage('/home/admin/0009')">0009_시스템설정</li>
        <li class="list-item" @click="goPage('/home/admin/0010')">0010</li>
        <li class="list-item" @click="goPage('/home/admin/0011')">0011</li>
        <li class="list-item" @click="goPage('/home/admin/0012')">0012</li>
        <li class="list-item" @click="goPage('/home/admin/0013')">0013</li>
        <li class="list-item" @click="goPage('/home/admin/0014')">0014</li>
        <li class="list-item" @click="goPage('/home/admin/0015')">0015</li>
        <li class="list-item" @click="goPage('/home/admin/0016')">0016</li>
        <li class="list-item" @click="goPage('/home/admin/0017')">0017</li>
        <li class="list-item" @click="goPage('/home/admin/0018')">0018</li>
        <li class="list-item" @click="goPage('/home/admin/0019')">0019</li>
        <li class="list-item" @click="goPage('/home/admin/0020')">0020</li>

        <!-- 회원탈퇴 버튼 -->
        <li class="withdraw-button" @click="withdraw">
          <ion-icon :icon="icons.trashOutline" class="icon-left" aria-hidden="true" />
          <span>회원탈퇴</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { IonButton, IonIcon } from '@ionic/vue'
import {
  happyOutline,
  settingsOutline,
  logOutOutline,
  trashOutline
} from 'ionicons/icons'
import axios from '@/lib/api'

const router = useRouter()
const icons = { happyOutline, settingsOutline, logOutOutline, trashOutline }

const nickname = ref<string>('')
const meRole = ref<string>('')

/** 로그인 사용자 정보 가져오기 */
onMounted(async () => {
  try {
    const meRes = await axios.get('/api/me', { withCredentials: true })
    nickname.value = meRes.data?.user?.nickname || ''
    meRole.value = meRes.data?.user?.role || ''
    console.log('[SettingsSections] me:', { nickname: nickname.value, role: meRole.value })
  } catch (err) {
    console.error('❌ /api/me 실패:', err)
  }
})

/** 페이지 이동 */
const goPage = (path: string) => {
  console.log('[SettingsSections] goPage:', path)
  router.push(path)
}

/** 관리자 이동 */
const goAdmin = () => {
  console.log('[SettingsSections] goAdmin → /home/7page')
  router.push('/home/7page')
}

/** 로그아웃 */
const logout = async () => {
  try {
    await axios.post('/api/logout', {}, { withCredentials: true })
    console.info('[SettingsSections] 로그아웃 성공 → /login')
    router.push('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
  }
}

/** 회원탈퇴 */
const withdraw = () => {
  console.log('[SettingsSections] 회원탈퇴 클릭됨')
  alert('회원탈퇴 기능이 실행됩니다.')
}
</script>

<style scoped>
/* =========================================================
   상단바 (반갑습니다 / 관 / 로그아웃)
========================================================= */
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  padding: 2px 12px;
  background-color: var(--panel-2);
  border-bottom: 1px solid var(--panel-border);
}

.top-bar ion-button {
  --border-radius: 8px;
  --padding-start: 6px;    /* 좌우 패딩 줄임 */
  --padding-end: 6px;
  min-height: 24px;        /* 버튼 높이 줄임 */
  font-size: 13px;         /* 버튼 글자 크기 줄임 */
}
.top-left { justify-self: start; display: flex; align-items: center; }
.top-center { justify-self: center; }
.top-right { justify-self: end; }

.icon-left {
  font-size: 18px;
  color: var(--text-dim);
  margin-right: 6px;
}
.welcome-text {
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* =========================================================
   리스트 (0001 ~ 0020 + 회원탈퇴)
========================================================= */
.page-wrap {
  background: var(--panel-2);
  min-height: 100%;
  padding: 14px 12px 22px;
  box-sizing: border-box;
}
.list-wrap {
  width: min(92vw, 480px);
  margin: 0 auto;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  margin: 10px 0;
  border-radius: 12px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
  border: 1px solid var(--panel-border);
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.25),
              inset 0 0 0.5px rgba(255,255,255,0.04);
  transition: border-color 0.18s, color 0.18s, transform 0.06s;
}
.list-item:hover {
  border-color: rgba(212,175,55,0.65);
  color: var(--accent-gold, #d4af37);
}
.list-item:active {
  transform: translateY(1px);
}

/* 회원탈퇴 버튼 */
.withdraw-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  margin: 14px 0 6px;
  border-radius: 12px;
  background: linear-gradient(180deg, #dc3545 0%, #b02a37 100%);
  border: 1px solid #b02a37;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.25),
              inset 0 0 0.5px rgba(255,255,255,0.12);
  transition: filter 0.18s, transform 0.06s, border-color 0.18s;
}
.withdraw-button:hover {
  filter: brightness(1.02);
  border-color: #962231;
}
.withdraw-button:active {
  transform: translateY(1px);
}
.withdraw-button .icon-left {
  font-size: 18px;
}
</style>
