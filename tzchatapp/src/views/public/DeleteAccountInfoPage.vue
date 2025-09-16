<template>
  <ion-page>
    <!-- 상단 헤더(공개 페이지) -->
    <ion-header>
      <ion-toolbar>
        <ion-title>계정 및 데이터 삭제 안내</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding content-light">
      <!-- 안내 본문: 줄바꿈 유지 -->
      <pre class="terms-text" aria-label="계정 삭제 안내 전문">
[앱/개발자]
- 앱명: 네네챗 (NeneChat)
- 개발자: 김영주 / 연락: tazocode@gmail.com

[삭제 방법]
1) 앱에서: 설정 → 계정 → "탈퇴하기" 버튼을 눌러 탈퇴 신청을 완료합니다.
2) 앱 없이 웹에서 요청: 아래 "삭제 요청 폼"을 제출해 주세요.
   - 본인 확인을 위해 접수 후 추가 확인(예: 1회용 코드 전송)을 진행할 수 있습니다.

[삭제되는 데이터]
- 계정 정보(아이디/닉네임/성별/출생년도 등), 친구/차단 목록, 프로필 이미지, 설정값

[보관/예외]
- 채팅 메시지: 상대방 기록 보존을 위해 발신자 표시만 "탈퇴한 사용자"로 가명처리되어 상대방 기기에서 보일 수 있음
- 결제/정산 등 법령상 보관 의무 데이터: 관련 법정 기간 동안 별도 분리 보관 후 파기

[유예 기간]
- 탈퇴 신청 후 14일 유예 → 경과 시 복구 불가의 영구 삭제 진행

[백업 보유 기간]
- 백업본은 최대 90일 이내 순차 삭제

[추가 안내]
- 자세한 개인정보 처리 원칙은 개인정보 처리방침을 참고해 주세요.

[데이터 일부 삭제 요청 방법]
- 앱 내에서:
  1) 설정 → 프로필 이미지 삭제
  2) 설정 → 자기소개/검색조건 초기화(비움 저장)
  3) 친구/차단 관리에서 항목 삭제
- 앱 없이도 웹에서 요청 가능: 본 페이지 하단의 "데이터 일부 삭제 요청" 폼을 제출해 주세요.
  * 본인 확인을 위해 접수 후 1회용 코드 확인 절차가 있을 수 있습니다.

[삭제/보관 항목 및 추가 보관 기간]
- 즉시 또는 처리 후 삭제되는 데이터: 프로필(닉네임/성별/출생년도/지역/특징/자기소개), 프로필 이미지, 친구/차단 목록, 검색 설정 등
- 채팅 메시지: 상대방 기록 보존을 위해 발신자 표시는 "탈퇴한 사용자"로 가명처리되어 상대방 기기에서 보일 수 있습니다. (분쟁 대응 목적)
- 법정 보관 의무 데이터(결제/정산 등): 관련 법정 기간 동안 별도 분리 보관 후 파기
- 백업 데이터: 최대 90일 내 순차 삭제




      </pre>

      <!-- 삭제 요청 폼(선택 구현: 스토어에선 "요청 가능" 경로가 보이면 충분) -->
      <form class="delete-form" @submit.prevent="submitForm" aria-label="계정 삭제 요청 폼">
        <h2>삭제 요청 폼</h2>
        <label class="label">
          아이디(필수)
          <input v-model.trim="form.username" required placeholder="가입 아이디" />
        </label>
        <label class="label">
          연락 이메일(권장)
          <input v-model.trim="form.email" type="email" placeholder="연락 받을 이메일" />
        </label>
        <label class="label">
          추가 메모(선택)
          <textarea v-model="form.note" rows="4" placeholder="요청 사유/추가 식별 정보 등"></textarea>
        </label>
        <ion-button expand="block" type="submit" :disabled="submitting">
          {{ submitting ? '요청 중…' : '계정 삭제 요청 보내기' }}
        </ion-button>
        <p class="fine-print">
          제출 시 본인 확인을 위해 추가 정보 확인 절차가 있을 수 있습니다.
        </p>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton
} from '@ionic/vue'
import { reactive, ref } from 'vue'

/** 폼 상태 */
const form = reactive({
  username: '',
  email: '',
  note: ''
})
const submitting = ref(false)

/** 폼 제출 → 공개 라우터로 전송 */
const submitForm = async () => {
  try {
    if (!form.username) {
      alert('아이디는 필수입니다.')
      return
    }
    submitting.value = true
    console.log('[DeletePublic] submit', JSON.stringify(form))

    const res = await fetch('/api/public-delete-request', {
      method: 'POST',
      credentials: 'omit', // 공개페이지이므로 세션 불필요
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    const raw = await res.text()
    let data: any = null
    try { data = JSON.parse(raw) } catch { data = { message: raw } }

    if (!res.ok) {
      console.error('[DeletePublic] server error', res.status, data)
      alert(`요청 실패 (${res.status})\n${data?.error || data?.message || '잠시 후 다시 시도해 주세요.'}`)
      return
    }

    console.log('[DeletePublic] success', data)
    alert(data?.message || '삭제 요청이 접수되었습니다.')
    // 폼 초기화
    form.username = ''; form.email = ''; form.note = ''
  } catch (e) {
    console.error('[DeletePublic] network error', e)
    alert('네트워크 오류입니다. 잠시 후 다시 시도해 주세요.')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* 밝은 배경 + 검은 글씨(가독성) */
.content-light { --background: #fafafa; }

ion-title { color: #111; font-weight: 700; }

.terms-text {
  color: #111;
  font-size: clamp(14px, 3.8vw, 16px);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: keep-all;
  background: #fff;
  border: 1px solid #e9e9e9;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 20px;
}

/* 폼 */
.delete-form {
  background: #fff;
  border: 1px solid #e9e9e9;
  border-radius: 10px;
  padding: 14px;
}
.delete-form h2 {
  margin: 0 0 10px;
  font-size: 18px;
  color: #111;
}
.label {
  display: block;
  margin-bottom: 10px;
  color: #111;
}
input, textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 15px;
  color: #111;
  background: #fff;
}
.fine-print {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}
</style>
