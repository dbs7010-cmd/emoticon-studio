// 보상형 광고(2026-10-27, 대표: "파일 묶음 만들기는 광고 보고 오기 · PRO 는 광고 없음").
// - 무료 사용자가 파일 묶음(카카오·LINE)을 만들 때만 한 번 본다. 그리기·움직이기·공모전·강좌에는 광고가 없다.
// - 광고를 불러오지 못하면(네트워크·재고·동의 거부·SDK 오류) 막지 않고 그대로 만든다 — 광고 때문에 내 작품을 못 꺼내면 안 된다.
// - 끝까지 보지 않고 닫으면 이번에는 만들지 않는다(다시 누르면 다시 볼 수 있다).
// - 광고 단위는 빌드 값(extra.ads.rewarded). 없으면 광고를 쓰지 않는다. 검수 빌드는 Google 시험 광고만.
// - 동의: 처음 광고 전에 Google UMP 동의 창(필요한 지역에서만 뜬다). 모든 광고는 PG 등급까지(미성년 참가자가 있는 앱).
import { Platform } from 'react-native';
import mobileAds, { AdEventType, AdsConsent, MaxAdContentRating, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

export type AdOutcome = 'rewarded' | 'closed' | 'unavailable';
type Extra = { ads?: { rewarded?: string }; internalReview?: boolean } | undefined;

// 이 빌드에서 쓸 보상형 광고 단위. 없으면 null(광고 없음). iOS 는 AdMob iOS 앱을 만들기 전까지 쓰지 않는다.
export function rewardedUnit(extra: Extra, os: string = Platform.OS): string | null {
  if (os !== 'android') return null;
  if (extra?.internalReview) return TestIds.REWARDED;
  const unit = extra?.ads?.rewarded;
  return typeof unit === 'string' && /^ca-app-pub-\d+\/\d+$/.test(unit) ? unit : null;
}

let ready: Promise<boolean> | null = null;
function prepare(): Promise<boolean> {
  ready ??= (async () => {
    try {
      const consent = await AdsConsent.gatherConsent();
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG });
      await mobileAds().initialize();
      return consent.canRequestAds !== false;
    } catch { ready = null; return false; }
  })();
  return ready;
}

// 광고 한 번. 불러오기 timeoutMs 안에 안 되면 unavailable.
export async function showRewarded(unit: string, timeoutMs = 8000): Promise<AdOutcome> {
  if (!await prepare()) return 'unavailable';
  return new Promise<AdOutcome>(resolve => {
    let earned = false, settled = false;
    const ad = RewardedAd.createForAdRequest(unit);
    const subs: (() => void)[] = [];
    const done = (o: AdOutcome) => { if (settled) return; settled = true; clearTimeout(timer); subs.forEach(u => u()); resolve(o); };
    const timer = setTimeout(() => done('unavailable'), timeoutMs);
    subs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, () => { clearTimeout(timer); ad.show().catch(() => done('unavailable')); }));
    subs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
    subs.push(ad.addAdEventListener(AdEventType.CLOSED, () => done(earned ? 'rewarded' : 'closed')));
    subs.push(ad.addAdEventListener(AdEventType.ERROR, () => done(earned ? 'rewarded' : 'unavailable')));
    try { ad.load(); } catch { done('unavailable'); }
  });
}
