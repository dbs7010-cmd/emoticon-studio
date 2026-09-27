import Constants from 'expo-constants';

// Only this explicit build value selects the free closed test. Missing settings keep release behavior.
export const purchasesClosed = (): boolean => Constants.expoConfig?.extra?.purchases === 'closed';
export const PURCHASES_CLOSED_NOTE = '이번 테스트 버전에서는 PRO 구매가 아직 열리지 않았어요. 무료 기능을 모두 쓸 수 있어요.';
