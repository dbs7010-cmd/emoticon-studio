// 작가명(2026-10-08). 모든 회원이 로그인 뒤 한 번 정하고, **바꿀 수 없다**. 서버만 쓴다(규칙이 앱 쓰기를 막음).
//  - 형식: 한글(완성 글자)·영문·숫자 2~12자, 띄어쓰기·기호 없음.
//  - 중복: 대소문자를 가리지 않는다(artistNames/{소문자} 예약 문서로 한 사람만).
//  - 금지어: 욕설·비하·성적 표현, 운영자·관리자·공식·브랜드 사칭. 글자 사이에 숫자를 끼운 변형(씨1발)도 숫자를 빼고 다시 본다.
//    목록은 통상적인 것만 — 운영 중 신고가 들어오면 여기 더한다.
const FORMAT = /^[가-힣A-Za-z0-9]{2,12}$/;
const BANNED = [
  // 욕설·비하
  '시발', '씨발', '씨빨', '씨팔', '시팔', '쌍놈', '썅', '병신', '븅신', '빙신', '좆', '존나', '졸라', '개새', '새끼', '지랄', '미친놈', '미친년',
  '엠창', '느금', '니애미', '니미', '애미', '애비', '등신', '또라이', '닥쳐', '꺼져', '한남', '김치녀', '된장녀', '틀딱', '일베', '급식충', '맘충',
  'fuck', 'fuk', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'nigger', 'nigga', 'retard',
  // 성적 표현
  '섹스', '야동', '보지', '자지', '창녀', '걸레', '자위', '노출', 'sex', 'porn', 'xxx', 'nude',
  // 운영·브랜드 사칭
  '운영자', '운영진', '관리자', '공식', '고객센터', '이모티', 'emoti', 'admin', 'official', 'staff', 'manager', 'system',
  '카카오', 'kakao', '네이버', 'naver', '구글', 'google', '애플', 'apple',
];
const key = name => name.normalize('NFC').toLowerCase();
function checkFormat(raw) {
  const name = String(raw ?? '').normalize('NFC').trim();
  if (!FORMAT.test(name)) return { ok: false, name, reason: '한글·영문·숫자 2~12자로 정해 주세요(띄어쓰기·기호 없이).' };
  const k = key(name), bare = k.replace(/[0-9]/g, '');
  if (BANNED.some(w => k.includes(w) || bare.includes(w))) return { ok: false, name, reason: '쓸 수 없는 단어가 들어 있어요.' };
  return { ok: true, name, key: k };
}
module.exports = { checkFormat, key, BANNED };
