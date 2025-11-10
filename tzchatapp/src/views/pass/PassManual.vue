<template>
  <ion-page class="pass-manual">
    <ion-header>
      <ion-toolbar>
        <ion-title>PASS 수동 입력(로컬 시뮬레이터)</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <form class="form" @submit.prevent="onSubmit" novalidate>
        <div class="group">
          <label>이름</label>
          <ion-input v-model="form.NAME" placeholder="예: 홍길동" required />
        </div>

        <div class="group">
          <label>생년월일 (YYYYMMDD)</label>
          <ion-input
            v-model="form.BIRTHDATE"
            inputmode="numeric"
            maxlength="8"
            placeholder="예: 19920315"
            required
          />
          <p class="hint" :class="{ error: !validBirthdate && form.BIRTHDATE }">
            8자리 숫자(YYYYMMDD)로 입력해주세요.
          </p>
        </div>

        <div class="group">
          <label>성별 코드</label>
          <div class="radio-group">
            <label class="radio">
              <input type="radio" value="M" v-model="form.GENDER" />
              <span>남(M)</span>
            </label>
            <label class="radio">
              <input type="radio" value="F" v-model="form.GENDER" />
              <span>여(F)</span>
            </label>
          </div>
          <p class="hint">PASS 공급사 반환 기준: <b>M</b> 또는 <b>F</b></p>
        </div>

        <div class="group">
          <label>휴대폰 번호</label>
          <ion-input
            v-model="form.PHONE"
            inputmode="numeric"
            placeholder="예: 01012345678"
            required
          />
          <p class="hint">
            공급사 콜백과 동일하게 <b>국내 형식(010…)</b>으로 입력합니다.
            (서버에서 E.164 <code>+8210…</code> 으로 정규화)
          </p>
        </div>

        <div class="group">
          <label>통신사</label>
          <ion-select v-model="form.CARRIER" interface="popover" placeholder="선택">
            <ion-select-option value="SKT">SKT</ion-select-option>
            <ion-select-option value="KT">KT</ion-select-option>
            <ion-select-option value="LGU+">LGU+</ion-select-option>
          </ion-select>
        </div>

        <div class="group">
          <label>CI (원문)</label>
          <ion-input v-model="form.CI" placeholder="예: 테스트용 CI 문자열" required />
          <p class="hint">서버에서 SHA-256 해시(ciHash)로만 저장됩니다.</p>
        </div>

        <div class="group">
          <label>DI (원문, 선택)</label>
          <ion-input v-model="form.DI" placeholder="예: 테스트용 DI 문자열(선택)" />
          <p class="hint">서버에서 SHA-256 해시(diHash)로만 저장됩니다.</p>
        </div>

        <ion-button type="submit" expand="block" :disabled="busy || !formValid">
          <ion-spinner v-if="busy" name="dots" class="mr-2" />
          <span>확인</span>
        </ion-button>

        <ion-button expand="block" fill="clear" :disabled="busy" @click="onCancel">
          실패로 신호보내기
        </ion-button>

        <div v-if="error" class="error">
          {{ error }}
        </div>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonInput, IonSpinner, IonSelect, IonSelectOption
} from '@ionic/vue';
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/lib/api';

const router = useRouter();
const busy = ref(false);
const error = ref('');

// PASS 콜백과 동일한 키 대문자
const form = reactive({
  NAME: '',
  BIRTHDATE: '',
  GENDER: 'M',
  PHONE: '',
  CARRIER: '',
  CI: '',
  DI: '',
});

const validBirthdate = computed(() => /^\d{8}$/.test(form.BIRTHDATE));
const formValid = computed(() =>
  !!form.NAME &&
  validBirthdate.value &&
  (form.GENDER === 'M' || form.GENDER === 'F') &&
  !!form.PHONE &&
  !!form.CI
);

function toProviderLikePayload() {
  return {
    name: form.NAME,
    birthdate: form.BIRTHDATE,
    genderCode: form.GENDER,  // 'M' | 'F'
    phone: form.PHONE,        // 010… → 서버에서 +82 정규화
    carrier: form.CARRIER,
    ci: form.CI,
    di: form.DI || '',
  };
}

// --- 안정적인 창 닫기 & 신호 전달 유틸 ---
function safeClosePopup(fallbackUrl) {
  // iOS/Safari 등 일부 환경에서 close 차단될 수 있어 다양한 시도
  try { window.opener && window.opener.focus && window.opener.focus(); } catch {}
  // self-target 윈도우로 변경 후 닫기 시도
  try { window.open('', '_self'); } catch {}
  // 즉시 닫기 + 지연 닫기 두 번 시도
  try { window.close(); } catch {}
  setTimeout(() => { try { window.close(); } catch {} }, 60);
  // 최후 폴백: 오프너가 없으면 수동으로 포털로 리다이렉트
  if (!window.opener || window.opener.closed) {
    if (fallbackUrl) location.replace(fallbackUrl);
  }
}

function postSuccessToOpener({ txId, payload }) {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: 'PASS_RESULT', txId: String(txId), payload },
        '*'
      );
    }
  } catch {}
  // storage 이벤트 폴백 (동일 오리진일 때 오프너에서 감지)
  try { localStorage.setItem('PASS_RESULT_TX', String(txId)); } catch {}
}

function postFailToOpener(reason = 'USER_CANCEL') {
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: 'PASS_FAIL', reason },
        '*'
      );
    }
  } catch {}
  try { localStorage.setItem('PASS_FAIL', String(reason)); } catch {}
}

async function onSubmit() {
  error.value = '';
  if (busy.value || !formValid.value) return;

  busy.value = true;
  try {
    const payload = toProviderLikePayload();
    const { data } = await api.post('/api/auth/passmanual/manual', payload, { withCredentials: false });
    if (!data?.ok || !data?.txId) throw new Error('수동 입력 실패');

    // 1) 성공 신호 송출
    postSuccessToOpener({ txId: data.txId, payload });

    // 2) 닫기(다중 시도) — 오프너 없으면 포털로 직접 이동
    const fallbackUrl = `${location.origin}/pass?txId=${encodeURIComponent(data.txId)}`;
    // 약간의 딜레이 후 닫기: 오프너가 메시지 받을 시간 제공
    setTimeout(() => safeClosePopup(fallbackUrl), 30);
  } catch (e) {
    console.error(e);
    error.value = e?.response?.data?.message || e?.message || '수동 입력 처리 중 오류가 발생했습니다.';
  } finally {
    busy.value = false;
  }
}

async function onCancel() {
  try { await api.post('/api/auth/passmanual/fail', { reason: 'USER_CANCEL' }); } catch {}

  postFailToOpener('USER_CANCEL');

  const fallbackUrl = `${location.origin}/pass?fail=USER_CANCEL`;
  setTimeout(() => safeClosePopup(fallbackUrl), 10);
}
</script>

<style scoped>
.form {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}
.group { margin-bottom: 14px; }
label { display: block; margin-bottom: 6px; opacity: 0.9; }
.mr-2 { margin-right: 8px; }
.error { margin-top: 12px; color: var(--ion-color-danger); }
.hint { font-size: 0.9rem; opacity: 0.85; margin-top: 6px; }
.hint.error { color: var(--ion-color-danger); }
.radio-group { display: flex; gap: 14px; align-items: center; padding-top: 2px; flex-wrap: wrap; }
.radio { display: inline-flex; align-items: center; gap: 6px; }
.radio input[type='radio'] { width: 18px; height: 14px; accent-color: var(--ion-color-primary); }
</style>
