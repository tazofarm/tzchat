<template>
  <!-- 🔹 상단바 (반갑습니다 / 관리자 / 로그아웃) -->
  <div class="top-bar">
    <!-- 왼쪽: 인사말 -->
    <div class="top-left">
      <ion-icon :icon="icons.happyOutline" class="icon-left" aria-hidden="true" />
      <span class="welcome-text">{{ nickname }}님 반갑습니다.</span>
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
        관리자페이지
      </ion-button>
    </div>
  </div>

  <!-- 🔹 리스트 (0001~0020 + 회원탈퇴) -->
  <section class="page-wrap" role="region" aria-label="설정 목록">
    <div class="list-wrap">
      <ul class="list">
        <!-- 번호 리스트 -->
        <li class="list-item" @click="goPage('/home/setting/0001')">구독신청하기01</li>

        <li class="list-item" @click="goPage('/home/setting/0002')">공지사항02</li>

        <!-- ✅ 변경: 클릭 시 페이지 이동 대신 즉시 메일 열기 -->
        <li class="list-item" @click="openSupportMail">문의/건의 하기 (E-mail)</li>

        <li class="list-item" @click="goPage('/home/legals/v2')">약관 및 법적조치</li>

        <li class="list-item" @click="goPage('/home/setting/0019')">비밀번호변경</li>

        <!-- 로그아웃 버튼 -->
        <li class="withdraw-button" @click="logout">
        <!--  
          <ion-icon :icon="icons.trashOutline" class="icon-left" aria-hidden="true" />
        -->  
          <span>로그아웃</span>
        </li>

        <!-- 회원탈퇴 버튼 -->
        <li class="withdraw-button" @click="goPage('/home/setting/0020')">
        <!--  
          <ion-icon :icon="icons.trashOutline" class="icon-left" aria-hidden="true" />
        -->  
          <span>회원탈퇴20</span>
        </li>

        <!-- ✅ 권한 관련: 알림/위치 요청 -->
        <li class="list-item" @click="askPerms">
          <ion-icon :icon="icons.notificationsOutline" class="icon-left" aria-hidden="true" />
          <span>권한 요청 (알림/위치)</span>
        </li>

        <!-- ✅ 권한 관련: 테스트 알림 보내기 -->
        <li class="list-item" @click="sendTestNoti">
          <ion-icon :icon="icons.locateOutline" class="icon-left" aria-hidden="true" />
          <span>테스트 알림 보내기</span>
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
  trashOutline,
  notificationsOutline,
  locateOutline,
} from 'ionicons/icons'
import { api, AuthAPI } from '@/lib/api'
import { Capacitor } from '@capacitor/core'
import {
  requestBasicPermissions,
  testLocalNotification,
} from '@/lib/permissions'

const router = useRouter()
const icons = {
  happyOutline,
  settingsOutline,
  logOutOutline,
  trashOutline,
  notificationsOutline,
  locateOutline,
}

const nickname = ref<string>('')
const meRole = ref<string>('')

/** 로그인 사용자 정보 가져오기 */
onMounted(async () => {
  try {
    const meRes = await api.get('/api/me')
    nickname.value = meRes.data?.user?.nickname || ''
    meRole.value = meRes.data?.user?.role || ''
    console.log('[SettingsSections] me:', { nickname: nickname.value, role: meRole.value })
  } catch (err) {
    console.error('❌ GET /me 실패:', err)
  }
})

/** 페이지 이동 */
const goPage = (path: string) => {
  console.log('[SettingsSections] goPage:', path)
  router.push(path)
}

/** 관리자 이동 */
const goAdmin = () => {
  console.log('[SettingsSections] goAdmin → /home/admin')
  router.push('/home/admin')
}

/** 로그아웃 */
const logout = async () => {
  try {
    await AuthAPI.logout()
    console.info('[SettingsSections] 로그아웃 성공 → /login')
    router.push('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
  }
}

/* -------------------- 메일 바로 열기 유틸 -------------------- */
// 스토어 없이 localStorage 폴백
function getUserId() {
  return (
    localStorage.getItem('userId') ||
    localStorage.getItem('id') ||
    localStorage.getItem('_id') ||
    'unknown'
  )
}
function getNicknameLS() {
  return (
    localStorage.getItem('nickname') ||
    localStorage.getItem('username') ||
    localStorage.getItem('name') ||
    'unknown'
  )
}
function detectOS() {
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  return 'Web'
}
async function getAppVersion() {
  try {
    const mod = await import('@capacitor/app')
    const info = await mod.App.getInfo()
    return info.version || info.build || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** ✅ 상위 메뉴에서 바로 실행되는 메일 열기 */
async function openSupportMail() {
  const email = 'tazocode@gmail.com'         // 수신자
  const subject = '네네챗 문의드립니다'       // 제목

  const [appVersion, os, uid, nick] = await Promise.all([
    getAppVersion(),
    Promise.resolve(detectOS()),
    Promise.resolve(getUserId()),
    Promise.resolve(getNicknameLS()),
  ])

  const body = [
    '문의 내용:',
    '',
    '--- 사용자 정보 ---',
    `아이디: ${uid}`,
    `닉네임: ${nick}`,
    '',
    '--- 앱/환경 정보 ---',
    `앱 버전: ${appVersion}`,
    `OS: ${os}`,
    '',
    '--- 작성 ---',
  ].join('\n')

  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = href
}

/** ✅ 권한 요청(알림/위치) */
const askPerms = async () => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      console.log('↪️ non-Android platform: 권한 요청은 Android에서만 수행됩니다.')
      return
    }
    const res = await requestBasicPermissions()
    console.log('[SettingsSections] 권한 요청 결과:', res)
    if (res.notification) {
      console.log('🔔 알림 권한 승인됨 → 테스트 알림 예약')
      await testLocalNotification()
    }
  } catch (e: any) {
    console.warn('⚠️ 권한 요청 중 오류:', e?.message)
  }
}

/** ✅ 테스트 알림 (알림 권한 승인 시 표시) */
const sendTestNoti = async () => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      console.log('↪️ non-Android platform: 테스트 알림은 Android에서만 수행됩니다.')
      return
    }
    await testLocalNotification()
    console.log('✅ 테스트 알림 스케줄 완료')
  } catch (e: any) {
    console.warn('⚠️ 테스트 알림 오류:', e?.message)
  }
}
</script>

<style scoped>
/* (스타일 동일, 생략 없이 기존 그대로 유지) */
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
  --padding-start: 6px;
  --padding-end: 6px;
  min-height: 24px;
  font-size: 13px;
}
.top-left { justify-self: start; display: flex; align-items: center; }
.top-center { justify-self: center; }
.top-right { justify-self: end; }
.icon-left { font-size: 18px; color: var(--text-dim); margin-right: 6px; }
.welcome-text {
  font-weight: 600; font-size: 15px; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.page-wrap { background: var(--panel-2); min-height: 100%; padding: 14px 12px 22px; box-sizing: border-box; }
.list-wrap { width: min(92vw, 480px); margin: 0 auto; }
.list { list-style: none; margin: 0; padding: 0; }
.list-item {
  display: flex;
  justify-content: center;     /* 🔹 가로 중앙 */
  align-items: center;         /* 🔹 세로 중앙 */
  height: 40px; /* 🔹 원하는 높이 지정 (예: 40~56px) */
  border-radius: 12px;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  margin: 10px 0;
  border-radius: 12px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
  border: 1.5px solid var(--panel-border);
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.25), inset 0 0 0.5px rgba(255,255,255,0.04);
  transition: border-color 0.18s, color 0.18s, transform 0.06s;
}
.list-item:hover { border-color: rgba(212,175,55,0.65); color: var(--accent-gold, #d4af37); }
.list-item:active { transform: translateY(1px); }
.withdraw-button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 40px;        /* 버튼 높이 */
  padding: 0 18px;     /* 좌우 여백만 */
  border-radius: 12px;
  margin: 14px 0 6px;
  background: linear-gradient(180deg, #dc3545 0%, #b02a37 100%);
  border: 1.5px solid #656364;      /* border: 1.5px solid #b02a37; */
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.25),
              inset 0 0 0.5px rgba(255,255,255,0.12);
  transition: filter 0.18s, transform 0.06s, border-color 0.18s;
}
.withdraw-button:hover { filter: brightness(1.02); border-color: #962231; }
.withdraw-button:active { transform: translateY(1px); }
.withdraw-button .icon-left { font-size: 18px; }
</style>
