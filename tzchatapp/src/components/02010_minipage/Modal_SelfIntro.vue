<template>
  <teleport to="body">
    <!-- 배경 클릭 시에만 닫힘 -->
    <div class="overlay" @click.self="emit('close')">
      <div class="panel" role="dialog" aria-modal="true" aria-label="소개 모달">
        <header class="header">
          <h3>소개</h3>
          <button class="close" @click="emit('close')" aria-label="닫기">✕</button>
        </header>

        <section class="body">
          <!-- 긴 텍스트 보존: pre-wrap -->
          <pre class="content">{{ content || '없음' }}</pre>
        </section>

        <footer class="footer">
          <button class="btn" @click="emit('close')">닫기</button>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<script setup>
/* ===========================================================
   구조/로직 최대 유지 + 로그/주석 강화
   =========================================================== */
const props = defineProps({ content: { type: String, default: '' } })
const emit = defineEmits(['close'])
console.log('[ModalSelfIntro] mounted, content length =', props.content?.length ?? 0)
</script>

<style scoped>
/* ===========================================================
   GOLD THEME TOKENS
   (테마 변수 미정의 시를 대비해 fallback 지정)
   =========================================================== */
:host, .overlay, .panel { color: var(--text, #111); }

/* 전체 오버레이(백드롭) */
.overlay{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647; /* ✅ 최상단 유지 */
  /* 혹시 상위 요소가 pointer-events:none 인 경우 대비 */
  pointer-events: auto;
}

/* 모달 패널 */
.panel{
  width: min(92vw, 520px);
  background: var(--panel, rgba(18,18,18,.98));      /* ★ Fallback */
  color: var(--text, #f5f5f5);                        /* ★ Fallback */
  border: 1px solid var(--panel-border, rgba(255,213,79,.18)); /* ★ Fallback */
  border-radius: 14px;
  overflow: hidden;
  box-shadow:
    0 12px 28px rgba(0,0,0,.35),
    0 0 0 1px rgba(255,213,79,.06) inset;
  z-index: 2147483647; /* ★★ 핵심: 패널에도 고정 z-index 부여 */
}

/* 헤더 */
.header{
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--panel-border, rgba(255,213,79,.18));
}
.header h3{
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text, #f5f5f5);
}
.close{
  border: 0;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-dim, #c8c8c8);
  line-height: 1;
  border-radius: 10px;
  padding: 2px 6px;
}
.close:hover{ color: var(--text, #f5f5f5); }

/* 본문 */
.body{ padding: 14px; }
.content{
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text, #f5f5f5);
}

/* 푸터 */
.footer{
  padding: 12px 14px;
  border-top: 1px solid var(--panel-border, rgba(255,213,79,.18));
  display: flex;
  justify-content: flex-end;
}
.btn{
  padding: 8px 14px;
  border-radius: 10px;
  border: 0;
  background: var(--gold, #ffd54f);
  color: #1a1a1a;          /* 가독성(검정 계열) */
  cursor: pointer;
  font-weight: 800;
  transition: transform .08s ease, filter .12s ease;
}
.btn:hover{ filter: brightness(1.06); }
.btn:active{ transform: translateY(1px) scale(.99); }

/* 포커스 접근성(골드 링) */
.btn:focus-visible, .close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255,213,79,.25);
}
</style>
