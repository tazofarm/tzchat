<template>
  <div class="admin-card">
    <h2 class="title">베타회원 → 일반회원 마이그레이션</h2>
    <p class="desc">
      베타 종료 시점에 <b>'베타회원'</b> 등급을 <b>'일반회원'</b>으로 일괄 전환합니다.
      실행 전 <b>미리보기(Preview)</b>로 대상 건수를 확인하세요.
    </p>

    <div class="row">
      <ion-button :disabled="loading" @click="preview">
        <ion-icon :icon="icons.eyeOutline" slot="start" />
        미리보기
      </ion-button>

      <ion-item lines="none" class="dryrun-toggle">
        <ion-label>드라이런(dry-run)</ion-label>
        <ion-toggle v-model="dryRun" />
      </ion-item>

      <ion-button color="danger" :disabled="loading" @click="execute">
        <ion-icon :icon="icons.playOutline" slot="start" />
        실행
      </ion-button>
    </div>

    <div v-if="loading" class="center mt-12">
      <ion-spinner name="crescent" />
    </div>

    <div v-if="error" class="error mt-6">{{ error }}</div>

    <ion-card v-if="previewData" class="mt-6">
      <ion-card-header>
        <ion-card-title>미리보기 결과</ion-card-title>
        <ion-card-subtitle>{{ previewData.ts }}</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ul class="kv">
          <li><span>from</span><b>{{ previewData.targetLevelFrom }}</b></li>
          <li><span>to</span><b>{{ previewData.targetLevelTo }}</b></li>
          <li><span>대상 수</span><b>{{ number(previewData.total) }} 명</b></li>
          <li><span>모드</span><b>dry-run</b></li>
        </ul>
      </ion-card-content>
    </ion-card>

    <ion-card v-if="result" class="mt-6">
      <ion-card-header>
        <ion-card-title>실행 결과</ion-card-title>
        <ion-card-subtitle>{{ result.ts }}</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ul class="kv">
          <li><span>from</span><b>{{ result.targetLevelFrom }}</b></li>
          <li><span>to</span><b>{{ result.targetLevelTo }}</b></li>
          <li><span>대상 수</span><b>{{ number(result.total) }} 명</b></li>
          <li><span>적용</span><b>{{ number(result.modified ?? 0) }} 명</b></li>
          <li><span>모드</span><b>{{ result.dryRun ? 'dry-run' : '실행' }}</b></li>
          <li v-if="result.note"><span>비고</span><b>{{ result.note }}</b></li>
        </ul>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonToggle,
  IonItem,
  IonLabel,
} from '@ionic/vue'
import { ref } from 'vue'
import api from '@/lib/api'
import { eyeOutline, playOutline } from 'ionicons/icons'

const icons = { eyeOutline, playOutline }

type PreviewRes = {
  ok: boolean
  ts: string
  targetLevelFrom: string
  targetLevelTo: string
  total: number
  dryRun: true
}
type ExecRes = {
  ok: boolean
  ts: string
  targetLevelFrom: string
  targetLevelTo: string
  total: number
  matched: number
  modified: number
  dryRun: boolean
  note?: string
}

const loading = ref(false)
const error = ref('')
const dryRun = ref(true)
const previewData = ref<PreviewRes | null>(null)
const result = ref<ExecRes | null>(null)

function number(n?: number) {
  if (typeof n !== 'number') return '0'
  return n.toLocaleString('ko-KR')
}

async function preview() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const { data } = await api.get<PreviewRes>('/api/admin/migration/beta-to-basic/preview', {
      withCredentials: true,
    })
    if (!data?.ok) throw new Error('미리보기 실패')
    previewData.value = data
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || 'PREVIEW_ERROR'
  } finally {
    loading.value = false
  }
}

async function execute() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.post<ExecRes>(
      '/api/admin/migration/beta-to-basic',
      { dryRun: dryRun.value },
      { withCredentials: true }
    )
    if (!data?.ok) throw new Error('실행 실패')
    result.value = data
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || 'EXEC_ERROR'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.admin-card {
  padding: 14px;
}
.title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 6px 0;
}
.desc {
  color: var(--ion-color-medium);
  margin: 0 0 12px 0;
  line-height: 1.4;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.dryrun-toggle {
  --inner-padding-end: 0;
  --padding-start: 8px;
  --padding-end: 8px;
}
.center {
  text-align: center;
}
.error {
  color: var(--ion-color-danger);
}
.kv {
  list-style: none;
  padding: 0;
  margin: 0;
}
.kv li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed color-mix(in oklab, var(--ion-color-medium) 30%, transparent);
}
.kv li:last-child {
  border-bottom: 0;
}
.kv span {
  color: var(--ion-color-medium);
}
.mt-6 { margin-top: 1.5rem; }
.mt-12 { margin-top: 3rem; }
</style>
