// 보상형 광고(2026-10-27) — src/services/ads.ts. 광고 SDK 는 이 파일이 흉내 낸다(실제 광고는 기기에서).
// 끝까지 봄 → rewarded · 보지 않고 닫음 → closed · 불러오기 실패·시간 초과·동의 불가 → unavailable(막지 않음).
// 광고 단위: Android 출시 = 설정 값, 검수 빌드 = Google 시험 광고, iOS·형식 틀림·없음 = 광고 없음.
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');

let script = 'reward', consentOk = true, consentThrows = false, created = 0;
const fake = {
  __esModule: true,
  default: () => ({ initialize: async () => [], setRequestConfiguration: async () => {} }),
  AdsConsent: { gatherConsent: async () => { if (consentThrows) throw new Error('no form(s) configured'); return { canRequestAds: consentOk }; }, getConsentInfo: async () => ({ canRequestAds: consentOk }) },
  MaxAdContentRating: { PG: 'PG' },
  TestIds: { REWARDED: 'ca-app-pub-3940256099942544/5224354917' },
  AdEventType: { CLOSED: 'closed', ERROR: 'error' },
  RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' },
  RewardedAd: { createForAdRequest: () => {
    created++;
    const on = {};
    const fire = (t, v) => on[t] && on[t](v);
    return {
      addAdEventListener: (t, f) => { on[t] = f; return () => { delete on[t]; }; },
      load: () => setTimeout(() => {
        if (script === 'fail') return fire('error', new Error('no fill'));
        if (script === 'never') return;
        fire('loaded');
      }, 5),
      show: async () => setTimeout(() => {
        if (script === 'reward') { fire('earned', { amount: 1 }); fire('closed'); }
        if (script === 'skip') fire('closed');
      }, 5),
    };
  } },
};
const load = loader({ 'react-native-google-mobile-ads': fake, 'react-native': { Platform: { OS: 'android' } } });
const ads = load('src/services/ads.ts');

(async () => {
  const unit = 'ca-app-pub-7942033735159248/7188345901';
  assert.equal(ads.rewardedUnit({ ads: { rewarded: unit } }, 'android'), unit, '출시: 설정한 광고 단위');
  assert.equal(ads.rewardedUnit({ ads: { rewarded: unit }, internalReview: true }, 'android'), fake.TestIds.REWARDED, '검수 빌드: 시험 광고만');
  assert.equal(ads.rewardedUnit({ ads: { rewarded: unit } }, 'ios'), null, 'iOS: AdMob iOS 앱 전까지 광고 없음');
  assert.equal(ads.rewardedUnit({}, 'android'), null, '단위 없음 → 광고 없음');
  assert.equal(ads.rewardedUnit({ ads: { rewarded: 'ca-app-pub-1~2' } }, 'android'), null, '앱 ID 를 단위로 잘못 넣으면 광고 없음');

  // 동의 메시지가 AdMob 에 없어 동의 확인이 실패해도(에뮬레이터 실측) 광고는 부른다 — 첫 호출이 준비(prepare)를 정한다.
  consentThrows = true;
  script = 'reward'; assert.equal(await ads.showRewarded(unit, 500), 'rewarded', '끝까지 봄(동의 확인 실패여도 광고)');
  consentThrows = false;
  script = 'skip'; assert.equal(await ads.showRewarded(unit, 500), 'closed', '보지 않고 닫음');
  script = 'fail'; assert.equal(await ads.showRewarded(unit, 500), 'unavailable', '불러오기 실패 → 막지 않음');
  script = 'never'; assert.equal(await ads.showRewarded(unit, 60), 'unavailable', '시간 초과 → 막지 않음');
  assert.equal(created, 4, '누를 때마다 새 광고 하나');
  console.log('PASS: ads — 끝까지 봄=만듦 · 닫음=이번엔 안 만듦 · 실패/시간 초과=막지 않음 · 광고 단위(출시/검수 시험 광고/iOS·형식 오류=없음). SDK mocked.');
})().catch(e => { console.error(e); process.exit(1); });
