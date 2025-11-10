// lib/danalCallback.js
// 다날 PASS 콜백 파서 (EUC-KR/UTF-8 자동 대응 + 안전 파싱)

const iconv = require('iconv-lite');
const qs = require('querystring');

function getCharset(contentType = '') {
  const m = /charset\s*=\s*([^\s;]+)/i.exec(contentType || '');
  return (m && m[1] || '').toLowerCase();
}

function decodeBody(rawBuffer, contentType) {
  const charset = getCharset(contentType);
  const buf = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer || '');
  if (!buf.length) return '';
  if (charset.includes('euc-kr') || charset.includes('euckr') || charset.includes('ks_c_5601')) {
    return iconv.decode(buf, 'euc-kr');
  }
  // 기본은 UTF-8
  return buf.toString('utf8');
}

function parseFormLike(s = '') {
  // 대부분 application/x-www-form-urlencoded 형태
  // 혹시 text/html로 오는 경우에도 본문이 "a=b&c=d"라면 그대로 파싱
  const obj = qs.parse(String(s));
  // "a=b&c=d"가 아니면 obj가 거의 빈 객체 → 호출 측에서 검사
  return obj;
}

function validateMinimalFields(fields) {
  // 벤더 고유값을 단정하지 않고, 최소 키만 검증 (필요 시 추가)
  const result = {};
  const missing = [];

  // 관례상 존재하는 키 후보들
  const RESULT_CODE = fields.RESULT_CODE || fields.result_code || fields.RSLT_CD || fields.code;
  const RESULT_MSG  = fields.RESULT_MSG  || fields.result_msg  || fields.RSLT_MSG || fields.message;
  const TID         = fields.TID         || fields.txId        || fields.TX_ID    || fields.tid;

  if (!RESULT_CODE) missing.push('RESULT_CODE');
  if (!TID)         missing.push('TID');

  result.RESULT_CODE = String(RESULT_CODE || '');
  result.RESULT_MSG  = RESULT_MSG ? String(RESULT_MSG) : '';
  result.TID         = String(TID || '');

  return { ok: missing.length === 0, fields: result, missing };
}

module.exports = {
  decodeBody,
  parseFormLike,
  validateMinimalFields,
  getCharset,
};
