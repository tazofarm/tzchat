// src/composables/useSettings.js
import { ref, onMounted } from 'vue';

export function useSettings() {
  const theme = ref('light');
  const columnCount = ref('3');
  const fontSize = ref('2');
  const textAlign = ref('center');
  const buttonSize = ref('3');

  onMounted(() => {
    theme.value = localStorage.getItem('theme') || 'light';
    columnCount.value = localStorage.getItem('columnCount') || '3';
    fontSize.value = localStorage.getItem('fontSize') || '2';
    textAlign.value = localStorage.getItem('textAlign') || 'center';
    buttonSize.value = localStorage.getItem('buttonSize') || '3';
  });

  function saveSettings() {
    localStorage.setItem('theme', theme.value);
    localStorage.setItem('columnCount', columnCount.value);
    localStorage.setItem('fontSize', fontSize.value);
    localStorage.setItem('textAlign', textAlign.value);
    localStorage.setItem('buttonSize', buttonSize.value);
  }

  return {
    theme, columnCount, fontSize, textAlign, buttonSize, saveSettings,
  };
}