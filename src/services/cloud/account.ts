// 계정(2026-10-08). 카카오·네이버·구글 모두 같은 방식: 시스템 브라우저(안드로이드 Custom Tabs · iOS 인증 세션)로
// 서버의 /auth/start 를 열면 서버가 회사 로그인을 끝내고 emoti://auth?ticket=… 로 돌려준다. 앱은 시작할 때 숨겨 둔
// 원래 값(verifier)과 함께 표를 서버에 내고 Firebase 로그인 토큰을 받는다.
// - 앱에는 회사 키·비밀값이 없다(서버 Secret Manager). 회사 로그인 SDK 도 넣지 않는다.
// - emoti:// 주소를 다른 앱이 가로채도 verifier 가 없으면 표를 쓸 수 없다.
// - 운영자가 서버에 그 회사 설정을 마친 뒤에만 앱 설정(extra.login)에서 버튼을 켠다. 꺼져 있으면 '준비 중'(요청 0회).
import type { Cloud, CloudConfig } from './firebase';
import { sha256Hex } from './sha256';

export type Provider = 'kakao' | 'naver' | 'google';
export type ServerUser = { pro: { active: boolean; source: string; verified: boolean; until?: number | null }; backupBytes: number; artistName: string | null };
export type OpenAuth = (url: string, returnUrl: string) => Promise<{ type: string; url?: string }>;
export const APP_RETURN = 'emoti://auth';

export function providerReady(extra: unknown, provider: Provider): boolean {
  const login = extra && typeof extra === 'object' ? (extra as { login?: Record<string, unknown> }).login : undefined;
  return !!login && login[provider] === true;
}
// 로그인 중계 주소: 설정에 authBase 가 있으면 그것, 없으면 Firebase Hosting 기본 주소.
export const authBase = (config: CloudConfig & { authBase?: string }) => (config.authBase || `https://${config.projectId}.web.app`).replace(/\/$/, '');

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const ascii = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));
export function startUrl(base: string, provider: Provider, verifier: string, ret: 'app' | 'web' = 'app') {
  return `${base}/auth/start?provider=${provider}&return=${ret}&challenge=${sha256Hex(ascii(verifier))}`;
}
function params(url: string): Record<string, string> {
  const q = url.split(/[?#]/).slice(1).join('&'), out: Record<string, string> = {};
  for (const kv of q.split('&')) { if (!kv) continue; const [k, v = ''] = kv.split('='); out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
  return out;
}
const ERRORS: Record<string, string> = {
  provider: '로그인 화면에서 문제가 생겼어요. 다시 시도해 주세요.',
  verify: '로그인을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
};

// 반환: 로그인한 uid, 사용자가 닫거나 취소하면 null.
export async function signInWithBrowser(cloud: Cloud, provider: Provider, opts: { base: string; open: OpenAuth; randomBytes: (n: number) => Uint8Array }): Promise<string | null> {
  const verifier = hex(opts.randomBytes(32));
  const r = await opts.open(startUrl(opts.base, provider, verifier), APP_RETURN);
  if (r.type !== 'success' || !r.url) return null;
  const p = params(r.url);
  if (p.error === 'cancelled') return null;
  if (p.error || !p.ticket) throw new Error(ERRORS[p.error] ?? ERRORS.verify);
  const { token } = await cloud.call<{ token: string }>('redeemAuth', { ticket: p.ticket, verifier });
  return cloud.signInWithToken(token);
}
export const register = (cloud: Cloud) => cloud.call<ServerUser>('registerUser', {});
// 작가명(2026-10-08): 한 번 정하면 바꿀 수 없다. 형식은 앱이 먼저 보고, 금지어·중복은 서버가 정한다.
export const ARTIST_NAME = /^[가-힣A-Za-z0-9]{2,12}$/;
export const artistNameFormat = (name: string) => ARTIST_NAME.test(name.normalize('NFC').trim()) ? null : '한글·영문·숫자 2~12자로 정해 주세요(띄어쓰기·기호 없이).';
export const checkArtistName = (cloud: Cloud, name: string) => cloud.call<{ ok: boolean; reason?: string }>('checkArtistName', { name });
export const setArtistName = (cloud: Cloud, name: string) => cloud.call<{ artistName: string }>('setArtistName', { name });
export const signOutAll = (cloud: Cloud) => cloud.signOut();
// 탈퇴: 서버의 개인 백업·회원 정보·공모전 접수·로그인 계정을 지운다. 기기 안 작품은 그대로다(따로 지우지 않는다).
export const deleteAccount = (cloud: Cloud) => cloud.call<{ deleted: { backupSets: number; submissions: number } }>('deleteMyAccount', { confirm: 'DELETE' });
