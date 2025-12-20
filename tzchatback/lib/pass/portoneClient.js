// backend/lib/pass/portoneClient.js
const axios = require('axios');

const DEFAULT_PORTONE_API_BASE = 'https://api.portone.io';

function getApiBase() {
  return String(process.env.PORTONE_API_BASE || DEFAULT_PORTONE_API_BASE).replace(/\/+$/, '');
}

function getSecret() {
  // ✅ 모듈 로드시 고정하지 말고, 호출 시점에 매번 읽기
  const s = String(process.env.PORTONE_V2_API_SECRET || '').trim();
  if (!s) {
    const err = new Error('PORTONE_V2_API_SECRET is missing');
    err.code = 'ENV_MISSING';
    throw err;
  }
  return s;
}

function authHeader() {
  // Authorization: PortOne {V2_API_SECRET}
  return { Authorization: `PortOne ${getSecret()}` };
}

/**
 * PortOne V2 본인인증 단건 조회
 * GET {base}/identity-verifications/{identityVerificationId}
 *
 * 옵션:
 * - storeId: (선택) 동일 서버에서 여러 store를 다룰 가능성 대비
 */
async function getIdentityVerification(identityVerificationId, opts = {}) {
  const base = getApiBase();
  const id = encodeURIComponent(String(identityVerificationId || '').trim());

  const url = `${base}/identity-verifications/${id}`;

  const storeId =
    String(opts.storeId || process.env.PORTONE_STORE_ID || '').trim();

  const res = await axios.get(url, {
    headers: {
      ...authHeader(),
      Accept: 'application/json',
    },
    params: storeId ? { storeId } : undefined,
    timeout: 15000,
    validateStatus: () => true,
  });

  return { status: res.status, data: res.data };
}

module.exports = {
  getIdentityVerification,
};
