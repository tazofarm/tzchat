// backend/lib/pass/danalClient.js
// Danal PASS client (server-side)
// - buildStartUrl: 공급사 인증 시작 URL 생성
// - parseCallback : 공급사 콜백 파싱 (GET/POST 모두 허용, 필드명 변형 호환)

const querystring = require('querystring');

// ── Env mapping (new keys first, legacy keys fallback)
const CPID = process.env.DANAL_CPID || process.env.PASS_CPID || '';
const PWD  = process.env.DANAL_PWD  || process.env.PASS_PWD  || '';
const BASE = (process.env.DANAL_BASE_URL || process.env.PASS_PROVIDER_START_URL || 'https://uas.teledit.com/uas').replace(/\/+$/, '');

// Decide callback base by environment
function resolveCallbackBase() {
  const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  if (isDev) {
    return (process.env.PASS_CALLBACK_LOCAL || `http://localhost:${process.env.PORT || 2000}`).replace(/\/+$/, '');
  }
  return (process.env.PASS_CALLBACK_PROD || process.env.API_ORIGIN || 'https://tzchat.tazocode.com').replace(/\/+$/, '');
}

// Full callback URL for PASS provider to hit
function buildCallbackUrl() {
  return `${resolveCallbackBase()}/api/auth/pass/callback`;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
module.exports = {
  /**
   * Build provider start URL
   * 실제 연동에서는 CP 비밀번호 원문을 그대로 전달하지 않고,
   * 공급사 명세에 맞는 시그니처/암호화 파라미터를 사용해야 합니다.
   * (본 구현은 서버 라우팅/흐름 점검용으로 단순화되어 있습니다.)
   */
  async buildStartUrl({ txId, intent }) {
    if (!CPID || !PWD) {
      throw new Error('Danal PASS env not set: DANAL_CPID / DANAL_PWD are required');
    }

    const CALLBACK = buildCallbackUrl();

    // 일반적으로 Danal 측 파라미터 예시 (명세에 따라 조정하세요)
    // - CPID: 가맹점 ID
    // - CPPASS/CPPWD: 가맹점 비밀번호(데모/점검용)
    // - TXID: 트랜잭션 ID (우리 서버가 생성)
    // - RETURNURL: 콜백 URL
    // - CERTTYPE/CLIENTTYPE/MODE 등은 서비스 정책에 맞게 설정
    const query = {
      CPID,
      CPPASS: PWD,                 // ⚠️ 실제 운영에서는 시그니처 사용 권장
      TXID: txId,
      RETURNURL: CALLBACK,
      CERTTYPE: '04',              // 예: 휴대폰 본인확인
      CLIENTTYPE: 'W',             // W: Web, A: App 등
      MODE: 'AUTH',                // 인증 모드
      CUSTOM1: intent || 'unified' // 우리 쪽 intent 전달 (선택)
    };

    const q = querystring.stringify(query);
    return `${BASE}?${q}`;
  },

  /**
   * Normalize provider callback payload
   * - Danal 표준 필드 우선: RESULTCODE === '0000' 성공
   * - 과거/변형 필드도 최대한 흡수
   */
  async parseCallback(req) {
    const src = req && req.method === 'POST' ? (req.body || {}) : (req && req.query) || {};
    const all = { ...src };

    // 성공 판정: Danal 표준은 RESULTCODE === '0000'
    // 보조: RESULT === 'SUCCESS' 등 변형 호환
    const resultCode = String(all.RESULTCODE || all.resultCode || all.RESCODE || '').trim();
    const resultStr  = String(all.RESULT || all.result || '').trim().toUpperCase();
    const success = (resultCode === '0000') || (resultStr === 'SUCCESS');

    // 다양한 필드명 케이터링
    const txId =
      all.TXID || all.txId || all.TID || all.tid || all.TRANSACTIONID || '';

    const name =
      all.NAME || all.name || '';

    const birthdate =
      all.BIRTHDATE || all.birthdate || all.birth || ''; // YYYYMMDD

    // 성별: 'M'|'F' 또는 'MAN'|'WOMAN' 가능성
    const genderRaw = (all.GENDER || all.gender || '').toString().trim();
    const gender = genderRaw;

    // 휴대폰/통신사
    const phone =
      all.MOBILE || all.PHONE || all.phone || all.TELNO || '';

    const carrier =
      all.MOBILECOMPANY || all.CARRIER || all.carrier || '';

    // CI/DI
    const ci = all.CI || all.ci || '';
    const di = all.DI || all.di || '';

    // 실패 코드 우선순위: RESULTCODE → RESULT/RESCODE → UNKNOWN
    const failCode = success ? null : (resultCode || resultStr || 'UNKNOWN');

    return {
      success,
      txId,
      name,
      birthyear: all.BIRTHYEAR || all.birthyear || '', // 보조값(있으면 활용)
      birthdate,
      gender,     // 'M' | 'F' (상위 라우터에서 표준화)
      phone,      // 상위 라우터에서 E.164 표준화
      carrier,
      ci,
      di,
      failCode,
      raw: all,   // 원문 보관(상위에서 마스킹 후 저장)
    };
  },
};
