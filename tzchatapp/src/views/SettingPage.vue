<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>⚙️ 설정</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="container">
        <!-- 테마 설정 -->
        <div class="setting-section">
          <label>배경 설정</label>
          <div class="radio-group">
            <label><input type="radio" value="light" v-model="theme" /> 라이트모드</label>
            <label><input type="radio" value="dark" v-model="theme" /> 다크모드</label>
          </div>
        </div>

        <!-- 배열 수 -->
        <div class="setting-section">
          <label>배열 수</label>
          <div class="radio-group">
            <label><input type="radio" value="1" v-model="columnCount" /> 1열</label>
            <label><input type="radio" value="2" v-model="columnCount" /> 2열</label>
            <label><input type="radio" value="3" v-model="columnCount" /> 3열</label>
          </div>
        </div>

        <!-- 글자 크기 -->
        <div class="setting-section">
          <label>글자 크기</label>
          <div class="radio-group">
            <label><input type="radio" value="1" v-model="fontSize" /> 1</label>
            <label><input type="radio" value="2" v-model="fontSize" /> 2</label>
            <label><input type="radio" value="3" v-model="fontSize" /> 3</label>
            <label><input type="radio" value="4" v-model="fontSize" /> 4</label>
            <label><input type="radio" value="5" v-model="fontSize" /> 5</label>
          </div>
        </div>

        <!-- 버튼 크기 -->
        <div class="setting-section">
          <label>버튼 크기</label>
          <div class="radio-group">
            <label><input type="radio" value="1" v-model="buttonSize" /> 1</label>
            <label><input type="radio" value="2" v-model="buttonSize" /> 2</label>
            <label><input type="radio" value="3" v-model="buttonSize" /> 3</label>
            <label><input type="radio" value="4" v-model="buttonSize" /> 4</label>
            <label><input type="radio" value="5" v-model="buttonSize" /> 5</label>
          </div>
        </div>

        <!-- 글자 정렬 -->
        <div class="setting-section">
          <label>글자 정렬</label>
          <div class="radio-group">
            <label><input type="radio" value="left" v-model="textAlign" /> 왼쪽</label>
            <label><input type="radio" value="center" v-model="textAlign" /> 가운데</label>
            <label><input type="radio" value="right" v-model="textAlign" /> 오른쪽</label>
          </div>
        </div>

        <div style="margin-top: 20px;">
          <ion-button expand="block" @click="saveSettings">적용</ion-button>
          
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
} from '@ionic/vue';

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const theme = ref('light');
const columnCount = ref('3');
const fontSize = ref('2');
const textAlign = ref('center');
const buttonSize = ref('3');

function initSetting(key: string, defaultValue: string) {
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, defaultValue);
  }
  return localStorage.getItem(key) as string;
}

onMounted(() => {
  theme.value = initSetting('theme', 'light');
  columnCount.value = initSetting('columnCount', '3');
  fontSize.value = initSetting('fontSize', '2');
  textAlign.value = initSetting('textAlign', 'center');
  buttonSize.value = initSetting('buttonSize', '3');
});


function saveSettings() {
  localStorage.setItem('theme', theme.value);
  localStorage.setItem('columnCount', columnCount.value);
  localStorage.setItem('fontSize', fontSize.value);
  localStorage.setItem('textAlign', textAlign.value);
  localStorage.setItem('buttonSize', buttonSize.value);

  window.location.href = '/home';  // 이 방식은 완전한 페이지 재로드를 유도
}

</script>

<style scoped>
.container {
  padding: 16px;
}
.radio-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 5px;
}
.radio-group label {
  white-space: nowrap;
}
.setting-section {
  background-color: #e0e0e0;
  padding: 12px;
  border-radius: 8px;
  margin-top: 15px;
}
.setting-section label:first-child {
  font-weight: bold;
  display: block;
  margin-bottom: 4px;
}
</style>