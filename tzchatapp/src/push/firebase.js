// push/firebase.js
// -------------------------------------------------------------
// ✅ Firebase Admin 초기화 (서버에서 FCM 발송용)
// - 설치/키파일 이슈가 있어도 서버가 죽지 않도록 방어
// -------------------------------------------------------------
const path = require('path');

let admin = null;
let initialized = false;

try {
  // 1) 동적 require로 설치 여부 자체를 try/catch
  //    (정적 require면 설치 안 됐을 때 서버가 즉시 크래시)
  // eslint-disable-next-line import/no-extraneous-dependencies
  const firebaseAdmin = require('firebase-admin');

  // 2) 서비스 계정 키 경로 결정
  const serviceAccountPath =
    process.env.FCM_SA_PATH ||
    path.join(__dirname, '../keys/serviceAccountKey.json');

  // 3) 초기화 시도
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(require(serviceAccountPath)),
  });

  admin = firebaseAdmin;
  initialized = true;
  console.log('[FCM] Firebase Admin 초기화 완료:', serviceAccountPath);
} catch (err) {
  // 설치 안 됨 / 키 파일 없음 / JSON 파싱 오류 등
  console.error('[FCM] 초기화 실패(발송은 비활성화됩니다):', err?.message || err);
}

module.exports = {
  admin,
  isInitialized: () => initialized,
};
