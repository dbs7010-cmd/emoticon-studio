import { t } from '../i18n/index';
// emoti 이용 가이드북(2026-10-13 사용자 요청: 홈 공지 슬라이드 ① — 앱 사용부터 이모티콘 승인 팁까지).
// - 규격·그리기 규칙은 kakao-spec.ts(카카오 공식 가이드 원문 확인 2026-09-12)에서 그대로 가져온다 — 여기서 새로 지어내지 않는다.
// - '승인 팁'은 emoti 가 권하는 제작 습관이다. 카카오의 심사 기준이라고 말하지 않는다(심사 기준 원문은 공개 가이드에 없다).
import { GUIDE_RULES, KAKAO_ANIMATED_SPEC, KAKAO_STATIC_SPEC, REQUIRED_EXTRAS, SPEC_SOURCE, STAGES, WEBP_TOOL_RULE } from './kakao-spec';

export type GuideChapter = { id: string; title: string; summary: string; items: { title: string; body: string }[]; source?: string };

const kb = (n: number) => Math.round(n / 1024) + 'KB';

export const GUIDEBOOK: GuideChapter[] = [
  {
    id: 'start', title: t('ui.firstStart'), summary: t('guide.text000'),
    items: [
      { title: t('lesson.text004'), body: t('guide.text002') },
      { title: t('guide.text003'), body: t('guide.text004') },
      { title: t('guide.text005'), body: t('guide.text006') },
      { title: t('guide.text007'), body: t('guide.text008') },
    ],
  },
  {
    id: 'motion', title: t('ui.makeMove'), summary: t('guide.text009'),
    items: [
      { title: t('ui.chooseEffect'), body: t('guide.text010') },
      { title: t('ui.partOnly'), body: t('guide.text011') },
      { title: t('ui.applyMultiple'), body: t('guide.text012') },
      { title: t('guide.text013'), body: GUIDE_RULES[1] },
    ],
  },
  {
    id: 'finish', title: t('guide.text014'), summary: t('guide.text015'),
    items: [
      { title: t('lesson.text045'), body: t('guide.text017') },
      { title: t('guide.text018'), body: t('guide.text019') },
      { title: t('guide.text020'), body: t('guide.text021') },
      { title: t('guide.text022'), body: t('guide.text023') },
      { title: t('guide.text024'), body: WEBP_TOOL_RULE + " " + t("release.x139") },
    ],
  },
  {
    id: 'spec', title: t('guide.text025'), summary: t('guide.text026'),
    source: SPEC_SOURCE.guide,
    items: [
      { title: KAKAO_STATIC_SPEC.profileLabel, body: t("release.k23", { v0: (STAGES.still.proposal.text), v1: (KAKAO_STATIC_SPEC.width), v2: (KAKAO_STATIC_SPEC.height), v3: (kb(KAKAO_STATIC_SPEC.maxBytes)) }) },
      { title: KAKAO_ANIMATED_SPEC.profileLabel, body: t("release.k24", { v0: (STAGES.animated.proposal.text), v1: (KAKAO_ANIMATED_SPEC.width), v2: (KAKAO_ANIMATED_SPEC.height), v3: (kb(KAKAO_ANIMATED_SPEC.maxBytes)), v4: (KAKAO_ANIMATED_SPEC.maxFrames), v5: (KAKAO_ANIMATED_SPEC.loops) }) },
      ...REQUIRED_EXTRAS.map(x => ({ title: `${x.label}(${x.stage})`, body: x.spec })),
      { title: t('guide.text027'), body: GUIDE_RULES[0] },
    ],
  },
  {
    id: 'tips', title: t('guide.text028'), summary: t('lesson.text074'),
    items: [
      { title: t('guide.text030'), body: t('guide.text031') },
      { title: t('guide.text032'), body: t('guide.text033') },
      { title: t('guide.text034'), body: t('guide.text035') },
      { title: t('guide.text036'), body: t('guide.text037') },
      { title: t('guide.text038'), body: t('guide.text039') },
      { title: t('guide.text040'), body: t('guide.text041') },
    ],
  },
  {
    id: 'account', title: t('guide.text042'), summary: t('guide.text043'),
    items: [
      { title: t('guide.text044'), body: t('guide.text045') },
      { title: t('guide.text046'), body: t('guide.text047') },
      { title: t('guide.text048'), body: t('guide.text049') },
      { title: t('ui.deletingAccount'), body: t('guide.text050') },
    ],
  },
];
