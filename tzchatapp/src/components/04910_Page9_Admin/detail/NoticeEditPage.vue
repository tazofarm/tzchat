<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ isEdit ? '공지 수정' : '공지 작성' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <section class="notice-form">
        <!-- 제목 -->
        <ion-item lines="none" class="field">
          <ion-label position="stacked">제목</ion-label>
          <ion-input
            v-model="form.title"
            placeholder="제목을 입력하세요"
            class="rounded-input"
          />
        </ion-item>

        <!-- 본문 -->
        <ion-item lines="none" class="field">
          <ion-label position="stacked">본문</ion-label>
          <!-- auto-grow로 입력 중 자연스러운 확장 -->
          <ion-textarea
            v-model="form.content"
            :rows="10"
            auto-grow
            placeholder="본문(텍스트 또는 HTML)"
            class="rounded-textarea"
          />
        </ion-item>

        <!-- 공개 토글 -->
        <ion-item lines="full" class="row-between">
          <ion-label>공개</ion-label>
          <ion-toggle v-model="form.isPublished" />
        </ion-item>

        <!-- 게시일 -->
        <ion-item lines="none" class="field">
          <ion-label position="stacked">게시일(선택)</ion-label>
          <div class="datetime-row">
            <ion-datetime-button datetime="notice-dt" />
            <ion-button fill="clear" size="small" @click="clearDate" v-if="form.publishedAt">
              지우기
            </ion-button>
          </div>
        </ion-item>
      </section>

      <!-- Datetime Modal (Ion 규격상 동일 페이지 안에 존재하면 됨) -->
      <ion-modal keep-contents-mounted>
        <ion-datetime
          id="notice-dt"
          v-model="form.publishedAt"
          presentation="date-time"
          minute-values="0,10,20,30,40,50"
        />
      </ion-modal>

      <!-- 액션 버튼 -->
      <div class="btns">
        <ion-button expand="block" class="primary" @click="save" :disabled="saving || !form.title.trim()">
          {{ isEdit ? '수정' : '등록' }}
        </ion-button>
        <ion-button expand="block" fill="outline" @click="goList">목록</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonTextarea,
  IonButton, IonToggle, IonDatetime, IonDatetimeButton, IonModal
} from '@ionic/vue'
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/lib/api'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!id.value)

const saving = ref(false)
const form = ref({
  title: '',
  content: '',
  isPublished: true,
  publishedAt: '' // ISO string
})

async function load() {
  if (!isEdit.value) return
  const r = await api.get(`/api/notices/${id.value}`, { withCredentials: true })
  const n = r.data?.notice
  form.value.title = n?.title || ''
  form.value.content = n?.content || ''
  form.value.isPublished = n?.isPublished ?? true
  form.value.publishedAt = n?.publishedAt || ''
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const payload: any = {
      title: form.value.title,
      content: form.value.content,
      isPublished: form.value.isPublished,
    }
    if (form.value.publishedAt) payload.publishedAt = form.value.publishedAt

    if (isEdit.value) {
      await api.put(`/api/notices/${id.value}`, payload, { withCredentials: true })
    } else {
      await api.post('/api/notices', payload, { withCredentials: true })
    }
    router.push('/home/setting/0002')
  } finally {
    saving.value = false
  }
}

function clearDate() {
  form.value.publishedAt = ''
}

function goList() { router.push('/home/setting/0002') }

onMounted(load)
</script>

<style scoped>
/* ===== 레이아웃 기본 ===== */
.notice-form {
  background: var(--ion-background-color, #111);
  padding: 12px;
  border-radius: 14px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset;
}

/* 여백 규칙 */
.field { margin-bottom: 14px; }
.btns  { margin-top: 18px; display: grid; gap: 10px; }

/* 한 줄 정렬(레이블-컨트롤 좌우 배치) */
.row-between {
  --background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ===== 입력 공통 스킨 ===== */
.rounded-input,
.rounded-textarea {
  --background: #121212;
  --color: #eaeaea;
  --placeholder-color: #8a8a8a;
  --padding-start: 14px;
  --padding-end: 14px;
  --border-radius: 12px;
  --highlight-color-focused: var(--ion-color-primary);
  border: 1px solid #2c2c2c;
  margin-top: 6px; /* stacked 라벨과 간격 */
}

/* ion-input/textarea 내부 실제 요소에 적용 */
.rounded-input::part(native),
.rounded-textarea::part(native) {
  background: var(--background);
  color: var(--color);
  border-radius: var(--border-radius);
  padding: 12px 14px;
}

/* textarea는 높이/줄간격 보정 */
.rounded-textarea::part(native) {
  line-height: 1.45;
  min-height: 160px;
}

/* placeholder 톤 */
.rounded-input::part(placeholder),
.rounded-textarea::part(placeholder) {
  color: var(--placeholder-color);
}

/* stacked 라벨 색상/간격 */
ion-item.field ion-label {
  color: var(--ion-color-medium);
  margin-bottom: 6px;
}

/* Datetime 줄 레이아웃 */
.datetime-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

/* 아이템 배경/라인 최소화 */
ion-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 44px;
}

/* 토글 클릭 영역 확대 */
ion-item.row-between ion-toggle {
  margin-right: -6px;
}

/* 버튼 톤 */
ion-button.primary {
  --border-radius: 10px;
}

/* 작은 화면에서도 가로 스크롤/튀어나옴 방지 */
:host, ion-content {
  overflow-x: hidden;
}
</style>
