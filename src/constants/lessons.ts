// emoti 공식 강좌(2026-10-15 사용자 요청: "영상강좌 + 사진 + 텍스트(모션 비디오), 나중에 작가들이 올릴 때 참고 가이드가 될 정도로").
// 강좌 한 편 = 단계 여러 개. 단계 = 짧은 모션 영상(소리 없음 · 반복) 또는 사진 + 제목 + 설명 2~3줄.
// 끝에 '핵심 정리' 세 줄과 '바로 해 보기' 하나. 작가 강좌도 같은 틀로 올린다(⑩ 강좌 만드는 법).
// 영상·사진은 앱 안에 들어 있다(인터넷 없이 본다). 유튜브 전체 영상(배경음악·자막)은 youtube 에 링크만 둔다.
// 2026-10-16: 예시 캐릭터는 대표 캐릭터 콘(옥수수). 영상은 에뮬레이터에서 콘을 실제로 그리고 움직여 찍었다(scripts/lessons/corn-strokes.cjs).
// 콘에 없는 부위(귀·꼬리·엄지)는 억지로 바꾸지 않고, 콘의 새싹 잎·손·따로 그린 소품(하트)으로 같은 기능을 보인다.
// 규격·수치는 kakao-spec.ts 에서 가져온다 — 여기서 새로 지어내지 않는다. '승인 팁'은 emoti 가 권하는 습관이지 카카오 심사 기준이 아니다.
import { KAKAO_ANIMATED_SPEC, STAGES } from './kakao-spec';

export type LessonStep = { title: string; body: string; video?: number; image?: number };
export type LessonAction = 'newSet' | 'continue' | 'guide' | 'export' | 'contest' | 'book';
export type Lesson = {
  id: string; group: 'app' | 'draw' | 'artist'; title: string; summary: string; minutes: number;
  // thumb: 목록의 16:9 썸네일(960×540, scripts/lessons/corn-art.cjs). cover 는 예전 4:3 표지(지금은 쓰지 않음).
  thumb: number; cover?: number; steps: LessonStep[]; points: [string, string, string]; tryIt?: { label: string; action: LessonAction }; youtube?: string;
};
export const LESSON_GROUPS: { id: Lesson['group']; title: string; short: string; free: boolean }[] = [
  { id: 'app', title: '무료 · 앱 사용법', short: '앱 사용법', free: true },
  { id: 'draw', title: '무료 · 이모티콘 그리기 기초', short: '그리기 기초', free: true },
  { id: 'artist', title: '작가용', short: '작가용', free: true },
];

const cuts = STAGES.animated.proposal.emoticons;

export const LESSONS: Lesson[] = [
  {
    id: 'first-set', group: 'app', title: '첫 세트 · 첫 칸 그리기', summary: '세트를 만들고 첫 칸을 완성해요', minutes: 2,
    thumb: require('../../assets/lessons/thumbs/first-set.png'),
    cover: require('../../assets/lessons/first-set/cover.png'),
    steps: [
      { title: '세트 만들기', video: require('../../assets/lessons/first-set/step1.mp4'), body: '홈의 새 세트 만들기(또는 내 세트의 노란 +)를 누르고 만들기를 누르면 세트가 생기고 01번 칸이 바로 열려요. 세트 하나가 카카오에 한 번 제안하는 묶음이에요.' },
      { title: '그리기', video: require('../../assets/lessons/first-set/step2.mp4'), body: '위 굵기 막대로 선 굵기를 정하고 펜으로 그려요. 콘처럼 몸 → 새싹 잎 → 손 → 아래 잎 → 얼굴 순서로 큰 모양부터 그리면 쉬워요. 두 손가락으로 톡 치면 되돌리기예요.' },
      { title: '저장하고 보드로', video: require('../../assets/lessons/first-set/step3.mp4'), body: '노란 저장을 누르고 뒤로 가면 보드에 01번이 올라가 있어요. 보라 테두리 칸이 다음 차례예요.' },
      { title: '다음 칸은 이어서', video: require('../../assets/lessons/first-set/step4.mp4'), body: '02번을 누르면 「이전 칸 그림으로 시작」이 떠요. 누르면 같은 캐릭터에서 이어 그릴 수 있어요.' },
    ],
    points: ['만들면 01번 칸이 바로 열려요', '저장하면 보드에 올라가요', '다음 칸은 이전 칸에서 이어 그리기'],
    tryIt: { label: '새 세트 만들기', action: 'newSet' },
  },
  {
    id: 'brush-layer', group: 'app', title: '브러시 · 레이어 · 색', summary: '선 고르기와 레이어로 나눠 그리기', minutes: 3,
    thumb: require('../../assets/lessons/thumbs/brush-layer.png'),
    cover: require('../../assets/lessons/brush-layer/cover.png'),
    steps: [
      { title: '선 종류', video: require('../../assets/lessons/brush-layer/step1.mp4'), body: '아래 줄에서 기본 펜·연필·마커를 골라요. 연필로 옥수수 알갱이를, 마커로 볼터치를 그렸어요. 같은 칸을 한 번 더 누르면 진하기·선 보정 같은 세부 설정이 열려요.' },
      { title: '색 고르기', video: require('../../assets/lessons/brush-layer/step2.mp4'), body: '오른쪽 아래 동그라미를 누르면 색 판이 열려요. 색을 고르고 채우기로 선 안쪽을 누르면 한 번에 칠해져요(몸은 노랑, 잎은 초록). 쓴 색은 최근 색에 남아요.' },
      { title: '레이어 나누기', video: require('../../assets/lessons/brush-layer/step3.mp4'), body: '위의 레이어에서 + 로 레이어를 더하고 그 레이어에 그려요. 하트 같은 소품이나 손을 따로 그려 두면 나중에 그 부분만 움직일 수 있어요.' },
      { title: '선택해서 옮기기', image: require('../../assets/lessons/brush-layer/step4.png'), body: '선택으로 하트를 감싸면 크게·작게·회전·반전을 고를 수 있어요. 끌어서 옮기고, 적용을 눌러야 그림에 남아요.' },
    ],
    points: ['같은 도구를 한 번 더 누르면 설정', '레이어로 나누면 움직이기가 쉬워요', '선택은 적용해야 그림에 남아요'],
    tryIt: { label: '이어서 그리기', action: 'continue' },
  },
  {
    id: 'motion', group: 'app', title: '움직이기 · 손그림 떨림', summary: '효과를 고르면 바로 움직여요', minutes: 3,
    thumb: require('../../assets/lessons/thumbs/motion.png'),
    cover: require('../../assets/lessons/motion/cover.png'),
    steps: [
      { title: '효과 고르기', video: require('../../assets/lessons/motion/step1.mp4'), body: '위의 움직이기를 누르고 효과(뿅·통통·둥실…)를 고르면 바로 움직여요. 묶음 칩으로 등장·동작·강조·조합을 나눠 볼 수 있어요.' },
      { title: '세기 · 속도', video: require('../../assets/lessons/motion/step2.mp4'), body: '캔버스 위 막대로 세기와 속도를 맞춰요. 점선 상자를 넘으면 칸 밖으로 잘린다는 뜻이에요.' },
      { title: '손그림 떨림', video: require('../../assets/lessons/motion/step3.mp4'), body: '아래로 내려 손그림 떨림을 약하게·보통·강하게 중에서 골라요. 선이 살아 있는 듯 떨려요. 효과와 함께 써도 되고, 떨림만 써도 돼요.' },
      { title: '부분만 움직이기', video: require('../../assets/lessons/motion/step4.mp4'), body: '위의 부분 칩을 누르고 하트를 그린 레이어 2를 고르면 그 부분만 따로 움직여요(PRO). 손 흔들기·통통 튀기 같은 바로 쓰기로 시작하고, 회전·이동·크기와 세기를 고쳐요.' },
    ],
    points: ['효과는 고르는 즉시 칸에 들어가요', '점선 밖은 잘려요 — 세기를 줄여요', '떨림은 무료, 어떤 효과와도 함께'],
    tryIt: { label: '이어서 그리기', action: 'continue' },
  },
  {
    id: 'animation', group: 'app', title: '애니메이션 · 장마다 그리기', summary: '그림을 장마다 바꿔 진짜 움직임을', minutes: 4,
    thumb: require('../../assets/lessons/thumbs/animation.png'),
    cover: require('../../assets/lessons/animation/cover.png'),
    steps: [
      { title: '애니메이션 시작', video: require('../../assets/lessons/animation/step1.mp4'), body: '애니메이션 탭에서 시작을 누르면 지금 그림이 1장, 그 복사가 2장이 돼요.' },
      { title: '바뀌는 곳만 고치기', video: require('../../assets/lessons/animation/step2.mp4'), body: '그리기로 가면 2장이 열려 있어요. 콘의 한쪽 눈만 지우고 윙크(⌒)로 다시 그렸어요. 앞 장이 옅은 보라로 비쳐서 같은 자리에 그리기 쉬워요.' },
      { title: '장마다 시간', video: require('../../assets/lessons/animation/step3.mp4'), body: '애니메이션 탭에서 장을 고르고 보여 주는 시간을 정해요. 윙크처럼 순간인 장은 짧게(0.1~0.2초), 눈 뜬 장은 길게(0.5~0.8초) 두면 깜빡이는 리듬이 생겨요.' },
      { title: '재생으로 확인', video: require('../../assets/lessons/animation/step4.mp4'), body: '▶ 로 미리 봐요. 움직이기 효과(통통 등)와 함께 돌아요. 장 추가는 지금 장을 복사해서 이어 붙여요. 무료 3장 · PRO 24장.' },
    ],
    points: ['복사한 뒤 바뀌는 곳만 고쳐요', '짧은 장이 움직임의 리듬을 만들어요', `카카오는 한 칸 ${KAKAO_ANIMATED_SPEC.maxFrames}장까지`],
    tryIt: { label: '이어서 그리기', action: 'continue' },
  },
  {
    id: 'export', group: 'app', title: '내보내기 · 카카오 제안 파일', summary: '손볼 곳을 고치고 파일 묶음 만들기', minutes: 3,
    thumb: require('../../assets/lessons/thumbs/export.png'),
    steps: [
      { title: '내보내기 열기', video: require('../../assets/lessons/export/step1.mp4'), body: '보드 아래 내보내기를 누르면 칸 격자와 손볼 곳, 파일 묶음 만들기가 보여요. 빈 칸은 묶음에서 빠져요.' },
      { title: '제출 준비 보기', video: require('../../assets/lessons/export/step2.mp4'), body: '제출 준비를 펼치면 제안에 필요한 것(이모티콘 수·움직이는 WebP·아이콘)이 몇 개 더 필요한지 보여요.' },
      { title: '아이콘 만들기', video: require('../../assets/lessons/export/step3.mp4'), body: '부가 이미지 › 아이콘 이미지에서 대표 칸을 고르고 크기·위치를 맞춘 뒤 이 모양으로 만들기를 눌러요.' },
      { title: '파일 묶음', body: '파일 묶음 만들기를 누르면 PNG·움직이는 칸 프레임·안내 문서가 한 파일로 묶여요. 카카오 이모티콘 스튜디오에 작가님 이름으로 직접 제안해요.' },
    ],
    points: [`움직이는 세트는 ${cuts}칸`, '제출 준비에서 남은 것 확인', '제안은 작가님 이름으로 직접'],
    tryIt: { label: '내보내기 보기', action: 'export' },
  },
  {
    id: 'contest', group: 'app', title: '공모전 내기', summary: '세트 하나로 접수해요', minutes: 2,
    thumb: require('../../assets/lessons/thumbs/contest.png'),
    steps: [
      { title: '공모전 보기', body: '아래 탭 공모전에서 열린 공모전의 마감·조건·발표 날을 봐요.' },
      { title: '세트 고르기', body: '조건을 채운 세트를 고르고, 참가 조건과 권리 안내를 읽은 뒤 동의해요.' },
      { title: '접수 확인', body: '접수하면 접수번호가 생겨요. 같은 공모전에는 한 세트만 낼 수 있어요.' },
    ],
    points: ['로그인한 작가만 접수', '조건(칸 수·움직이는 칸)을 먼저 채워요', '접수번호로 상태를 확인'],
    tryIt: { label: '공모전 보기', action: 'contest' },
  },
  {
    id: 'character', group: 'draw', title: '캐릭터 정하기', summary: '24칸 내내 같은 캐릭터로', minutes: 3,
    thumb: require('../../assets/lessons/thumbs/character.png'),
    cover: require('../../assets/lessons/character/step1.png'),
    steps: [
      { title: '한 장으로 정리', image: require('../../assets/lessons/character/step1.png'), body: '정면 · 웃는 얼굴 · 전신이 보이는 한 장을 먼저 그려요. emoti 의 콘도 이 한 장에서 시작했어요. 이 그림이 세트 전체의 기준이에요.' },
      { title: '바꾸지 않을 것', image: require('../../assets/lessons/character/step2.png'), body: '몸 길이·새싹 잎·눈 모양·손 크기처럼 끝까지 지킬 특징을 정해요. 콘은 표정과 손 위치만 바뀌고 나머지는 그대로라 같은 캐릭터로 보여요.' },
      { title: '작게 봐도 알아보게', image: require('../../assets/lessons/character/step3.png'), body: '이모티콘은 채팅에서 작게 보여요. 아이콘 크기(78)로 줄여도 알아볼 만큼 선은 굵고 단순하게 그려요.' },
    ],
    points: ['기준 그림 한 장부터', '지킬 특징을 적어 두기', '작게 봐도 알아보게 단순하게'],
    tryIt: { label: '이어서 그리기', action: 'continue' },
  },
  {
    id: 'expressions', group: 'draw', title: '표정 24가지 만드는 법', summary: '자주 쓰는 마음부터 채우기', minutes: 4,
    thumb: require('../../assets/lessons/thumbs/expressions.png'),
    cover: require('../../assets/lessons/expressions/step3.png'),
    steps: [
      { title: '자주 쓰는 말부터', image: require('../../assets/lessons/expressions/step1.png'), body: '안녕 · 고마워 · 미안 · 좋아 · 응 · 아니 · 화남 · 슬픔처럼 대화에서 자주 쓰는 마음을 먼저 채워요.' },
      { title: '표현 가이드 쓰기', body: '홈 위의 책 아이콘(표현 가이드)에서 마음을 고르면 표정·자세 예시를 밑그림으로 깔 수 있어요.' },
      { title: '같은 말, 다른 몸짓', image: require('../../assets/lessons/expressions/step3.png'), body: '같은 고마워도 꾸벅·하트·수줍게·두 손 번쩍처럼 몸짓과 소품을 바꾸면 칸마다 다르게 읽혀요.' },
    ],
    points: ['대화에서 자주 쓰는 마음 먼저', '표현 가이드를 밑그림으로', '얼굴 + 몸짓 + 소품'],
    tryIt: { label: '표현 가이드 열기', action: 'guide' },
  },
  {
    id: 'set-plan', group: 'draw', title: '승인에 가까운 세트 구성', summary: 'emoti 가 권하는 제작 습관', minutes: 3,
    thumb: require('../../assets/lessons/thumbs/set-plan.png'),
    steps: [
      { title: '겹치지 않게', image: require('../../assets/lessons/set-plan/step1.png'), body: '같은 표정·같은 말이 두 칸에 있지 않은지 보드에서 한눈에 확인해요(그림의 빨간 점선 두 칸처럼).' },
      { title: '움직임은 의미 있게', body: '움직임은 마음을 더 크게 보이게 할 때 써요. 모든 칸을 같은 효과로 채우지 않아요.' },
      { title: '마지막 장이 대표', body: '움직이는 칸은 마지막 장이 미리보기로 쓰여요. 가장 대표하는 모습이 마지막에 오게 해요.' },
    ],
    points: ['칸마다 다른 마음', '움직임은 의미 있게', '마지막 장이 미리보기'],
    tryIt: { label: '가이드북 보기', action: 'book' },
  },
  {
    id: 'make-lesson', group: 'artist', title: '강좌 만드는 법', summary: '작가 강좌를 올릴 때 이 틀 그대로', minutes: 3,
    thumb: require('../../assets/lessons/thumbs/make-lesson.png'),
    steps: [
      { title: '한 편 = 한 가지', body: '강좌 한 편에는 배울 것 하나만 담아요. 단계는 3~5개, 단계마다 20~40초 영상 하나.' },
      { title: '단계 = 영상 + 두 줄', image: require('../../assets/lessons/make-lesson/step2.png'), body: '영상은 손이 하는 일을 보여 주고, 글 두 줄은 왜 그렇게 하는지 말해요. 같은 말을 반복하지 않아요.' },
      { title: '끝에 정리 · 해 보기', image: require('../../assets/lessons/make-lesson/step3.png'), body: '핵심 세 줄로 정리하고, 수강생이 바로 따라 할 화면으로 보내는 버튼을 하나 둬요.' },
      { title: '유료라면 실습 파일', body: '밑그림·캐릭터 시트 같은 실습 파일과 과제가 있어야 유료로 올릴 수 있어요. 영상만 있는 강좌는 무료예요.' },
    ],
    points: ['한 편에 한 가지', '영상은 손, 글은 이유', '정리 세 줄 + 해 보기 하나'],
  },
];
