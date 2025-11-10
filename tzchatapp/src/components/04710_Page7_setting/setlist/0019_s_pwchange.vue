<!-- src/views/PasswordChangePage.vue -->
<template>
  <ion-page class="password-page theme-gold-dark">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"></ion-buttons>
        <ion-title>비밀번호 변경</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="goBack" aria-label="닫기(우측)">닫기</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- 아이디 표시 카드 -->
      <div class="id-card">
        <div class="id-row">
          <span class="id-label">아이디</span>
          <span class="id-value">{{ displayUsername || '확인 중…' }}</span>
        </div>
        <p class="id-hint" v-if="passTxId">
          PASS 인증 결과를 바탕으로 비밀번호를 재설정합니다.
        </p>
        <p class="id-hint" v-else>
          로그인 상태에서 비밀번호를 변경합니다.
        </p>
      </div>

      <ion-list inset>
        <!-- 새 비밀번호 -->
        <ion-item>
          <ion-label position="stacked">새 비밀번호</ion-label>
          <ion-input
            type="password"
            placeholder="새 비밀번호"
            v-model="form.next"
            @ionInput="logInput('next', $event)"
            autocomplete="new-password"
          />
        </ion-item>

        <!-- 새 비밀번호 확인 -->
        <ion-item>
          <ion-label position="stacked">새 비밀번호 확인</ion-label>
          <ion-input
            type="password"
            placeholder="새 비밀번호 확인"
            v-model="form.confirm"
            @ionInput="logInput('confirm', $event)"
            autocomplete="new-password"
          />
        </ion-item>
      </ion-list>

      <!-- 액션 버튼 -->
      <div class="btn-row">
        <ion-button expand="block" @click="onSubmit" :disabled="isSubmitting">
          {{ isSubmitting ? '변경 중...' : (passTxId ? '재설정' : '변경') }}
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
// -------------------------------------------------------
// PasswordChangePage.vue (비밀번호 "재설정/변경" 통합 페이지)
// - 비로그인(분실) + PASS 기반: POST /api/password/reset-with-pass
// - 로그인 상태: PUT /api/update-password-no-current
// - 상단에 아이디 노출 (query.username || PASS lookup || /api/me)
// -------------------------------------------------------
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonList, IonItem, IonLabel, IonInput
} from '@ionic/vue'
import { reactive, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const form = reactive({ next: '', confirm: '' })
const isSubmitting = ref(false)
const displayUsername = ref<string>('')

const passTxId = String(route.query.passTxId || '') || ''
const queryUsername = String(route.query.username || '') || ''

function goBack () {
  try { router.back() } catch { router.push('/login') }
}

function logInput (key: string, ev: any) {
  const masked = '•'.repeat(String(ev?.target?.value ?? '').length)
  console.debug(`[PasswordPage] input ${key}: ${masked}`)
}

function validate () {
  if (!form.next || !form.confirm) {
    alert('새 비밀번호와 확인을 입력해 주세요.')
    return false
  }
  if (form.next.length < 4) {
    alert('새 비밀번호는 4자 이상을 권장합니다.')
    return false
  }
  if (form.next !== form.confirm) {
    alert('새 비밀번호가 일치하지 않습니다.')
    return false
  }
  return true
}

async function lookupUsernameByPass () {
  if (!passTxId) return
  try {
    const res = await fetch('/api/password/reset-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ passTxId })
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.ok && json?.username) {
      displayUsername.value = json.username
    }
  } catch {}
}

async function fallbackUsernameFromMe () {
  try {
    const res = await fetch('/api/me', { credentials: 'include' })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.ok && json?.user?.username && !displayUsername.value) {
      displayUsername.value = json.user.username
    }
  } catch {}
}

onMounted(async () => {
  if (queryUsername) {
    displayUsername.value = queryUsername
  }
  if (passTxId && !displayUsername.value) {
    await lookupUsernameByPass()
  }
  if (!displayUsername.value) {
    await fallbackUsernameFromMe()
  }
})

async function resetWithPass () {
  console.info('[PasswordPage] send → POST /api/password/reset-with-pass')
  const res = await fetch('/api/password/reset-with-pass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ passTxId, next: form.next })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message || `서버 오류(${res.status})`)
  }
  return true
}

async function updateNoCurrent () {
  console.info('[PasswordPage] send → PUT /api/update-password-no-current')
  const res = await fetch('/api/update-password-no-current', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ next: form.next })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message || `서버 오류(${res.status})`)
  }
  return true
}

async function onSubmit () {
  if (!validate() || isSubmitting.value) return
  isSubmitting.value = true
  try {
    if (passTxId) {
      await resetWithPass()
    } else {
      await updateNoCurrent()
    }
    form.next = form.confirm = ''
    alert('비밀번호가 변경되었습니다.')
    goBack()
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED')) {
      alert('서버에 연결할 수 없습니다. (백엔드 실행 상태 확인)')
    } else {
      alert(msg || '비밀번호 변경에 실패했습니다.')
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.theme-gold-dark {
  --gold: #d4af37;
  --gold-weak: #c7a133;
  --gold-press: #e0bb3f;
  --bg-0: #0b0b0f;
  --bg-1: #111217;
  --bg-2: #1a1b22;
  --line: #2a2c36;
  --text-strong: #ffffff;
  --text: #e7e7e7;
  --text-weak: #b5b5b5;
  --focus: var(--gold);
}

.password-page { color: var(--text-strong); }

.password-page :deep(ion-header),
.password-page :deep(ion-toolbar) {
  --background: var(--bg-0);
  --color: var(--text-strong);
  border-bottom: 1px solid var(--line);
}
.password-page :deep(ion-title) {
  color: var(--gold);
  font-weight: 800;
  letter-spacing: 0.2px;
}
.password-page :deep(ion-buttons ion-button) {
  --background: transparent;
  --color: var(--gold);
  --ripple-color: var(--gold-weak);
  font-weight: 700;
}

.password-page :deep(ion-content) { --background: var(--bg-0); color: var(--text); }

/* 아이디 카드 */
.id-card {
  margin: 12px;
  background: var(--bg-1);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.45);
}
.id-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.id-label {
  color: var(--gold);
  font-weight: 800;
  font-size: 14px;
}
.id-value {
  font-weight: 800;
  color: var(--text-strong);
  font-size: 15px;
}
.id-hint {
  margin-top: 6px;
  color: var(--text-weak);
  font-size: 12px;
}

.password-page :deep(ion-list[inset]) {
  margin: 12px;
  padding: 0;
  background: var(--bg-1);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0,0,0,0.45);
}

.password-page :deep(ion-item) {
  --background: var(--bg-1);
  --color: var(--text);
  --padding-start: 12px;
  --inner-padding-end: 12px;
  --min-height: 62px;
  --inner-border-width: 0 0 1px 0;
  --inner-border-color: var(--line);
  --highlight-color-focused: transparent;
  --highlight-color-valid: transparent;
  --highlight-color-invalid: transparent;
  --show-full-highlight: 0;
}
.password-page :deep(ion-item:last-of-type) { --inner-border-width: 0; }

.password-page :deep(ion-item ion-label) {
  color: var(--gold);
  font-weight: 800;
  font-size: clamp(14px, 2.6vw, 15px);
  margin-bottom: 8px;
  letter-spacing: 0.2px;
}

.password-page :deep(ion-input::part(native)) {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 12px;
  font-size: 16px;
  color: var(--text-strong);
  line-height: 1.35;
  min-height: 46px;
  outline: none !important;
  box-shadow: none !important;
}
.password-page :deep(ion-input::part(native)::placeholder) { color: var(--text-weak); }

.password-page :deep(ion-input:focus-within)::part(native),
.password-page :deep(ion-input:focus)::part(native),
.password-page :deep(ion-input:focus-visible)::part(native) {
  border-color: var(--focus);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 26%, transparent);
}

.password-page :deep(ion-item:focus),
.password-page :deep(ion-item:focus-within),
.password-page :deep(ion-item:focus-visible),
.password-page :deep(ion-input input),
.password-page :deep(ion-input input:focus),
.password-page :deep(ion-input input:focus-within),
.password-page :deep(ion-input input:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

.btn-row { padding: 16px 12px 18px; }

.password-page :deep(ion-button) {
  --background: var(--gold);
  --color: #000;
  --background-activated: var(--gold-press);
  --background-hover: var(--gold-press);
  --border-radius: 12px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  font-weight: 900;
  letter-spacing: 0.3px;
  box-shadow: 0 8px 20px rgba(212,175,55,0.22);
}
.password-page :deep(ion-button[disabled]) { opacity: 0.6; box-shadow: none; }

@media (max-width: 360px) {
  .password-page :deep(ion-list[inset]) { margin: 10px; }
  .btn-row { padding: 12px 10px 14px; }
  .password-page :deep(ion-item) { --padding-start: 10px; --inner-padding-end: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
</style>
