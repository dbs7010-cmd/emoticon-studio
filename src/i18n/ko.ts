// 한국어(기본 · 대체 언어). 키를 더하면 ja.ts · zh-Hant.ts 에도 더한다(없으면 한국어가 보인다).
export const ko = {
  // 아래 탭
  'tab.home': '홈', 'tab.class': '강좌', 'tab.contest': '공모전', 'tab.my': '내 정보',
  // 첫 실행 · 로그인
  'start.title1': '그리고, 톡 누르면\n', 'start.title2': '움직이는 이모티콘',
  'start.body': '내 그림에 움직임을 고르기만 하면 돼요.',
  'start.kakao': '카카오로 시작하기', 'start.naver': '네이버로 시작하기', 'start.google': 'Google로 시작하기', 'start.soon': ' · 준비 중',
  'start.go': '시작하기', 'start.terms': '시작하면 이용약관과 개인정보처리방침에 동의하게 돼요',
  // 작가명
  'artist.title': '작가명을 입력해주세요', 'artist.rule': '한글·영문·숫자 2~12자 · 정한 뒤에는 바꿀 수 없어요',
  'artist.field': '작가명', 'artist.example': '예: 몽이작가', 'artist.checking': '확인하는 중…',
  'artist.ok': '쓸 수 있는 작가명이에요', 'artist.no': '쓸 수 없는 작가명이에요', 'artist.offline': '확인하지 못했어요. 인터넷 연결을 확인해 주세요.',
  // 홈
  'home.subtitle': '나의 작은 작업실', 'home.notice': '처음이라면? 가이드북에서 시작해요',
  'home.mySets': '내 세트 ', 'home.recentAll': '최근 작업순 · 전체 {n}',
  'home.continue': '이어서 그리기', 'home.startDrawing': '그리기 시작',
  'home.kindMoving': '움직이는', 'home.kindStill': '멈춰있는', 'home.cuts': '{kind} · {done} / {total}칸',
  'home.newSet': '새 세트 만들기', 'home.newSetSub': '빈 캔버스에서 시작',
  'home.ownTitle': '이미 그린 그림이 있나요?', 'home.ownSub': '내 그림을 가져와 이어서 만들어요',
  // 내보내기
  'export.make': '파일 묶음 만들기', 'export.line': 'LINE 움직이는 스티커 파일 만들기',
  'export.adHint': '무료는 만들기 전에 광고 한 번 · PRO 는 광고 없이 바로',
  'export.adClosed': '광고를 끝까지 보면 파일 묶음을 만들어요. PRO 는 광고 없이 바로 만들어요.',
  'export.adLoading': '광고 불러오는 중…',
  'line.needMoving': 'LINE 움직이는 스티커는 움직이는 칸이 8개 이상 필요해요(지금 {n}개).',
  'line.making': 'LINE 파일 만드는 중…', 'line.progress': 'LINE 파일 만드는 중 · {i}/{n}칸', 'line.mainTab': 'LINE 메인·탭 그림 만드는 중…',
  'line.done': 'LINE 움직이는 스티커 {n}개 · 메인 · 탭 파일을 묶었어요.', 'line.upload': 'LINE Creators Market 에 직접 올려 주세요(심사는 LINE 이 해요).',
} as const;
export type Key = keyof typeof ko;
