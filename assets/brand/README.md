# assets/brand — 앱 아이콘·적응형 아이콘·스플래시 (최종 이미지 자리)

규격·설정 연결·검증의 원본은 `../asset-contract.json`, 교체 절차는 `docs/ASSET_INVENTORY.md`.
여기에 아래 이름으로 넣으면 `app.config.js` 가 자동으로 연결한다(설정 파일 수정 불필요).

| 파일 | 크기 | 투명 |
|---|---|---|
| app-icon.png | 1024×1024 PNG | 알파 채널 없음(불투명) |
| adaptive-foreground.png | 1024×1024 PNG | 배경 투명, 중요한 모양은 가운데 약 66% 원 안 |
| adaptive-background.png | 1024×1024 PNG | 불투명 |
| adaptive-monochrome.png | 1024×1024 PNG | 배경 투명, 한 가지 색 실루엣 |
| splash-icon.png | 1024×1024 PNG | 배경 투명 |
| brand.json (선택) | `{ "adaptiveBackgroundColor", "splashBackgroundColor", "splashImageWidth" }` | — |

넣은 뒤: `npm run assets:check` → `npx expo install expo-splash-screen`(최초 1회) → `npx expo prebuild --platform android --clean` → 빌드.
