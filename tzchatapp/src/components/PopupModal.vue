<template>
  <div id="popupOverlay" @click.self="onClose">
    <div id="popup">
      <template v-if="mode === 'view'">
        <div style="margin-bottom: 1em; white-space: pre-wrap;">{{ text }}</div>
        <button @click="mode = 'edit'">✏️ 수정</button>
        <button @click="onDelete">🗑 삭제</button>
        <button @click="onClose">❌ 취소</button>
      </template>
      <template v-else>
        <textarea v-model="editedText" rows="3" />
        <button @click="onConfirmEdit">확인</button>
        <button @click="onClose">취소</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  text: String,
  show: Boolean,
});

const emits = defineEmits(['close', 'edit', 'delete']);

const mode = ref('view');
const editedText = ref(props.text);

watch(() => props.text, (newVal) => {
  editedText.value = newVal;
  mode.value = 'view';
});

const onClose = () => emits('close');
const onDelete = () => emits('delete');
const onConfirmEdit = () => emits('edit', editedText.value.trim());
</script>

<style scoped>
#popupOverlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
#popup {
  background: white;
  padding: 16px;
  border-radius: 10px;
  min-width: 240px;
}
textarea {
  width: 100%;
  margin-bottom: 10px;
}
#popup button {
  display: block;
  width: 100%;
  margin: 6px 0;
  padding: 10px;
  border-radius: 6px;
  border: none;
}
</style>