# 출시 진행 현황 — 2026-10-31

## Google Play

- 대표님 확인: vc25는 아직 올리지 않았다. 이전 광고 ID 오류를 vc25에 대한 검사 결과로 연결한 해석은 정정했다.
- 올릴 파일: `dist/releases/vc25-20261031/emoti-1.0.0-vc25-2967628.aab`.
- AAB 로컬 검증 통과, AD_ID 포함. 기존 vc20 보관 파일은 광고 설정과 AD_ID 모두 없음.
- 태블릿 이미지 30장은 `dist/google-play-tablets-20261031`, 노션 22번 첨부 완료.
- 브라우저 제어 도구가 현재 URL을 검증하지 못해 콘솔 조작을 차단했다. 우회하지 않았다.

## iOS

- 대표님이 남은 작업 전체 진행을 요청해 Codex가 production 새 빌드를 실행했다.
- 실제 배정 번호 **7**. 예상 번호 5를 사용하지 않는다.
- EAS build ID: `a0df31e0-57ba-4321-8764-48c82e530121`.
- 소스: `b3a84c8f3f8531b6a79d99f8696d5be1519b5851`.
- 기존 Apple 팀·인증서·프로비저닝 사용, production 서버 환경 3개 확인. 검수 모드 없음.
- 빌드 완료, IPA 직접 검사 통과. 검수 모드 false, 결제 release, 영수증 서버 있음, 로그인 3개 포함.
- IPA의 강좌 영상 63개가 저장소와 바이트 해시 동일, 누락 0.
- 정확한 build ID로 App Store Connect 업로드 성공. Submission ID `54fb6b00-6233-4fb4-a84a-49e9c2766be3`.
- Apple 처리 중. TestFlight 설치 가능·실기기 검사·심사 제출은 아직 확인하지 않았다.
- 기존 build 4 전송은 FINISHED. 별도 App Store 상태 조회는 API 키로 앱을 찾지 못해 실패했다.
- 최종 심사 제출 전 새 빌드의 실제 아이폰 확인과 App Store Connect 항목 확인이 남는다.

## 공개 링크·이미지

- 개인정보처리방침 HTTP 200, AdMob 광고 안내 포함 확인.
- `https://emoti-18d80.web.app/app-ads.txt` HTTP 200, 공개 판매자 ID 일치.
- App Store 일본어·번체 카드 및 홍보물 ZIP은 노션 21·22번 첨부 완료.
