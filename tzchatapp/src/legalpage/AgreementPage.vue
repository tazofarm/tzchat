<!-- src/legalpage/AgreementPage.vue -->
<template>
  <ion-page>
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home/6page" text="뒤로가기" />
        </ion-buttons>
        <ion-title>동의</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content fullscreen>
      <section class="container">
        <h2 class="title">서비스 이용을 위해 </h2>
        <h2 class="title">아래 항목에 동의해 주세요</h2>

        <div v-if="state.loading" class="muted">불러오는 중…</div>

        <form v-else @submit.prevent="submit">
          <!-- 모두 동의 카드 -->
          <div class="card card-all" @click="allCheckedModel = !allCheckedModel">
            <label class="row" @click.stop>
              <input class="chk" type="checkbox" v-model="allCheckedModel" aria-label="모두 동의하기" />
              <span class="row-text">모두 동의하기</span>
            </label>
          </div>

          <!-- 리스트 카드 -->
          <ul class="card list" role="list">
            <li v-for="item in state.pending" :key="item.slug" class="item" role="listitem">
              <label class="row">
                <input
                  class="chk"
                  type="checkbox"
                  v-model="selected"
                  :value="item.slug"
                  :aria-label="labelOf(item.slug, item.title)"
                />
                <span class="row-text">
                  <strong class="req">{{ item.isRequired ? '필수' : '선택' }}</strong>
                  {{ labelOf(item.slug, item.title) }}
                </span>
              </label>
              <button type="button" class="view" @click="openDoc(item.slug)">내용보기</button>
            </li>
          </ul>

          <ion-button type="submit" expand="block" :disabled="submitting || !canSubmit">
            {{ submitting ? '처리 중…' : '동의하고 계속' }}
          </ion-button>
        </form>
      </section>

      <!-- 오류 알럿 -->
      <ion-alert
        :is-open="alert.open"
        :header="alert.header"
        :message="alert.message"
        :buttons="alert.buttons"
        @didDismiss="alert.open = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, reactive, computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getAgreementStatus, acceptAgreements } from '@/lib/api'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton,
  IonButtons, IonBackButton, IonAlert
} from '@ionic/vue'

const router = useRouter()
const route = useRoute()
const returnTo = computed(() => String(route.query.return || '/home/6page'))

type PendingItem = { slug: string; title?: string; isRequired?: boolean }

const state = reactive({ loading: true, pending: [] as PendingItem[] })
const selected = ref<string[]>([])
const submitting = ref(false)

/** 알럿 상태 */
const alert = reactive<{
  open: boolean; header: string; message: string; buttons: any[]
}>({
  open: false,
  header: '',
  message: '',
  buttons: []
})

const allChecked = computed(() =>
  state.pending.length > 0 && selected.value.length === state.pending.length
)
const allCheckedModel = computed({
  get: () => allChecked.value,
  set: (val: boolean) => { selected.value = val ? state.pending.map(p => p.slug) : [] }
})

const canSubmit = computed(() =>
  state.pending.every(p => !p.isRequired || selected.value.includes(p.slug))
)

function labelOf(slug: string, title?: string) {
  if (title) return title
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, s => s.toUpperCase())
}

/** 공통 오류 표시(팝업) */
function showError(message: string, opts: { phase: 'load' | 'submit' }){
  alert.header = opts.phase === 'load' ? '동의 정보 불러오기 실패' : '동의 처리 실패'
  alert.message = message
  alert.buttons = opts.phase === 'load'
    ? [
        { text: '돌아가기', role: 'cancel', handler: () => router.replace(returnTo.value) },
        { text: '재시도', role: 'confirm', handler: () => load() }
      ]
    : [
        { text: '닫기', role: 'cancel' }
      ]
  alert.open = true
}

function normalizeAxiosError(e: any, fallback: string){
  const status = e?.response?.status
  if (status === 404) return '동의 항목을 찾을 수 없습니다. 잠시 후 다시 시도하세요.'
  if (status === 401 || status === 403) return '접근 권한이 없습니다. 다시 로그인 해주세요.'
  return e?.response?.data?.message || e?.message || fallback
}

async function load() {
  state.loading = true
  try {
    // ✅ any로 받아와서 형태를 정규화 (Axios 원본/가공 모두 대응)
    const raw: any = await getAgreementStatus()
    // 우선순위: axios.data.data.pending → axios.data.pending → top-level.pending
    const pending: PendingItem[] =
      (raw?.data?.data?.pending) ??
      (raw?.data?.pending) ??
      (raw?.pending) ??
      []

    state.pending = Array.isArray(pending) ? pending : []

    if (state.pending.length === 0) {
      router.replace(returnTo.value)
      return
    }
    selected.value = state.pending.filter(p => p.isRequired).map(p => p.slug)
  } catch (e: any) {
    showError(normalizeAxiosError(e, '동의 상태를 가져오지 못했습니다.'), { phase: 'load' })
  } finally {
    state.loading = false
  }
}

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    await acceptAgreements(selected.value)
    router.replace(returnTo.value)
  } catch (e: any) {
    showError(normalizeAxiosError(e, '동의 처리 중 오류가 발생했습니다.'), { phase: 'submit' })
  } finally {
    submitting.value = false
  }
}

function openDoc(slug: string) {
  // 공개 라우트 이름 사용
  router.push({ name: 'LegalPageV2Public', params: { slug }, query: { return: returnTo.value } })
}

onMounted(load)
</script>

<style scoped>
:root {
  --surface: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.12);
  --text-muted: rgba(255,255,255,0.6);
  --focus: 0 0 0 3px rgba(255, 214, 10, .35);
}

.container { padding: 16px; }
.title { margin: 6px 0 14px; line-height: 1.35; }
.muted { color: var(--text-muted); }

/* 카드 */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px; }
.card + .card { margin-top: 12px; }
.card-all { padding: 14px; }

/* 리스트 */
.list { list-style: none; padding: 0; margin: 0; }
.item { display: flex; align-items: center; gap: 10px; padding: 10px 6px 10px 4px; border-top: 1px solid var(--border); }
.item:first-child { border-top: 0; }

.row { display: inline-flex; align-items: center; gap: 12px; flex: 1 1 auto; min-width: 0; }

/* 네이티브 체크박스 */
.chk {
  appearance: auto; -webkit-appearance: auto;
  accent-color: #ffd60a;
  width: 18px; height: 18px;
  transform: scale(1.4); transform-origin: left center;
  border-radius: 0;
  cursor: pointer;
  pointer-events: auto !important;
}
.chk:focus-visible { box-shadow: var(--focus); }

/* 텍스트 */
.row-text { font-size: 16px; line-height: 1.3; font-weight: 700; word-break: keep-all; }
.req { margin-right: 6px; font-weight: 800; font-size: 14px; opacity: .9; }

/* 내용보기 버튼 */
.view { border: 1px solid var(--border); background: transparent; padding: 6px 10px; border-radius: 10px; font-size: 12px; flex: 0 0 auto; }
.view:active { transform: translateY(1px); }
</style>
