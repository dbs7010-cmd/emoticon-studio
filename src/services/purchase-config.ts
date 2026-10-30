import { t } from '../i18n/index';
import Constants from 'expo-constants';

// Only this explicit build value selects the free closed test. Missing settings keep release behavior.
export const purchasesClosed = (): boolean => Constants.expoConfig?.extra?.purchases === 'closed';
// 비공개 테스트 PRO 체험(2026-10-04 결정). **빌드 값**이고 저장되지 않는다 — 구매 기록·영수증·이용권(entitlement)을
// 만들지 않으므로 정식 빌드로 업데이트하면 저절로 사라지고, 그때는 실제 구매 권한만 본다.
// 구매가 닫힌 빌드에서만 효력이 있다(app.config.js 와 release-check 가 다른 조합을 막는다). 모든 사용자에게 같다.
export const proTrial = (): boolean => purchasesClosed() && Constants.expoConfig?.extra?.proTrial === true;
export const PRO_TRIAL_NOTE = t("release.p45");
export const PURCHASES_CLOSED_NOTE = t("release.p46");
