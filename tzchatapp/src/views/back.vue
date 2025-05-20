<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>To-Do</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="container">
        <div class="top-bar">
          <textarea v-model="inputText" placeholder="할 일을 입력하세요" />
          <button @click="goToSettings">⚙️ 설정</button>
        </div>

        <div class="add-row">
          <button
            v-for="(col, index) in columns"
            :key="index"
            @click="addTodo(index)"
          >+추가</button>
        </div>

        <div id="columns">
          <div
            v-for="(col, colIndex) in columns"
            :key="colIndex"
            class="column"
            :data-index="colIndex"
          >
            <div
              v-for="(todo, todoIndex) in col"
              :key="todoIndex"
              class="todo-btn"
              @click="showPopup(colIndex, todoIndex, todo)"
            >
              <span :style="todoStyle">{{ todo }}</span>
            </div>
          </div>
        </div>

        <PopupModal
          v-if="popupOpen"
          :text="popupText"
          @close="popupOpen = false"
          @edit="handleEdit"
          @delete="handleDelete"
        />

        <div id="admob-placeholder">광고 영역</div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent
} from '@ionic/vue';

import { ref, onMounted, computed } from 'vue';
import Sortable from 'sortablejs';
import { useRouter } from 'vue-router';
import PopupModal from '@/components/PopupModal.vue';


const router = useRouter();

const inputText = ref('');
const popupOpen = ref(false);
const popupText = ref('');
const selectedCol = ref(null);
const selectedIndex = ref(null);
const columns = ref([]);

// -------- 로컬스토리지 유틸 --------
function getColumnCount() {
  return parseInt(localStorage.getItem('columnCount') || '1');
}

function getTodos() {
  return JSON.parse(localStorage.getItem('todoColumns') || '[]');
}

function setTodos(data) {
  localStorage.setItem('todoColumns', JSON.stringify(data));
}

function getSettings() {
  return {
    fontSize: parseInt(localStorage.getItem('fontSize') || '3'),
    textAlign: localStorage.getItem('textAlign') || 'center',
    buttonSize: parseInt(localStorage.getItem('buttonSize') || '3'),
    theme: localStorage.getItem('theme') || 'light',
  };
}

// -------- 기능 --------
function applyTheme(theme) {
  document.body.classList.remove('light-mode', 'dark-mode');
  document.body.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
}

function goToSettings() {
  router.push('/setting');
}

function showPopup(colIndex, todoIndex, text) {
  selectedCol.value = colIndex;
  selectedIndex.value = todoIndex;
  popupText.value = text;
  popupOpen.value = true;
}

function handleEdit(newText) {
  const todos = getTodos();
  todos[selectedCol.value][selectedIndex.value] = newText;
  setTodos(todos);
  popupOpen.value = false;
  render();
}

function handleDelete() {
  const todos = getTodos();
  todos[selectedCol.value].splice(selectedIndex.value, 1);
  setTodos(todos);
  popupOpen.value = false;
  render();
}

function addTodo(colIndex) {
  let value = inputText.value.trim();

  if (!value) {
    value = '(비어 있음)'; // 👈 빈 값이면 기본값으로 대체
  }

  const todos = getTodos();
  todos[colIndex].push(value);
  setTodos(todos);
  inputText.value = '';
  render();
}

function render() {
  const colCount = getColumnCount();
  const settings = getSettings();
  applyTheme(settings.theme);

  let data = getTodos();

  // 부족한 열은 추가
  while (data.length < colCount) data.push([]);

  setTodos(data);

  // ✅ 필요한 수 만큼만 보여주기 (전체는 보존)
  columns.value = data.slice(0, colCount);

  setTimeout(() => initSortable(), 0);
}

function initSortable() {
  const columnsEl = document.getElementById('columns');
  for (const col of columnsEl.children) {
    Sortable.create(col, {
      group: 'shared',
      animation: 150,
      ghostClass: 'dragging',
      fallbackOnBody: true,
      forceFallback: true,
      delay: 300,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      onAdd(evt) {
        const from = evt.from.dataset.index;
        const to = evt.to.dataset.index;
        const movedItem = evt.item.textContent;
        const todos = getTodos();
        const index = todos[from].indexOf(movedItem);
        if (index > -1) todos[from].splice(index, 1);
        todos[to].splice(evt.newIndex, 0, movedItem);
        setTodos(todos);
      },
      onUpdate() {
        const newData = [];
        for (const col of columnsEl.children) {
          const items = Array.from(col.children).map((x) => x.textContent);
          newData.push(items);
        }
        setTodos(newData);
      },
    });
  }
}

onMounted(() => {
  if (!localStorage.getItem('todoColumns')) {
    localStorage.setItem('todoColumns', JSON.stringify([['안녕하세요']]));
  }
  if (!localStorage.getItem('columnCount')) {
    localStorage.setItem('columnCount', '1');
  }
  render();
  window.addEventListener('focus', render);
});

// -------- 동적 스타일 --------
const settings = getSettings();
const fontSizeRem = 0.8 + settings.fontSize * 0.2;
const buttonHeight = settings.buttonSize * 12 + 28 + 'px';


const todoStyle = computed(() => {
  const settings = getSettings();
  const fontSizeRem = 0.8 + settings.fontSize * 0.2;
  const buttonHeight = settings.buttonSize * 12 + 28 + 'px';

  return {
    fontSize: fontSizeRem + 'rem',
    height: buttonHeight,      // ✅ 고정 높이 유지
    width: '100%',
    textAlign: settings.textAlign,
    display: 'block',
  };
});


</script>

<!-- 👇 컴포넌트 전용 스타일 -->
<style scoped>
.container {
  padding: 16px;
}
.top-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin-bottom: 10px;
}
.top-bar textarea {
  font-size: 1rem;
  padding: 0.6em;
  border-radius: 6px;
  border: 1px solid #ccc;
  resize: vertical;
  min-height: 44px;
}
.top-bar button {
  font-size: 1rem;
  padding: 0.6em 1em;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
#columns {
  display: flex;
  gap: 8px;
}
.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.todo-btn {
  display: flex;
  align-items: center;         /* ✅ 세로 중앙 정렬 */
  justify-content: center;     /* 👉 중앙 정렬 기본값 */
  padding: 0 8px;
  border: 1px solid;
  border-radius: 6px;
  cursor: grab;
  white-space: pre-wrap;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  height: [고정 높이]; /* 선택 사항: 직접 주거나 그대로 유지 */
}
.dragging {
  background-color: #888 !important;
  opacity: 0.5;
  transform: scale(0.95);
}
#admob-placeholder {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 60px;
  background-color: #000;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: 10;
}
</style>

<!-- 👇 글로벌 스타일: scoped 없이 -->
<style>
:root {
  --light-bg: #ffffff;
  --dark-bg: #121212;
  --light-text: #000000;
  --dark-text: #ffffff;
}

body.light-mode {
  background-color: var(--light-bg);
  color: var(--light-text);
}

body.dark-mode {
  background-color: var(--dark-bg);
  color: var(--dark-text);
}

/* 입력창 배경/글자색 */
body.light-mode .top-bar textarea {
  background-color: #ffffff;
  color: #000000;
}
body.dark-mode .top-bar textarea {
  background-color: #2a2a2a;
  color: #ffffff;
}

/* 공통 배경 및 텍스트 색상 */
body.light-mode .container,
body.light-mode .todo-btn,
body.light-mode .top-bar {
  background-color: #f5f5f5;
  color: black;
}

body.dark-mode .container,
body.dark-mode .todo-btn,
body.dark-mode .top-bar {
  background-color: #1e1e1e;
  color: white;
}

/* +추가 버튼 공통 스타일 */
/* +추가 버튼 공통 */
.add-row button {
  flex: 1;
  font-size: 1rem;
  height: 48px;
  line-height: 48px;
  text-align: center;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent; /* 배경 색은 모드별 지정 */
}

/* 라이트 모드 - 밝은 회색 */
body.light-mode .add-row button {
  background-color: #e0e0e0; /* 밝은 회색 */
  color: #000000;
  border: 2px solid #999999; /* 중간 회색 윤곽선 */
}

/* 다크 모드 - 어두운 회색 */
body.dark-mode .add-row button {
  background-color: #333333; /* 어두운 회색 */
  color: #ffffff;
  border: 2px solid #888888; /* 밝은 회색 윤곽선 */
}
</style>