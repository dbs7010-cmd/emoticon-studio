// 계정(2026-10-07). 카카오·네이버는 각 회사 SDK 로 받은 액세스 토큰을 서버(exchangeKakao/exchangeNaver)에 보내 확인받고
// 서버가 준 토큰으로 로그인한다. 구글은 Firebase 인증. **각 회사 로그인 SDK 는 운영자 앱 키가 생긴 뒤에 넣는다** — 지금 빌드에는 없어서
// providerReady() 가 false 이고 화면은 '준비 중'으로만 보인다.
import type { Cloud } from './firebase';

export type Provider = 'kakao' | 'naver' | 'google';
export type ServerUser = { pro: { active: boolean; source: string; verified: boolean }; backupBytes: number };
// 이 빌드에 들어 있는 로그인 SDK(앱 설정 extra.login 이 켠 것만). 키·SDK 가 없으면 버튼을 누를 수 없게 둔다.
export function providerReady(extra: unknown, provider: Provider): boolean {
  const login = extra && typeof extra === 'object' ? (extra as { login?: Record<string, unknown> }).login : undefined;
  return !!login && login[provider] === true;
}
// 회사 SDK 가 준 액세스 토큰 → 서버 확인 → 로그인. (구글은 Firebase 인증 쪽에서 처리)
export async function signInWithProviderToken(cloud: Cloud, provider: 'kakao' | 'naver', accessToken: string): Promise<string> {
  const { token } = await cloud.call<{ token: string }>(provider === 'kakao' ? 'exchangeKakao' : 'exchangeNaver', { accessToken });
  return cloud.signInWithToken(token);
}
export const register = (cloud: Cloud) => cloud.call<ServerUser>('registerUser', {});
export const signOutAll = (cloud: Cloud) => cloud.signOut();
// 탈퇴: 서버의 개인 백업·회원 정보·공모전 접수·로그인 계정을 지운다. 기기 안 작품은 그대로다(따로 지우지 않는다).
export const deleteAccount = (cloud: Cloud) => cloud.call<{ deleted: { backupSets: number; submissions: number } }>('deleteMyAccount', { confirm: 'DELETE' });
