// src/legalpage/constants/legals.ts
export type LegalKind = 'page' | 'consent';

export interface LegalItem {
  slug: string;
  label: string;
  kind: LegalKind;
  /** consent일 때만 의미 있음: 기본 필수 여부 힌트 */
  defaultRequired?: boolean;
}

/** 서버 slug와 1:1 매칭되도록 유지할 것 */
export const LEGAL_ITEMS: LegalItem[] = [
  { slug: 'terms',                 label: '서비스 이용약관',             kind: 'page' },
  { slug: 'privacy',               label: '개인정보 처리방침',           kind: 'page' },
  { slug: 'privacy-change-notice', label: '개인정보 처리방침 변경공지',   kind: 'page' },
  { slug: 'lbs-terms',             label: '위치기반서비스 약관',          kind: 'page' },
  { slug: 'guidelines',            label: '커뮤니티 가이드라인',          kind: 'page' },
  { slug: 'report-block',          label: '신고 및 차단 정책',            kind: 'page' },
  { slug: 'refund-policy',         label: '환불/구독 해지 정책',          kind: 'page' },
  { slug: 'youth-policy',          label: '청소년 보호정책',              kind: 'page' },
  { slug: 'cookies',               label: '쿠키/추적 기술 안내',          kind: 'page' },
  { slug: 'data-retention',        label: '데이터 보관·삭제 정책',        kind: 'page' },

  { slug: 'privacy-consent',       label: '개인정보 수집·이용 동의',      kind: 'consent', defaultRequired: true  },
  { slug: 'sharing-consent',       label: '제3자 제공 동의',              kind: 'consent', defaultRequired: true  },
  { slug: 'xborder-consent',       label: '국외 이전 동의',               kind: 'consent', defaultRequired: true  },
  { slug: 'marketing-consent',     label: '광고성 정보 수신 동의',        kind: 'consent', defaultRequired: false },
];

// 편의 헬퍼
export const LEGAL_MAP = new Map(LEGAL_ITEMS.map(i => [i.slug, i]));
export const LEGAL_SLUGS = LEGAL_ITEMS.map(i => i.slug);

export function getLabel(slug: string): string {
  return LEGAL_MAP.get(slug)?.label ?? slug;
}
export function isConsent(slug: string): boolean {
  return LEGAL_MAP.get(slug)?.kind === 'consent';
}
export function getDefaultRequired(slug: string): boolean {
  const item = LEGAL_MAP.get(slug);
  if (!item) return false;
  // consent일 때만 의미 있음
  if (item.kind === 'consent') return item.defaultRequired ?? true;
  // page 문서는 동의 대상이 아님 → false
  return false;
}
