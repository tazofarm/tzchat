<!-- src/components/SettingsSections.vue -->
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
        <li class="list-item" @click="goPage('/home/setting/0002')">구독신청하기</li>
        <li class="list-item" @click="goPage('/home/setting/0001')">공지사항</li>

        <!-- ✅ 메일 열기 -->
        <li class="list-item" @click="openSupportMail">문의/건의 하기 (E-mail)</li>

        <li class="list-item" @click="goPage('/home/legals/v2')">약관 및 법적조치</li>
        <li class="list-item" @click="goPage('/home/setting/0019')">비밀번호변경</li>

        <!-- 로그아웃 버튼 -->
        <li class="withdraw-button" @click="logout">
          <span>로그아웃</span>
        </li>

        <!-- 회원탈퇴 버튼 -->
        <li class="withdraw-button" @click="goPage('/home/setting/0020')">
          <span>회원탈퇴</span>
        </li>

        <!-- ✅ 권한 요청 (알림/위치) -->
        <li class="list-item" @click="askPerms">
          <ion-icon :icon="icons.notificationsOutline" class="icon-left" aria-hidden="true" />
          <span>권한 요청 (알림/위치)</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { IonButton, IonIcon } from '@ionic/vue'
import { App } from '@capacitor/app'
import {
  happyOutline,
  settingsOutline,
  notificationsOutline,
} from 'ionicons/icons'
import { api, AuthAPI } from '@/lib/api'
import { Capacitor } from '@capacitor/core'
import { requestBasicPermissions } from '@/lib/permissions'

const router = useRouter()
const icons = {
  happyOutline,
  settingsOutline,
  notificationsOutline,
}

const nickname = ref('')
const meRole = ref('')

/** 로그인 사용자 정보 */
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
const goPage = (path: string) => router.push(path)

/** 관리자 이동 */
const goAdmin = () => router.push('/home/admin')

/** 로그아웃 */
const logout = async () => {
  try {
    await AuthAPI.logout()
    router.push('/login')
  } catch (err) {
    console.error('❌ 로그아웃 실패:', err)
  }
}

/* -------------------- 메일 바로 열기 -------------------- */
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
    const info = await App.getInfo()
    return info.version || String((info as any).build) || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** 문의/건의 메일 열기 */
async function openSupportMail() {
  const email = 'tazocode@gmail.com'
  const subject = '네네챗 문의드립니다'

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

/** ✅ 권한 요청 (앱 시작 시 진동 방지 포함) */
const askPerms = async () => {
  try {
    if (Capacitor.getPlatform() !== 'android') {
      console.log('↪️ non-Android platform: 권한 요청은 Android에서만 수행됩니다.')
      return
    }
    const res = await requestBasicPermissions()
    console.log('[SettingsSections] 권한 요청 결과:', res)
    // 앱 시작 시 불필요한 진동 방지 (테스트 알림 제거)
  } catch (e: any) {
    console.warn('⚠️ 권한 요청 중 오류:', e?.message)
  }
}
</script>

<style scoped>
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
  justify-content: center;
  align-items: center;
  height: 40px;
  border-radius: 12px;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  margin: 10px 0;
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
  height: 40px;
  padding: 0 18px;
  border-radius: 12px;
  margin: 14px 0 6px;
  background: linear-gradient(180deg, #dc3545 0%, #b02a37 100%);
  border: 1.5px solid #656364;
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
