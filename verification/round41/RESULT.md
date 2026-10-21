# 41차 — PRE-ASSET LOCK & PRODUCTION SPEC (2026-09-15)

> **41.5차 정정**: 아래 D 의 "원본 캐릭터 3종(종이·잉크·지우개) · 메인 후보 종이" 서술은 철회한다. 캐릭터 원본은 실제 에셋 제작 단계에서 사용자가 제공·선택한 원본을 기준으로 별도 진행한다. 24/32 설계는 `docs/design/SET_TYPE_DESIGN.md`.

판정: **PASS (기준점 LOCK · 규격 정리 · 발주서 완성)**. 새 기능·UI 재설계·엔진 변경·에셋 생성 없음.
기준: 39차 DEVICE QA PASS · 40차 VISUAL SHELL PASS(P0 0 · P1 0).

## A. Git checkpoint
- 커밋 1 `5a5b635` **Round40 visual shell pass** — `git commit` exit 0, 295 파일(39·40차 소스·테스트·문서·검증 텍스트 증거). 커밋 뒤 작업 트리 0.
- 커밋 전 검사:
  - 비밀값 검색(비밀번호·키·토큰·BrowserStack 자격·URL 내장 자격·PRIVATE KEY): 커밋 대상에 **0건**(XML 덤프의 `password="false"` 속성만 걸렸고 그 파일들은 커밋 제외)
  - 스테이지 목록 가드: `node_modules/` · `.apk/.aab/.hbc/.jks/.keystore/.p12/.pem/.key/.xml` · `local.properties` · `upload-signing.properties` · `.env` 가 하나라도 있으면 중단 → 0건
  - `release/` 는 예시 properties(값 `<set-locally>`)와 공개 인증서 지문 json 뿐
- `.gitignore` 추가: `local.properties`, `*.apk`, `*.aab`, `*.hbc`, `.gradle-home/`, `verification/**` 중 `.md/.log/.json/.txt` 만 허용, `verification/**/node_modules/`.
  - 검증 스크린샷·UI 덤프·APK 20개(최대 178MB)는 **디스크에 그대로 두고** 저장소에 넣지 않았다(삭제·reset·clean 없음).
- 커밋 2(41차 변경)는 이 문서 작성 뒤 — 결과는 PROJECT_STATE 41차 절과 최종 보고에 기록.

## B. /24 ↔ 32 조사 — **PRODUCT / DATA-MODEL BLOCKER** (수정하지 않음)
### 사실
| 값 | 출처 | 근거 등급 |
|---|---|---|
| 멈춰있는 세트 32개 | `src/constants/kakao-spec.ts` `KAKAO_STATIC_SPEC.count = 32`, `STAGES.still.*.emoticons = 32` | 공식 가이드 원문 읽음(2026-09-12), `policyStatus: 'VERIFIED'` |
| 움직이는 세트 24개 | 같은 파일 `KAKAO_ANIMATED_SPEC.count = 24`, `STAGES.animated.*.emoticons = 24`(제안: 24개 중 WebP 3개 필수) | 같은 날 원문, `VERIFIED` |

**두 숫자는 모두 맞다.** 외부 규격이 모호해서 생긴 불일치가 아니다(EXTERNAL SPEC BLOCKER 아님). 옛 문서의 "32칸 UNVERIFIED" 기록(PROJECT_STATE 1978·2065행)은 09-12 VERIFIED 로 대체된 과거 기록이다.

### 원인
1. **세트에 "종류" 필드가 없다.** `setIsAnimated(project) = project.slots.some(isAnimated)`(`src/project.ts:60`) — 칸 하나에 움직임을 넣는 순간 세트 전체가 "움직이는 이모티콘"으로 판정된다.
2. **칸 수는 종류와 무관하게 32로 고정된 데이터 모델이다.**
   - 생성: `createProject` → `Array.from({ length: SPEC.count })`(`src/project.ts:8`, SPEC = STATIC 32)
   - 저장 검증: `p.slots.length !== SPEC.count` 이면 "프로젝트 저장 데이터가 손상되었습니다"(`src/project.ts:97`) — 32칸이 아닌 세트는 **열리지 않는다**
3. **화면은 두 원천을 섞어 쓴다.**
   - 32 원천(`project.slots`, `SPEC.count`): 보드 격자·`/ 32칸`·진행 막대(`App.tsx` 보드 요약), 내보내기 결과 격자, "남은 칸 N칸"(`setChecks`, `App.tsx:341`), 파일 묶음 `missing = SPEC.count - count`(`src/services/export.ts:189`), `nextUnfinished`, 세트 관리 `N / 32 완성`
   - 24 원천(`profile = moving ? ANIMATED : STATIC`): 내보내기 요약 `finished / profile.count 완성`·완성 여부·% (`App.tsx` 요약 표면), 사실 목록 `완성한 칸`, 제출 준비 `이모티콘 24개 · N개 더`(`STAGES`)
4. 결과: 움직이는 세트에서 요약 "1 / 24" 옆 격자 32칸, 30칸 완성 시 "30 / 24 완성 · 125%"도 가능, "남은 칸 31칸" 경고는 32 기준, 파일 묶음은 32칸 중 완성분을 전부 넣는다.

### 왜 이번에 고치지 않았나
- 한쪽 숫자로 맞추는 것은 **제품 결정**이다: 움직이는 세트를 24칸 모델로 만들지(기존 32칸 저장본 8칸 처리·저장 검증 변경·마이그레이션), 32칸 중 24칸을 고르게 할지(어느 칸이 제출분인지 UI), 세트 종류를 사용자가 먼저 고르게 할지(새 흐름 — 41차 금지).
- 저장 검증(`slots.length !== 32`)과 연결돼 있어 "최소 수정"이 저장 호환성(LOCKED) 위험을 만든다.

### 한 원천으로 모을 때 손댈 곳(다음 결정 뒤)
`src/types.ts`(Project 에 set kind) · `src/project.ts` 8·60·97(생성·판정·저장 검증 + 마이그레이션) · `App.tsx`(보드 요약·내보내기 요약·setChecks·세트 관리 문구) · `src/services/export.ts:189` · `STAGES`/`KAKAO_*_SPEC` 는 그대로 원천 · 테스트: `spec-test`·`export-test`·`recovery-test`(32칸 전제) · `ux-test`(칸 수 32 고정 단언).

## C. 앱 표시 이름
| 자리 | 전 | 후 |
|---|---|---|
| `app.json expo.name`(Android 런처 라벨·iOS 표시 이름의 원본) | 나의 이모티콘 작업실 | **임티제작소** |
| `app.config.js` | app.json 을 그대로 씀(이름 덮어쓰기 없음) | 변경 없음 |
| 홈 머리 | 임티제작소(40차) | 그대로 |
| `docs/PLAY_STORE_LISTING_KO.md` 제목 | 나의 이모티콘 작업실 | 임티제작소(이전 이름 기록) |
| `docs/PRIVACY_POLICY_KO.md` · `docs/legal.md` | 나의 이모티콘 작업실 | 임티제작소 |
- 기술 제약 없음: 스토어 등록 전(`release/version-history.json released: []`), slug `emoticon-studio`·패키지 `com.emoticonstudio.app` 은 **바꾸지 않았다**(설치·데이터 연속성).
- 창작 표면 눈썹 문구 "나만의 이모티콘 작업실"은 앱 이름이 아니라 태그라인이라 그대로.
- **런처 라벨은 다음 `expo prebuild` + 빌드부터** 바뀐다. 기기에 있는 40차 QA APK 는 옛 이름. 화면 동작 변경이 아니라 실기기 재검증은 하지 않았다(다음 빌드 때 확인 항목).
- 같이 고친 원천 불일치: 스토어 초안의 "움직이는 규격 UNVERIFIED" 문장 → kakao-spec VERIFIED 사실로.
- 회귀: `visual-system-test` — app.json 이름 = 임티제작소, app.config.js 가 이름 유지, 홈 브랜드 글자 = 앱 이름, 스토어 초안 제목 = 앱 이름.

## D. 에셋 명세
- `docs/design/ASSET_PRODUCTION_SPEC.md` — 21개(A 브랜드 3 · B 홈 3 · C 제작 3 · D 레퍼런스 2 · E 완성/PRO 2 · F 출시/스토어 8), 에셋별 19개 항목 표, 40차 실제 좌표 기반 구도(홈 히어로 x 226~338 · y 16~128 vs 행동 줄 y 119~167 등), PHASE 1~7 순서 LOCK, 에셋 라운드 코드 작업 목록.
- `docs/design/ASSET_GENERATION_HANDOFF.md` — 제품·타깃·브랜드 인상·40차 색 토큰·금지 스타일·원본 캐릭터 3종 관찰·PHASE 1 9안 발주(3종 × 원형보존/앱정제/강한 브랜드)·선/색/질감·투명 규칙·구도 요약·CANON 규칙·전달 형식·체크리스트·프롬프트 뼈대.
- 자리 규격 보정(코드·문서): `src/design/asset-slots.ts`·`docs/design/ASSET_SLOTS.md` 의 homeHero(오른쪽 아래 104/124 → **오른쪽 위 96/112**), homeEmpty(160×120 → **120×90**), motionExample(40 → **48 칸 안 41**), proFeature(16:9 한 장 → **1:1 두 장 86**, 표면·화살표·라벨은 앱) — 40차 실제 코드와 다르게 적혀 있던 것.

## E. 테스트
- `npm test` exit 0 (`tests.log`): typecheck + 19 스위트 + 러너 라벨 53.
- 실기기: 이번 라운드 화면 동작 변경 없음 → 재실행하지 않음(40차 스모크 20/20 유지).

## F. 남은 blocker
1. **SET-KIND / 24·32 데이터 모델 결정**(B) — 제품 결정 필요.
2. **CANON LOCK**(PHASE 1 사용자 선택) — 캐릭터 에셋 전부의 선행.
3. 출시 에셋 P0(아이콘·적응형·스플래시·Play 그래픽) 여전히 템플릿 — 36~37차 BLOCKED 와 동일.
4. 표현 가이드 그림 자리·기본 레퍼런스 "표정" 카테고리 방식 — 기능 켜기 전 결정.
5. 작은 폰(360dp)에서 홈 행동 줄(새 이모티콘 만들기 + 내 그림으로 시작) 가로 여유 미측정 — 40차 매트릭스는 홈 히어로를 재지 않았다(다음 실기기/매트릭스 확인 항목, 재설계 아님).
