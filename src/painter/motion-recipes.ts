import { t } from '../i18n/index';
// 움직이기 출발점 자료(화면 없음 — 검사에서도 그대로 읽는다).
// 부분 움직임 출발점(2026-10-15): 구조가 다른 흔한 경우 셋. 고르면 효과·세기·속도가 한 번에 맞춰지고, 아래 막대로 그대로 고친다.
export const PART_STARTERS = [
  { id: 'wave', label: t("release.x127"), hint: t("release.x128"), effect: 'rotate' as const, amount: 25, speed: .65, angle: 0 },
  { id: 'ear', label: t("release.x129"), hint: t("release.x130"), effect: 'rotate' as const, amount: 12, speed: .8, angle: 0 },
  { id: 'bob', label: t("release.x131"), hint: t("release.x132"), effect: 'move' as const, amount: .03, speed: .6, angle: 270 },
];
// 바로 쓰는 동작 조합(2026-10-15): 단계 엔진 그대로 — 고른 뒤 단계 화면에서 효과·길이·반복을 고친다.
// 서로 다른 쓰임 셋만 둔다(비슷한 조합으로 개수를 늘리지 않는다). 셋 다 한 바퀴 3초 안, 단계 경계 끊김 검사 대상(motion-step-test).
export const MOTION_COMBOS = [
  { id: 'hello', label: t("ui.enterHello"), hint: t("release.x134"), steps: [{ preset: 'slide' as const, duration: .6, repeat: 1 }, { preset: 'bow' as const, duration: .9, repeat: 1 }] },
  { id: 'shock', label: t("release.x135"), hint: t("release.x136"), steps: [{ preset: 'punch' as const, duration: .5, repeat: 1 }, { preset: 'shiver' as const, duration: .5, repeat: 2 }] },
  { id: 'joy', label: t("release.x137"), hint: t("release.x138"), steps: [{ preset: 'hop' as const, duration: .7, repeat: 1 }, { preset: 'dance' as const, duration: .5, repeat: 2 }] },
];

