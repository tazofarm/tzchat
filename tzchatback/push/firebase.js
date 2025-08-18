// tzchatback/push/firebase.js
// -------------------------------------------------------------
// ✅ Firebase Admin 초기화 (서버에서 FCM 발송용)
// - 설치/키파일 이슈가 있어도 서버가 죽지 않도록 방어
// -------------------------------------------------------------
const path = require('path');

let admin = null;
let initialized = false;

try {
  // 동적 require: 설치 안 돼 있으면 여기서만 실패하고 서버는 계속 뜸
  // eslint-disable-next-line import/no-extraneous-dependencies
  const firebaseAdmin = require('firebase-admin');

  // 서비스 계정 키 경로 (환경변수 우선, 없으면 기본 경로)
  const serviceAccountPath =
    process.env.FCM_SA_PATH ||
    path.join(__dirname, '../keys/serviceAccountKey.json');

  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(require(serviceAccountPath)),
  });

  admin = firebaseAdmin;
  initialized = true;
  console.log('[FCM] Firebase Admin 초기화 완료:', serviceAccountPath);
} catch (err) {
  console.error('[FCM] 초기화 실패(발송 비활성):', err?.message || err);
}

module.exports = {
  admin,
  isInitialized: () => initialized,
};
