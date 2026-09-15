// Read from Kakao's own creator guide on 2026-09-12, in a browser that runs the page's scripts —
// not from a blog and not from memory.
// Source: https://kakaoemoticonstudio.notion.site/emoticon           (멈춰있는 이모티콘)
//         https://kakaoemoticonstudio.notion.site/animated-emoticon  (움직이는 이모티콘)
// The old https://emoticonstudio.kakao.com/pages/start URL is dead — it now shows
// "페이지를 찾을 수 없습니다". The guide moved to the Notion site above.
export const SPEC_SOURCE = {
  guide: 'https://kakaoemoticonstudio.notion.site/',
  still: 'https://kakaoemoticonstudio.notion.site/emoticon',
  animated: 'https://kakaoemoticonstudio.notion.site/animated-emoticon',
  webpAnimator: 'https://emoticonstudio.kakao.com/webp-animator',
  readAt: '2026-09-12',
  recheckedAt: '2026-09-12',   // 제안/출시 단계, WebPAnimator 입력 형식, 대표 이미지 근거를 다시 읽은 날
} as const;

export const KAKAO_STATIC_SPEC = {
  profileLabel: '멈춰있는 이모티콘',
  width: 360,
  height: 360,
  count: 32,
  format: 'PNG',
  maxBytes: 150 * 1024,
  requireTransparency: true,
  policyStatus: 'VERIFIED' as 'UNVERIFIED' | 'VERIFIED',
  checkedAt: SPEC_SOURCE.readAt,
  officialUrl: SPEC_SOURCE.still,
  note: '공식 가이드 기준: PNG 32개 · 360×360 · 150KB 이하 · 투명 배경. 제안에는 이모티콘 32개와 아이콘 1개가 필요해요. 출시에는 아이콘(78×78)과 공유 이미지(600×166), 대표 이미지 1개가 더 필요해요.',
} as const;

export const KAKAO_ANIMATED_SPEC = {
  profileLabel: '움직이는 이모티콘',
  width: 360,
  height: 360,
  count: 24,
  format: 'WebP',
  maxBytes: 650 * 1024,
  maxFrames: 24,
  loops: 4,
  proposalAnimatedMin: 3,   // 제안 때는 24개 중 3개만 움직이면 되고 나머지는 PNG로 낼 수 있다
  requireTransparency: true,
  policyStatus: 'VERIFIED' as 'UNVERIFIED' | 'VERIFIED',
  checkedAt: SPEC_SOURCE.readAt,
  officialUrl: SPEC_SOURCE.animated,
  note: '공식 가이드 기준: WebP 24개 · 360×360 · 650KB 이하 · 24프레임 이하 · 4회 반복 · 투명 배경. 제안에는 움직이는 WebP 3개만 필수이고 나머지는 PNG로 낼 수 있어요.',
} as const;

// 단계별 요구 — 공식 가이드 원문에서 그대로 옮겼다. 출시 기준을 제안에 그대로 적용하지 않는다.
//
//   멈춰있는 · 제안: "이모티콘 이미지 : PNG 32개 / 아이콘 이미지 : PNG 1개"
//   멈춰있는 · 출시: 위 + 공유 이미지 PNG 1개(600×166, 500KB)
//   움직이는 · 제안: "이모티콘 이미지 : 24개 (움직이는 WebP 3개 필수 제출, 나머지는 PNG 이미지로
//                    제출 가능) / 아이콘 이미지 : 1개"
//   움직이는 · 출시: 이모티콘 24개 전부 WebP + 아이콘 + 공유 이미지
export const STAGES = {
  still: {
    proposal: { emoticons: 32, formats: ['PNG'], icon: true, share: false,
      text: '제안: PNG 32개 + 아이콘 1개' },
    release: { emoticons: 32, formats: ['PNG'], icon: true, share: true,
      text: '출시: PNG 32개 + 아이콘 1개 + 공유 이미지 1개' },
  },
  animated: {
    proposal: { emoticons: 24, animatedMin: 3, formats: ['WebP', 'PNG'], icon: true, share: false,
      text: '제안: 24개 중 움직이는 WebP 3개는 필수, 나머지는 PNG 가능 + 아이콘 1개' },
    release: { emoticons: 24, animatedMin: 24, formats: ['WebP'], icon: true, share: true,
      text: '출시: WebP 24개 + 아이콘 1개 + 공유 이미지 1개' },
  },
} as const;

// 가이드가 직접 정한 제작 도구 제한. 이 앱이 만든 WebP 가 규격을 맞추더라도 이 문장을 대신하지 않는다.
export const WEBP_TOOL_RULE =
  'WebP 파일을 제작할 때는 카카오에서 제공하는 전용 WebPAnimator만 사용해 주세요.';
export const WEBP_ANIMATOR_URL = SPEC_SOURCE.webpAnimator;

// Things the guide requires that this app does not make yet. The export screen says so rather
// than implying a set is ready to submit.
// 부가 이미지 — 원문 확인 2026-09-12. 각 항목의 근거를 함께 둔다. 모호한 것은 확정으로 적지 않는다.
export const REQUIRED_EXTRAS = [
  {
    id: 'icon', label: '아이콘 이미지', spec: 'PNG 1개 · 78×78 · 16KB 이하',
    stage: '제안·출시', basis: '제안 목록에 "아이콘 이미지 : 1개", 상품 구성표에 78×78 / 16KB',
    confirmed: true,
  },
  {
    id: 'share', label: '공유 이미지', spec: 'PNG 1개 · 600×166 · 500KB 이하',
    stage: '출시', basis: '상품 구성표에 있고 제안 목록에는 없다',
    confirmed: true,
  },
  {
    id: 'cover', label: '대표 이미지', spec: '이모티콘 이미지 중 1개 선택',
    stage: '출시', basis: '"4. 대표 이미지 — 이모티콘 이미지 중 대표 이미지를 1개 선택해 주세요."',
    confirmed: true,
  },
] as const;

// 움직이는 WebP 를 만드는 공식 도구. 확인 2026-09-12: 유형에서 '움직이는 이모티콘'을 고르면
// 이미지 등록 화면이 나오고, 파일 입력이 받는 것은 다음과 같다.
//   accept="image/png,image/webp" · 여러 장 선택 가능 · 화면 안내 "360 x 360 사이즈만 가능"
//   프레임 표시 "프레임 0/24", 전체 시간(초)을 보여 준다.
// 즉 **360×360 PNG 프레임을 순서대로 넣으면 도구가 WebP 를 만든다.** 앱이 건네야 하는 것은 그 프레임이다.
export const WEBP_ANIMATOR_INPUT = {
  accepts: ['image/png', 'image/webp'] as const,
  size: '360 x 360 사이즈만 가능',
  maxFrames: 24,
  checkedAt: SPEC_SOURCE.readAt,
  url: SPEC_SOURCE.webpAnimator,
} as const;

// Two rules from the guide that change how a picture is drawn, not just how it is saved.
export const GUIDE_RULES = [
  '텍스트에는 흰색 아웃라인을 넣어요. 다크모드 배경에서도 읽히게 하기 위한 규칙이에요.',
  '움직이는 이모티콘은 마지막 프레임이 이모티콘샵과 키보드의 미리보기로 쓰여요. 대표하는 모습이 마지막에 오게 만들어요.',
] as const;

// The submission file is WebP made with Kakao's own WebPAnimator, which this app does not write.
// What it hands over is therefore a working file to carry into that tool — never a submission file.
export const EXPORT_IS_WORKING_FILE = true;
// 앱이 WebP 를 만들 수 있게 된 뒤에도 이 값은 참이다 — 가이드가 WebPAnimator 를 쓰라고 정했기 때문이다.
