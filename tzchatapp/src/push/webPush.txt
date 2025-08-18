// /src/push/webPush.ts
// -------------------------------------------------------------
// ✅ Web/PWA 푸시 등록
// - Service Worker: /firebase-messaging-sw.js 필요 (public 루트)
// - VAPID 키는 Firebase 콘솔에서 설정 → messaging.getToken에 전달
// -------------------------------------------------------------
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAxijk1sRxkzG7MwCA18Rtm7yErXVW59YI",
  authDomain: "tzchat-eb893.firebaseapp.com",
  projectId: "tzchat-eb893",
  // ✅ storageBucket 형식은 보통 "<projectId>.appspot.com"
  storageBucket: "tzchat-eb893.appspot.com",
  messagingSenderId: "565729575217",
  appId: "1:565729575217:web:5ba67d38c4f82302c13010",
  // measurementId는 Analytics 용도로 존재해도 무방합니다.
  measurementId: "G-G7263X06SP"
};

// ✅ Firebase 콘솔 > Cloud Messaging > 웹 구성(Web configuration) > Public VAPID key
//    "Generate key pair" 로 생성한 '공개키' 값으로 교체하세요.
const VAPID_KEY = 'BJ_B1iqArRIkGPUAJ52MU8xgq624Vcy9FjAkODOO5OL35JBt3J7bd1V_bIx_Z3sIXQxbjAuX-i_fDt2Boieb4ls';

export async function registerWebPush() {
  try {
    // 브라우저 지원 여부
    if (!(await isSupported())) {
      console.warn('[WebPush] 이 브라우저는 FCM Web을 지원하지 않습니다.');
      return;
    }

    console.log('[WebPush] 초기화 시작');
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // SW 등록 (PWA/웹 공통)
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[WebPush] 서비스워커 등록 완료:', reg.scope);

    // 권한 요청
    const perm = await Notification.requestPermission();
    console.log('[WebPush] 권한 결과:', perm);
    if (perm !== 'granted') {
      console.warn('[WebPush] 알림 권한 거부됨');
      return;
    }

    // 토큰 발급
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    }).catch((e) => {
      console.error('[WebPush] getToken 실패:', e);
      return null;
    });

    if (!token) {
      console.warn('[WebPush] 토큰 발급 실패 (null)');
      return;
    }

    console.log('[WebPush] 토큰:', token.slice(0, 16) + '...');

    // 서버 등록
    const resp = await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // 세션 쿠키 전달
      body: JSON.stringify({
        token,
        platform: 'web',
        appVersion: 'web-1.0.0'
      }),
    });

    if (!resp.ok) {
      console.error('[WebPush] 서버 등록 실패:', resp.status, await resp.text());
      return;
    }
    console.log('[WebPush] 서버 등록 완료');

    // 포그라운드 수신
    onMessage(messaging, (payload) => {
      console.log('[WebPush] 포그라운드 메시지 수신:', payload);
      // TODO: 페이지 내 토스트/배너 표시 로직 (원하시면 샘플 드릴게요)
    });
  } catch (err) {
    console.error('[WebPush] 초기화 오류:', err);
  }
}
