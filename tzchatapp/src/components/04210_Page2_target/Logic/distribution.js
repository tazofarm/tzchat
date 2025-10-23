// frontend/04210_Page2_target/Logic/distribution.js

/**
 * murmur32 해시 구현 (32비트) — 내부용으로 사용
 */
function murmur32(str) {
  let h = 0 ^ str.length;
  let i = 0;
  let k;

  while (str.length >= i + 4) {
    k =
      (str.charCodeAt(i) & 0xff) |
      ((str.charCodeAt(i + 1) & 0xff) << 8) |
      ((str.charCodeAt(i + 2) & 0xff) << 16) |
      ((str.charCodeAt(i + 3) & 0xff) << 24);
    k = Math.imul(k, 0x5bd1e995);
    k ^= k >>> 24;
    k = Math.imul(k, 0x5bd1e995);
    h = Math.imul(h, 0x5bd1e995) ^ k;
    i += 4;
  }

  switch (str.length - i) {
    case 3:
      h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
    // falls through
    case 2:
      h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
    // falls through
    case 1:
      h ^= (str.charCodeAt(i) & 0xff);
      h = Math.imul(h, 0x5bd1e995);
  }

  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;

  return h >>> 0;
}

const hash01 = (s) => murmur32(String(s)) / 0xFFFFFFFF;

/** 최근성 감쇠 계산 (가중치) */
function recencyWeight(timeValue, now) {
  if (!timeValue) return 0;
  const ts = new Date(timeValue).getTime();
  if (!Number.isFinite(ts)) return 0;
  const halfLifeMs = 12 * 60 * 60 * 1000; // 12시간
  const lambda = Math.log(2) / halfLifeMs;
  return Math.exp(-lambda * (now - ts));
}

/** 사용자 버킷 판정 */
function whichBucket(u, now) {
  const d = u.last_login || u.lastLogin || u.updatedAt || u.createdAt;
  const ts = d ? new Date(d).getTime() : 0;
  const dt = now - ts;
  const d3 = 3 * 86400e3;
  const d10 = 10 * 86400e3;
  if (dt < d3) return 'B1';
  if (dt < d10) return 'B2';
  return 'B3';
}

/** 버킷 내 정렬: 최근성 + 해시 혼합 */
function sortBucket(arr, seed, now, mix = 0.35) {
  const key = (u) => {
    const w = recencyWeight(u.last_login || u.lastLogin || u.updatedAt || u.createdAt, now);
    const h = hash01(`${seed}#${u._id}`);
    return (1 - mix) * w + mix * h;
  };
  return [...arr].sort((a, b) => key(b) - key(a));
}

/** 버킷 회전: seed 기반 offset */
function rotateBySeed(arr, seed, tag) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  const off = murmur32(`${seed}::${tag}`) % arr.length;
  if (off === 0) return arr;
  return arr.slice(off).concat(arr.slice(0, off));
}

/**
 * 전체 분산 선정 로직:
 * @param {Array} rawList - 서버에서 받은 사용자 리스트
 * @param {Object} me - 현재 사용자 정보
 * @param {Object} options - 옵션 객체
 *   options.seedDay {string}
 *   options.viewerId {string}
 *   options.resetIndex {number}
 *   options.excludeIdsSet {Set<string>}
 *   options.applyTotalFilter {function}
 * @returns {Array} - 선택된 사용자 리스트 (최대 7명)
 */
export function applyDistributedSelection(
  rawList,
  me,
  {
    seedDay,
    viewerId,
    resetIndex = 0,
    excludeIdsSet = new Set(),
    applyTotalFilter,
  }
) {
  const now = Date.now();
  const day = seedDay ||
    (() => {
      const fmt = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' });
      const parts = fmt.formatToParts(new Date()).reduce((o, p) => { o[p.type] = p.value; return o; }, {});
      return `${parts.year}${parts.month}${parts.day}`;
    })();
  const seed = `${day}#${viewerId || 'anon'}#${resetIndex}`;

  // 1) excludeIds 제거
  const filtered1 = Array.isArray(rawList)
    ? rawList.filter(u => u && u._id && !excludeIdsSet.has(String(u._id)))
    : [];

  // 2) 전체 필터 적용
  const filtered2 = applyTotalFilter(filtered1, me);

  // 3) 버킷 분류
  const B1 = [], B2 = [], B3 = [];
  filtered2.forEach(u => {
    const b = whichBucket(u, now);
    if (b === 'B1') B1.push(u);
    else if (b === 'B2') B2.push(u);
    else B3.push(u);
  });

  // 4) 각 버킷 정렬 + 회전
  let sB1 = sortBucket(B1, seed, now);
  let sB2 = sortBucket(B2, seed, now);
  let sB3 = sortBucket(B3, seed, now);

  sB1 = rotateBySeed(sB1, seed, 'B1');
  sB2 = rotateBySeed(sB2, seed, 'B2');
  sB3 = rotateBySeed(sB3, seed, 'B3');

  // 5) 출력 리스트 구성
  const out = [];
  out.push(...sB1.splice(0, 3));
  out.push(...sB2.splice(0, 3));
  out.push(...sB3.splice(0, 1));

  // 6) 부족 시 백필: B1 → B2 → B3
  const order = [sB1, sB2, sB3];
  for (const bucketArr of order) {
    while (out.length < 7 && bucketArr.length) {
      out.push(bucketArr.shift());
    }
    if (out.length >= 7) break;
  }

  return out;
}
