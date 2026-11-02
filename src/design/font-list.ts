// 문구 손글씨 폰트 목록(2026-11-03, 대표: "폰트가 너무 적다 · 무료 손글씨를 넣고 유료는 PRO 로").
// 모두 Google Fonts · SIL Open Font License 1.1(assets/fonts/licenses). 자주 쓰는 글자만 남긴 WOFF2 — scripts/fonts/build-fonts.cjs.
// 이 파일은 목록만(저장본 검사·테스트도 읽는다). 파일을 읽어 캔버스에 싣는 일은 fonts.ts.
// 문구 글씨체 목록에는 기본 셋(기본·또박·도톰) 뒤에 **지금 앱 언어의 폰트**만 나온다(일본어 화면엔 일본어 손글씨).
import { lang } from '../i18n/index';

export type FontLang = 'ko' | 'ja' | 'zh-Hant';
export type CaptionFont = { key: string; title: string; lang: FontLang; pro: boolean };
export const CAPTION_FONTS: CaptionFont[] = [
  { key: 'gaegu', title: 'Gaegu', lang: 'ko', pro: false },
  { key: 'nanumpen', title: '나눔손글씨 펜', lang: 'ko', pro: false },
  { key: 'jua', title: '주아', lang: 'ko', pro: false },
  { key: 'poorstory', title: 'Poor Story', lang: 'ko', pro: false },
  { key: 'gamjaflower', title: '감자꽃', lang: 'ko', pro: true },
  { key: 'himelody', title: 'Hi Melody', lang: 'ko', pro: true },
  { key: 'singleday', title: 'Single Day', lang: 'ko', pro: true },
  { key: 'cutefont', title: 'Cute Font', lang: 'ko', pro: true },
  { key: 'yeonsung', title: '연성', lang: 'ko', pro: true },
  { key: 'dokdo', title: '동해 독도', lang: 'ko', pro: true },
  { key: 'yomogi', title: 'Yomogi', lang: 'ja', pro: false },
  { key: 'kleeone', title: 'Klee One', lang: 'ja', pro: false },
  { key: 'hachimaru', title: 'はちまるポップ', lang: 'ja', pro: true },
  { key: 'yusei', title: 'Yusei Magic', lang: 'ja', pro: true },
  { key: 'kurenaido', title: '紅道', lang: 'ja', pro: true },
  { key: 'huninn', title: '粉圓', lang: 'zh-Hant', pro: false },
  { key: 'iansui', title: '芫荽', lang: 'zh-Hant', pro: false },
  { key: 'wenkai', title: '霞鶩文楷', lang: 'zh-Hant', pro: true },
];
export const FONT_KEYS = CAPTION_FONTS.map(f => f.key);
export const fontOf = (key?: string | null) => CAPTION_FONTS.find(f => f.key === key) ?? null;
export const fontsForLang = (l: FontLang = lang()) => CAPTION_FONTS.filter(f => f.lang === l);
// 저장본에 폰트가 있는데 지금 언어 목록에 없으면(언어를 바꾼 경우) 그 폰트도 목록 끝에 보인다 — 고른 것이 사라져 보이지 않게.
export function fontChoices(current?: string | null): CaptionFont[] {
  const list = fontsForLang(), cur = fontOf(current);
  return cur && !list.includes(cur) ? [...list, cur] : list;
}
