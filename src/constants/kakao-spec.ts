// Work targets requested for this V1, not a claim of current submission eligibility.
export const KAKAO_STATIC_SPEC = {
  width: 360,
  height: 360,
  count: 32,
  format: 'PNG',
  maxBytes: null as number | null,
  requireTransparency: true,
  policyStatus: 'UNVERIFIED',
  checkedAt: '2026-09-09',
  officialUrl: 'https://emoticonstudio.kakao.com/pages/start',
  note: '최신 공식 제출 규격 미확인. 360×360 / PNG / 32개는 V1 작업 기준입니다. 용량 상한은 공식 확인 후 설정해야 합니다.',
} as const;
