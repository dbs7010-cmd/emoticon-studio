# 대표님 실행 — 새 iOS 심사용 빌드

Codex가 소스 검사·Android vc25 산출물 검사 완료를 알린 뒤 진행합니다. iOS는 기존 EAS production 프로필·프로젝트·서명을 유지합니다. API 키 내용은 복사하거나 공유하지 않습니다.

## 1. 같은 PowerShell 창에서 빌드

```powershell
Set-Location C:/Dev/emoticon-studio
Remove-Item Env:EMOTICON_INTERNAL_REVIEW,Env:EMOTICON_SCREENSHOT_BUILD -ErrorAction SilentlyContinue
$iosSubmitConfig=(Get-Content eas.json -Raw | ConvertFrom-Json).submit.production.ios
$env:EXPO_ASC_API_KEY_PATH=$iosSubmitConfig.ascApiKeyPath
$env:EXPO_ASC_KEY_ID=$iosSubmitConfig.ascApiKeyId
$env:EXPO_ASC_ISSUER_ID=$iosSubmitConfig.ascApiKeyIssuerId
$env:EXPO_APPLE_TEAM_ID='D73V77X8M6'
$env:EXPO_APPLE_TEAM_TYPE='INDIVIDUAL'
if (-not (Test-Path -LiteralPath $env:EXPO_ASC_API_KEY_PATH)) { throw '기존 Apple API 키 파일 경로를 확인하세요' }
npx eas-cli build -p ios --profile production
```

production은 원격 빌드 번호 자동 증가를 사용합니다. build 5가 예상되지만, 완료 화면에 나온 실제 번호를 기준으로 기록합니다. Apple ID/전화 인증 대신 기존 API 키 경로를 사용합니다. EAS 빌드가 실패하거나 예상과 다른 자격 증명을 요구하면 오류 문구만 전달하고 키 내용은 보내지 않습니다.

## 2. 새 빌드 완료 후 TestFlight로 전송

방금 만든 새 iOS 빌드가 성공했는지 확인한 다음, 같은 창에서 실행합니다.

```powershell
npx eas-cli submit -p ios --latest
```

전송 성공은 App Store 심사 승인이나 공개 출시가 아닙니다. App Store Connect에서 처리 완료와 실제 빌드 번호를 확인합니다. 기존 build 4를 다시 심사용으로 선택하지 않습니다.

## 3. 실기기 확인

- 새 빌드에서 가져온 그림의 두 손가락 크기/회전/이동과 적용.
- 참고 그림 이동·크기 조절의 끊김.
- 문구 패널/키보드 가림, 일본어·번체 긴 글자.
- 저장·내보내기·구매/복원.

## 4. 심사 준비 — 카드 전달 후

App Store Connect → emoti → iOS 앱 버전 1.0에서 새 빌드를 선택합니다. PRO 앱 내 구입을 함께 첨부하고, 전달된 iPhone 카드와 한국어·일본어·번체 등록정보를 넣습니다. iPad 자료는 실제 iPad 기본 언어 자료를 별도로 사용하며 iPhone 사진을 iPad 캡처로 올리지 않습니다. 국가 한국·일본·대만 및 개인정보/심사 연락처를 확인한 뒤 대표님이 심사에 추가합니다.

일본어·번체 iPhone 카드의 원본은 build 4이며 구형 내보내기 버튼·이름 변경 알림을 크롭한 구성입니다. 원본 기록을 build 5로 바꾸지 않습니다. 새 빌드의 해당 화면이 크게 달라졌다면 그 장면을 교체합니다.
