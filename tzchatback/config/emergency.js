// config/emergency.js
// -------------------------------------------------------------
// Emergency Matching 공통 설정/유틸
// - 전 라우터/컨트롤러에서 같은 지속시간, 같은 계산 로직을 사용하도록 중앙화
// -------------------------------------------------------------

// ✅ 환경변수 우선, 없으면 기본 3600초(1시간). 테스트 시 .env에 60으로 지정
const EMERGENCY_DURATION_SECONDS = parseInt(process.env.EMERGENCY_DURATION_SECONDS || '60', 10);

// ⏱️ 남은 시간 계산기
function computeRemaining(activatedAt, nowMs = Date.now(), durationSec = EMERGENCY_DURATION_SECONDS) {
  if (!activatedAt) return 0;
  const started = new Date(activatedAt).getTime();
  if (Number.isNaN(started)) return 0;
  const elapsedSec = Math.floor((nowMs - started) / 1000);
  return Math.max(0, durationSec - elapsedSec);
}

module.exports = {
  EMERGENCY_DURATION_SECONDS,
  computeRemaining,
};
