import { t } from '../i18n/index';
// emoti 공식 강좌(2026-10-15 사용자 요청: "영상강좌 + 사진 + 텍스트(모션 비디오), 나중에 작가들이 올릴 때 참고 가이드가 될 정도로").
// 강좌 한 편 = 단계 여러 개. 단계 = 짧은 모션 영상(소리 없음 · 반복) 또는 사진 + 제목 + 설명 2~3줄.
// 끝에 '핵심 정리' 세 줄과 '바로 해 보기' 하나. 작가 강좌도 같은 틀로 올린다(⑩ 강좌 만드는 법).
// 영상·사진은 앱 안에 들어 있다(인터넷 없이 본다). 유튜브 전체 영상(배경음악·자막)은 youtube 에 링크만 둔다.
// 2026-10-16: 예시 캐릭터는 대표 캐릭터 콘(옥수수). 영상은 에뮬레이터에서 콘을 실제로 그리고 움직여 찍었다(scripts/lessons/corn-strokes.cjs).
// 콘에 없는 부위(귀·꼬리·엄지)는 억지로 바꾸지 않고, 콘의 새싹 잎·손·따로 그린 소품(하트)으로 같은 기능을 보인다.
// 규격·수치는 kakao-spec.ts 에서 가져온다 — 여기서 새로 지어내지 않는다. '승인 팁'은 emoti 가 권하는 습관이지 카카오 심사 기준이 아니다.
import { KAKAO_ANIMATED_SPEC, STAGES } from './kakao-spec';

export type LessonStep = { title: string; body: string; video?: number; image?: number };
export type LessonAction = 'newSet' | 'continue' | 'guide' | 'export' | 'contest' | 'book';
export type Lesson = {
  id: string; group: 'app' | 'draw' | 'artist'; title: string; summary: string; minutes: number;
  // thumb: 목록의 16:9 썸네일(960×540, scripts/lessons/corn-art.cjs). cover 는 예전 4:3 표지(지금은 쓰지 않음).
  thumb: number; cover?: number; steps: LessonStep[]; points: [string, string, string]; tryIt?: { label: string; action: LessonAction }; youtube?: string;
};
export const LESSON_GROUPS: { id: Lesson['group']; title: string; short: string; free: boolean }[] = [
  { id: 'app', title: t('lesson.text000'), short: t('ui.lessonApp'), free: true },
  { id: 'draw', title: t('lesson.text001'), short: t('ui.lessonDrawing'), free: true },
  { id: 'artist', title: t('ui.lessonCreator'), short: t('ui.lessonCreator'), free: true },
];

const cuts = STAGES.animated.proposal.emoticons;

export const LESSONS: Lesson[] = [
  {
    id: 'first-set', group: 'app', title: t('lesson.text002'), summary: t('lesson.text003'), minutes: 2,
    thumb: require('../../assets/lessons/thumbs/first-set.png'),
    cover: require('../../assets/lessons/first-set/cover.png'),
    steps: [
      { title: t('lesson.text004'), video: require('../../assets/lessons/first-set/step1.mp4'), body: t('lesson.text005') },
      { title: t('ui.draw'), video: require('../../assets/lessons/first-set/step2.mp4'), body: t('lesson.text006') },
      { title: t('lesson.text007'), video: require('../../assets/lessons/first-set/step3.mp4'), body: t('lesson.text008') },
      { title: t('lesson.text009'), video: require('../../assets/lessons/first-set/step4.mp4'), body: t('lesson.text010') },
    ],
    points: [t("release.s1016"), t("release.s1017"), t("release.s1018")],
    tryIt: { label: t('ui.newSet'), action: 'newSet' },
  },
  {
    id: 'brush-layer', group: 'app', title: t('lesson.text011'), summary: t('lesson.text012'), minutes: 3,
    thumb: require('../../assets/lessons/thumbs/brush-layer.png'),
    cover: require('../../assets/lessons/brush-layer/cover.png'),
    steps: [
      { title: t('lesson.text013'), video: require('../../assets/lessons/brush-layer/step1.mp4'), body: t('lesson.text014') },
      { title: t('lesson.text015'), video: require('../../assets/lessons/brush-layer/step2.mp4'), body: t('lesson.text016') },
      { title: t('lesson.text017'), video: require('../../assets/lessons/brush-layer/step3.mp4'), body: t('lesson.text018') },
      { title: t('lesson.text019'), image: require('../../assets/lessons/brush-layer/step4.png'), body: t('lesson.text020') },
    ],
    points: [t("release.s1019"), t("release.s1020"), t("release.s1021")],
    tryIt: { label: t('ui.drawContinue'), action: 'continue' },
  },
  {
    id: 'motion', group: 'app', title: t('lesson.text021'), summary: t('lesson.text022'), minutes: 3,
    thumb: require('../../assets/lessons/thumbs/motion.png'),
    cover: require('../../assets/lessons/motion/cover.png'),
    steps: [
      { title: t('ui.chooseEffect'), video: require('../../assets/lessons/motion/step1.mp4'), body: t('lesson.text023') },
      { title: t('lesson.text024'), video: require('../../assets/lessons/motion/step2.mp4'), body: t('lesson.text025') },
      { title: t('lesson.text026'), video: require('../../assets/lessons/motion/step3.mp4'), body: t('lesson.text027') },
      { title: t('ui.partOnly'), video: require('../../assets/lessons/motion/step4.mp4'), body: t('lesson.text028') },
    ],
    points: [t("release.s1022"), t("release.s1023"), t("release.s1024")],
    tryIt: { label: t('ui.drawContinue'), action: 'continue' },
  },
  {
    // 2026-10-29: 대사(가이드 대사 · 추천 대사 · 글씨 배치). 실제 카카오 이모티콘처럼 짧은 말을 캐릭터 위에 작게.
    id: 'speech', group: 'app', title: t('lesson.text091'), summary: t('lesson.text092'), minutes: 2,
    thumb: require('../../assets/lessons/thumbs/speech.png'),
    steps: [
      { title: t('lesson.text093'), video: require('../../assets/lessons/speech/step1.mp4'), body: t('lesson.text094') },
      { title: t('lesson.text095'), video: require('../../assets/lessons/speech/step2.mp4'), body: t('lesson.text096') },
      { title: t('lesson.text097'), video: require('../../assets/lessons/speech/step3.mp4'), body: t('lesson.text098') },
    ],
    points: [t("release.s1025"), t("release.s1026"), t("release.s1027")],
    tryIt: { label: t('ui.openGuide'), action: 'guide' },
  },
  {
    id: 'animation', group: 'app', title: t('lesson.text029'), summary: t('lesson.text030'), minutes: 4,
    thumb: require('../../assets/lessons/thumbs/animation.png'),
    cover: require('../../assets/lessons/animation/cover.png'),
    steps: [
      { title: t('lesson.text031'), video: require('../../assets/lessons/animation/step1.mp4'), body: t('lesson.text032') },
      { title: t('lesson.text033'), video: require('../../assets/lessons/animation/step2.mp4'), body: t('lesson.text034') },
      { title: t('lesson.text035'), video: require('../../assets/lessons/animation/step3.mp4'), body: t('lesson.text036') },
      { title: t('lesson.text037'), video: require('../../assets/lessons/animation/step4.mp4'), body: t('lesson.text038') },
    ],
    points: [t("release.s1028"), t("release.s1029"), t("release.d153", { v0: (KAKAO_ANIMATED_SPEC.maxFrames) })],
    tryIt: { label: t('ui.drawContinue'), action: 'continue' },
  },
  {
    id: 'export', group: 'app', title: t('lesson.text039'), summary: t('lesson.text040'), minutes: 3,
    thumb: require('../../assets/lessons/thumbs/export.png'),
    steps: [
      { title: t('lesson.text041'), video: require('../../assets/lessons/export/step1.mp4'), body: t('lesson.text042') },
      { title: t('lesson.text043'), video: require('../../assets/lessons/export/step2.mp4'), body: t('lesson.text044') },
      { title: t('lesson.text045'), video: require('../../assets/lessons/export/step3.mp4'), body: t('lesson.text046') },
      { title: t('lesson.text047'), body: t('lesson.text048') },
    ],
    points: [t("release.d154", { v0: (cuts) }), t("release.s1030"), t("release.s1031")],
    tryIt: { label: t("release.s1032"), action: 'export' },
  },
  {
    id: 'contest', group: 'app', title: t('lesson.text049'), summary: t('lesson.text050'), minutes: 2,
    thumb: require('../../assets/lessons/thumbs/contest.png'),
    steps: [
      { title: t('lesson.text051'), body: t('lesson.text052') },
      { title: t('lesson.text053'), body: t('lesson.text054') },
      { title: t('lesson.text055'), body: t('lesson.text056') },
    ],
    points: [t("release.s1033"), t("release.s1034"), t("release.s1035")],
    tryIt: { label: t('lesson.text051'), action: 'contest' },
  },
  {
    id: 'character', group: 'draw', title: t('lesson.text057'), summary: t('lesson.text058'), minutes: 3,
    thumb: require('../../assets/lessons/thumbs/character.png'),
    cover: require('../../assets/lessons/character/step1.png'),
    steps: [
      { title: t('lesson.text059'), image: require('../../assets/lessons/character/step1.png'), body: t('lesson.text060') },
      { title: t('lesson.text061'), image: require('../../assets/lessons/character/step2.png'), body: t('lesson.text062') },
      { title: t('lesson.text063'), image: require('../../assets/lessons/character/step3.png'), body: t('lesson.text064') },
    ],
    points: [t("release.s1036"), t("release.s1037"), t("release.s1038")],
    tryIt: { label: t('ui.drawContinue'), action: 'continue' },
  },
  {
    id: 'expressions', group: 'draw', title: t('lesson.text065'), summary: t('lesson.text066'), minutes: 4,
    thumb: require('../../assets/lessons/thumbs/expressions.png'),
    cover: require('../../assets/lessons/expressions/step3.png'),
    steps: [
      { title: t('lesson.text067'), image: require('../../assets/lessons/expressions/step1.png'), body: t('lesson.text068') },
      { title: t('lesson.text069'), body: t('lesson.text070') },
      { title: t('lesson.text071'), image: require('../../assets/lessons/expressions/step3.png'), body: t('lesson.text072') },
    ],
    points: [t("release.s1039"), t("release.s1040"), t("release.s1041")],
    tryIt: { label: t('ui.openGuide'), action: 'guide' },
  },
  {
    id: 'set-plan', group: 'draw', title: t('lesson.text073'), summary: t('lesson.text074'), minutes: 3,
    thumb: require('../../assets/lessons/thumbs/set-plan.png'),
    steps: [
      { title: t('lesson.text075'), image: require('../../assets/lessons/set-plan/step1.png'), body: t('lesson.text076') },
      { title: t('lesson.text077'), body: t('lesson.text078') },
      { title: t('lesson.text079'), body: t('lesson.text080') },
    ],
    points: [t("release.s1042"), t("lesson.text077"), t("release.s1043")],
    tryIt: { label: t("release.s1044"), action: 'book' },
  },
  {
    id: 'make-lesson', group: 'artist', title: t('lesson.text081'), summary: t('lesson.text082'), minutes: 3,
    thumb: require('../../assets/lessons/thumbs/make-lesson.png'),
    steps: [
      { title: t('lesson.text083'), body: t('lesson.text084') },
      { title: t('lesson.text085'), image: require('../../assets/lessons/make-lesson/step2.png'), body: t('lesson.text086') },
      { title: t('lesson.text087'), image: require('../../assets/lessons/make-lesson/step3.png'), body: t('lesson.text088') },
      { title: t('lesson.text089'), body: t('lesson.text090') },
    ],
    points: [t("release.s1045"), t("release.s1046"), t("release.s1047")],
  },
];
