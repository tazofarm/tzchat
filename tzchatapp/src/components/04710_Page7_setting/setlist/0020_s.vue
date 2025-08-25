<template>
  <ion-page>
    <!-- ✅ 상단 헤더 -->
    <ion-header>
      <ion-toolbar>
        <!-- 뒤로가기 버튼 -->
        <ion-buttons slot="start">
          <ion-button class="back-btn" @click="goBack">←</ion-button>
        </ion-buttons>

        <!-- 가운데 제목 -->
        <ion-title>간단 페이지</ion-title>
      </ion-toolbar>
    </ion-header>

    <!-- ✅ 본문 -->
    <ion-content class="ion-padding">
      <p class="text-white">구독 취소 확인하기</p>
      <p class="text-white">환불 처리 확인하기</p>

      <!-- 📘 안내: 탈퇴 동작 설명 -->
      <div class="text-white" style="margin-top:16px;">
        <strong>탈퇴하기 동작 안내</strong><br />
        - 아래 <em>탈퇴하기</em> 버튼을 누르면 서버의 <code>POST /api/account/delete-request</code> 라우터가 호출됩니다.<br />
        - 서버는 계정을 <code>pendingDeletion</code> 상태로 전환하고, 유예기간(예: 14일) 후 영구 삭제를 예약합니다.<br />
        - 요청이 성공하면 세션이 종료(로그아웃)되며, 앱은 로그인 화면으로 이동합니다.<br />
        - 네트워크/서버 오류 시 에러 메시지가 표시되며, 콘솔에 상세 로그가 남습니다.
      </div>
    </ion-content>

    <!-- ✅ 가장 밑: 탈퇴하기 버튼 (footer) -->
    <ion-footer>
      <ion-toolbar>
        <ion-button
          expand="block"
          color="danger"
          :disabled="deleting"
          @click="onClickDelete"
          aria-label="회원 탈퇴 요청"
        >
          {{ deleting ? '처리 중…' : '탈퇴하기' }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonTitle,
  IonContent,
  IonFooter
} from '@ionic/vue'
import { useRouter } from 'vue-router'
import { ref } from 'vue'

const router = useRouter()

/** 뒤로가기 동작 */
const goBack = () => {
  console.log('[SimplePage] 뒤로가기 클릭')
  router.back()
}

/** 탈퇴 처리 진행 상태 */
const deleting = ref(false)

/**
 * ✅ 탈퇴 버튼 클릭 핸들러
 * - 1) 사용자 확인(confirm)
 * - 2) /api/account/delete-request (POST, credentials 포함) 호출
 * - 3) 성공 시 안내(alert) 후 로그인 화면으로 이동 (세션 만료 고려)
 * - 4) 실패/오류는 alert + 콘솔 로그
 */
const onClickDelete = async () => {
  console.log('[Delete] 버튼 클릭')
  const confirmed = window.confirm(
    '정말 탈퇴하시겠습니까?\n탈퇴 신청 시 계정이 비활성화되고, 유예기간(예: 14일) 후 영구 삭제됩니다.'
  )
  if (!confirmed) {
    console.log('[Delete] 사용자가 취소함')
    return
  }

  deleting.value = true
  try {
    console.log('[Delete] 서버 요청 시작: POST /api/account/delete-request')
    const res = await fetch('/api/account/delete-request', {
      method: 'POST',
      credentials: 'include', // 세션 쿠키 포함
      headers: { 'Content-Type': 'application/json' }
    })

    // 응답 안전 파싱
    const raw = await res.text()
    let data: any = null
    try { data = JSON.parse(raw) } catch { data = { message: raw } }

    if (!res.ok) {
      console.error('[Delete] 서버 에러', res.status, data)
      alert(`탈퇴 신청 실패 (${res.status})\n${data?.error || data?.message || '잠시 후 다시 시도해주세요.'}`)
      return
    }

    console.log('[Delete] 성공 응답', data)
    alert(data?.message || '탈퇴가 신청되었습니다.')
    // 로컬 데이터 정리(선택)
    try { localStorage.clear(); sessionStorage.clear() } catch (e) { console.warn('[Delete] storage clear 실패', e) }

    // 로그인 화면으로 이동 (라우트는 프로젝트에 맞게 조정)
    router.replace('/login').catch(() => router.replace('/'))
  } catch (e) {
    console.error('[Delete] 네트워크 오류', e)
    alert('네트워크 오류로 탈퇴 신청에 실패했습니다. 인터넷 연결을 확인 후 다시 시도해주세요.')
  } finally {
    deleting.value = false
    console.log('[Delete] 처리 종료')
  }
}
</script>

<style scoped>
/* ✅ 상단바 스타일 */
ion-toolbar {
  --background: #1e1e1e; /* 다크 배경 */
  --color: #fff;         /* 기본 텍스트 흰색 */
  padding: 0 6px;
  min-height: 48px;
}
ion-title {
  font-weight: 600;
  font-size: clamp(16px, 4vw, 18px);
  color: #fff;
  text-align: center;
}

/* ✅ 버튼 */
.back-btn {
  color: #fff;
  font-size: clamp(16px, 4vw, 18px);
  font-weight: 600;
  padding: 4px 8px;
  min-width: 40px;
}
.back-btn:hover {
  background: rgba(255,255,255,0.1);
  border-radius: 6px;
}

/* ✅ 본문 */
ion-content {
  --background: #121212;
}

.text-white {
  color: #fff; /* 본문 글씨 흰색 */
  font-size: clamp(14px, 3.8vw, 16px);
  line-height: 1.5;
}

/* ✅ 하단 푸터(버튼 영역)도 다크톤 유지 */
ion-footer {
  --background: #1e1e1e;
}
</style>
