// tzchatback/push/firebase.js
// -------------------------------------------------------------
// ✅ Firebase Admin 초기화 (서버에서 FCM 발송용)
// - 설치/키파일 이슈가 있어도 서버가 죽지 않도록 방어
// - 중복 초기화 방지(firebaseAdmin.apps.length 체크)
// - 환경변수 FCM_SA_JSON(직접 JSON) / FCM_SA_PATH(파일경로) 모두 지원
// -------------------------------------------------------------
const path = require('path');

let admin = null;
let initialized = false;

try {
  // 설치 안되어 있으면 여기서만 실패 → 서버는 계속 동작
  // eslint-disable-next-line import/no-extraneous-dependencies
  const firebaseAdmin = require('firebase-admin');

  // 1) 서비스 계정 로딩: JSON 문자열 > 파일 경로 > 기본 경로
  let credentialObj = null;

  if (process.env.FCM_SA_JSON) {
    try {
      credentialObj = JSON.parse(process.env.FCM_SA_JSON);
    } catch (e) {
      console.error('[FCM] FCM_SA_JSON 파싱 실패:', e?.message || e);
    }
  }

  let serviceAccountPath = null;
  if (!credentialObj) {
    serviceAccountPath =
      process.env.FCM_SA_PATH ||
      path.join(__dirname, '../keys/serviceAccountKey.json');
    // require 로 JSON 로드 (존재하지 않으면 throw)
    credentialObj = require(serviceAccountPath);
  }

  // 2) 중복 초기화 방지
  if (!firebaseAdmin.apps || firebaseAdmin.apps.length === 0) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(credentialObj),
      // 필요 시 projectId 명시 가능:
      // projectId: process.env.GOOGLE_CLOUD_PROJECT || credentialObj.project_id,
    });
  }

  admin = firebaseAdmin;
  initialized = true;

  // 경로/환경정보는 민감하니 상세 경로는 로그에 노출하지 않음
  console.log(
    '[FCM] Firebase Admin 초기화 완료:',
    process.env.FCM_SA_JSON ? 'env:FCM_SA_JSON' : `path:${serviceAccountPath ? '[set]' : '[default]'}`,
  );
} catch (err) {
  console.error('[FCM] 초기화 실패(발송 비활성):', err?.message || err);
}

module.exports = {
  admin,
  isInitialized: () => initialized,
};
