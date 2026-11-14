# emoti 서버(Firebase) — 로컬 에뮬레이터 단계

로그인 교환(카카오·네이버 → Firebase 커스텀 토큰, 구글은 Firebase 인증), PRO 개인 클라우드 백업, 자체 공모전 세트 접수, 관리자 기능, 탈퇴.
**운영 배포 전**이다. 운영자 Firebase 프로젝트·카카오·네이버 앱 키가 생기면 배포한다(`docs/closed-test/16_vc4_서버_설계_비용.md` §5).

## 검사(계정 없이)
```
cd server/firebase
npm install && (cd functions && npm install)
set JAVA_HOME=<JDK 17>   # 에뮬레이터용. firebase-tools 13 은 JDK 17 로 돈다(15 는 21 필요)
set FUNCTIONS_DISCOVERY_TIMEOUT=120
npm test
```
`test/run.cjs` 가 가짜 카카오·네이버 서버(127.0.0.1:7777)를 띄우고 앱과 같은 Firebase JS SDK 로 15묶음을 검사한다.
가짜 서버는 **확인 규칙**(앱 ID 대조·회원 식별)을 검사할 뿐 실제 회사 연동을 검사하지 않는다.

## 버전 메모
- firebase-functions 6.6.0 + firebase-admin 13.10.0: firebase-tools 13 에뮬레이터가 functions v7 에서 없어진 `functions.config()` 를 불러 v7 과 함께 돌지 않는다. JDK 21 을 쓰면 tools 15 + functions 7 로 올릴 수 있다.

## 비밀 값
- 앱·저장소에 없다. 운영 값은 `functions/.env.<운영 프로젝트 ID>`(커밋 금지) 또는 Secret Manager: `KAKAO_APP_ID`, (네이버 확인 방식 확정 후) 네이버 값, `PRO_TRIAL_ALL`(비공개 테스트 동안만 true), `BACKUP_QUOTA_BYTES`.
- `functions/.env.demo-emoti` 는 에뮬레이터 전용 시험값이다(비밀 아님).
- 관리자 권한: 운영자 구글 계정 uid 에 `admin: true` 사용자 claim 을 관리 SDK 로 1회 부여(`scripts/set-admin.cjs`).
