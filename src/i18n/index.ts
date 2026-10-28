// 다국어(2026-10-28, 글로벌 통합안 EM-G06). 한국어가 기본이자 대체 언어. 일본어(ja) · 번체 중국어(zh-Hant: 대만·홍콩·마카오).
// - 기기 언어로 고른다(expo-localization). 지원하지 않는 언어는 한국어.
// - 문구는 키로 찾는다. 키가 그 언어에 없으면 한국어 문구를 쓴다 — 번역이 덜 끝나도 화면이 비지 않는다.
// - ja·zh-Hant 는 Codex 문구 검토·확장본(원어민 대면 검수 전). 검수 전에는 스토어에서 그 언어를 열지 않는다(통합안 6절).
// - 접근성 이름(accessibilityLabel)도 같은 문구를 쓴다. 검사(scripts/*)는 한국어 기기로 돈다.
import { getLocales } from 'expo-localization';
import { ko, type Key } from './ko';
import { ja } from './ja';
import { zhHant } from './zh-Hant';

export type Lang = 'ko' | 'ja' | 'zh-Hant';
const TABLES: Record<Lang, Partial<Record<Key, string>>> = { ko, ja, 'zh-Hant': zhHant };

export function pickLang(locales: { languageCode?: string | null; languageScriptCode?: string | null; regionCode?: string | null }[]): Lang {
  for (const l of locales) {
    const code = (l.languageCode || '').toLowerCase();
    if (code === 'ko') return 'ko';
    if (code === 'ja') return 'ja';
    if (code === 'zh') {
      const script = (l.languageScriptCode || '').toLowerCase(), region = (l.regionCode || '').toUpperCase();
      if (script === 'hant' || ['TW', 'HK', 'MO'].includes(region)) return 'zh-Hant';
    }
  }
  return 'ko';
}

let current: Lang = (() => { try { return pickLang(getLocales()); } catch { return 'ko'; } })();
export const lang = (): Lang => current;
// 검사·설정 화면용. 앱은 기기 언어를 따른다.
export function setLang(next: Lang) { current = next; }

// t('home.mySets') · t('home.count', { n: 3 }) — {n} 자리를 채운다.
export function t(key: Key, vars?: Record<string, string | number>): string {
  const text = TABLES[current][key] ?? ko[key];
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}
// 해외(한국어가 아닌) 이용자인가 — 카카오 전용 안내·국내 공모전을 숨기고 LINE 을 앞에 둘 때 쓴다.
export const overseas = () => current !== 'ko';
// 대사(2026-10-28): 표현 가이드 감정(카드 id)마다 추천 대사 세 개. 없는 id 는 빈 목록.
export function sayLines(cardId: string): string[] {
  const text = (TABLES[current] as Record<string, string | undefined>)['say.' + cardId] ?? (ko as Record<string, string>)['say.' + cardId];
  return text ? text.split('|').map(s => s.trim()).filter(Boolean) : [];
}
// 감정을 정하지 않고 문구를 쓸 때 보여 줄 대표 대사 — 자주 쓰는 감정의 첫 대사.
const POPULAR = ['greeting-hello', 'greeting-thanks', 'greeting-like', 'sad-sorry', 'sad-crying', 'surprise-gasp', 'angry-hmph', 'daily-good-night'];
export const popularLines = (): string[] => POPULAR.map(id => sayLines(id)[0]).filter(Boolean);
