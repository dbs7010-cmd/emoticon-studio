// emoti 이용 가이드북(2026-10-13 사용자 요청: 홈 공지 슬라이드 ① — 앱 사용부터 이모티콘 승인 팁까지).
// - 규격·그리기 규칙은 kakao-spec.ts(카카오 공식 가이드 원문 확인 2026-09-12)에서 그대로 가져온다 — 여기서 새로 지어내지 않는다.
// - '승인 팁'은 emoti 가 권하는 제작 습관이다. 카카오의 심사 기준이라고 말하지 않는다(심사 기준 원문은 공개 가이드에 없다).
import { GUIDE_RULES, KAKAO_ANIMATED_SPEC, KAKAO_STATIC_SPEC, REQUIRED_EXTRAS, SPEC_SOURCE, STAGES, WEBP_TOOL_RULE } from './kakao-spec';

export type GuideChapter = { id: string; title: string; summary: string; items: { title: string; body: string }[]; source?: string };

const kb = (n: number) => Math.round(n / 1024) + 'KB';

export const GUIDEBOOK: GuideChapter[] = [
  {
    id: 'start', title: '처음 시작하기', summary: '세트 만들기부터 한 칸 완성까지',
    items: [
      { title: '세트 만들기', body: '홈의 노란 + 를 누르고 이름을 정하면 빈 세트가 생겨요. 한 세트는 카카오 제안 한 번에 내는 묶음이에요.' },
      { title: '캐릭터 기준 정하기', body: '세트 메뉴(···) › 캐릭터 기준에서 대표 그림을 정해 두면, 칸마다 옆에 띄워 같은 모습으로 그리기 쉬워요.' },
      { title: '칸 그리기', body: '보드에서 칸을 누르면 그리기 화면이 열려요. 펜·지우개·채우기·선택과 레이어, 참고 사진, 문구를 쓸 수 있어요. 다 그리면 저장을 눌러요.' },
      { title: '이전 칸에서 이어 그리기', body: '새 칸을 열면 "이전 칸 그림으로 시작"이 보여요. 같은 캐릭터를 처음부터 다시 그리지 않아도 돼요.' },
    ],
  },
  {
    id: 'motion', title: '움직이게 하기', summary: '효과 고르기 · 세기 · 부분만 움직이기',
    items: [
      { title: '효과 고르기', body: '그리기 화면 위의 "움직이기"를 누르고 효과(뿅·쓱·흔들기…)를 고르면 바로 움직여요. 위의 막대로 세기와 속도를 맞춰요.' },
      { title: '부분만 움직이기', body: '팔·귀처럼 따로 움직일 곳을 레이어로 나눠 그린 뒤, 움직이기 › 부분만 움직이기에서 그 레이어를 골라 회전·이동·크기를 줘요.' },
      { title: '여러 칸에 한 번에', body: '움직이는 칸이 생기면 세트 메뉴(···) › 움직임 한 번에 적용으로 같은 움직임을 다른 칸에도 줄 수 있어요(PRO).' },
      { title: '마지막 모습', body: GUIDE_RULES[1] },
    ],
  },
  {
    id: 'finish', title: '마무리와 내보내기', summary: '아이콘 · 손볼 곳 · 파일 묶음',
    items: [
      { title: '아이콘 만들기', body: '홈의 "제안까지"에서 아이콘을 누르거나 부가 이미지 화면에서 칸 하나를 골라 아이콘으로 만들어요.' },
      { title: '채팅에서 써 보기', body: '보드의 "채팅에서 써 보기"에서 내 이모티콘을 대화 속에 넣어 봐요. 밝은 바탕·어두운 바탕을 바꿔 가며 잘 보이는지 확인해요.' },
      { title: '손볼 곳 확인', body: '내보내기 화면이 제출 전에 손볼 곳을 확인해 알려 줘요.' },
      { title: '파일 묶음 만들기', body: '내보내기 › 파일 묶음 만들기로 ZIP 을 만들어 원하는 앱으로 보내요. 움직이는 칸은 프레임 PNG 로 함께 들어가요.' },
      { title: '움직이는 이모티콘 제출 파일', body: WEBP_TOOL_RULE + ' 파일 묶음 안의 360×360 프레임 PNG 를 그 도구에 순서대로 넣으면 돼요.' },
    ],
  },
  {
    id: 'spec', title: '카카오 제안 규격', summary: '카카오 이모티콘 스튜디오 공식 가이드 기준',
    source: SPEC_SOURCE.guide,
    items: [
      { title: KAKAO_STATIC_SPEC.profileLabel, body: `${STAGES.still.proposal.text}. PNG · ${KAKAO_STATIC_SPEC.width}×${KAKAO_STATIC_SPEC.height} · ${kb(KAKAO_STATIC_SPEC.maxBytes)} 이하 · 투명 배경.` },
      { title: KAKAO_ANIMATED_SPEC.profileLabel, body: `${STAGES.animated.proposal.text}. ${KAKAO_ANIMATED_SPEC.width}×${KAKAO_ANIMATED_SPEC.height} · ${kb(KAKAO_ANIMATED_SPEC.maxBytes)} 이하 · ${KAKAO_ANIMATED_SPEC.maxFrames}프레임 이하 · ${KAKAO_ANIMATED_SPEC.loops}회 반복 · 투명 배경.` },
      ...REQUIRED_EXTRAS.map(x => ({ title: `${x.label}(${x.stage})`, body: x.spec })),
      { title: '글자', body: GUIDE_RULES[0] },
    ],
  },
  {
    id: 'tips', title: '승인에 가까워지는 팁', summary: 'emoti 가 권하는 제작 습관',
    items: [
      { title: '쓸 말부터 정하기', body: '인사·고마워·미안해·축하해·응/아니·웃음·속상함처럼 대화에서 자주 쓰는 말을 먼저 채워요. "누가 언제 쓸까"를 한 줄로 적어 두면 세트가 흩어지지 않아요.' },
      { title: '한 캐릭터, 같은 모습', body: '칸마다 얼굴 비율·색·선 굵기가 달라지지 않게 캐릭터 기준을 띄워 두고 그려요.' },
      { title: '작게 봐도 읽히게', body: '대화창에서는 생각보다 작게 보여요. 표정은 크게, 선은 또렷하게, 글자는 짧게. 채팅에서 써 보기로 실제 크기를 확인해요.' },
      { title: '겹치지 않는 표현', body: '같은 표정·같은 몸짓이 반복되면 세트가 단조로워 보여요. 내보내기의 손볼 곳 확인도 참고해요.' },
      { title: '남의 것은 그리지 않기', body: '다른 캐릭터·브랜드 로고·유명인 얼굴·남의 글귀는 넣지 않아요. 내가 만든 캐릭터와 말로만 채워요.' },
      { title: '최종 기준은 공식 가이드', body: '이 팁은 emoti 의 권장이에요. 제출 전에는 카카오 이모티콘 스튜디오 공식 가이드를 꼭 한 번 더 확인해요.' },
    ],
  },
  {
    id: 'account', title: '계정과 백업', summary: '작품은 내 기기에 · PRO 는 클라우드에도',
    items: [
      { title: '작품이 있는 곳', body: '그린 작품은 이 휴대폰 안에 저장돼요. 로그인은 회원 구분과 클라우드 백업·공모전 접수에만 써요.' },
      { title: '전체 백업 파일', body: '내 정보 › 전체 백업 만들기로 모든 세트를 파일 하나로 만들어 앱 밖에 보관할 수 있어요(무료).' },
      { title: 'PRO 클라우드 백업', body: 'PRO 는 세트를 서버에 올려 두고, 휴대폰을 바꾸거나 다시 설치했을 때 되살릴 수 있어요.' },
      { title: '탈퇴', body: '내 정보 › 탈퇴로 서버의 회원 정보·백업·접수를 지워요. 휴대폰 안 작품은 그대로예요.' },
    ],
  },
];
