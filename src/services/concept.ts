import type { Slot } from '../types';
const dialogues = ['고마워!', '좋아 좋아', '잠깐만!', '진짜?', '미안해', '잘 자', '응원할게!', '배고파', '괜찮아', '수고했어!', '신난다!', '보고 싶어'];
export function suggestDialogue(current: string): string {
  return dialogues[(dialogues.indexOf(current) + 1) % dialogues.length];
}
export interface ConceptAssistant { suggest(input: Pick<Slot, 'dialogue' | 'emotion' | 'situation'>): Partial<Slot> }
export const conceptAssistant: ConceptAssistant = {
  suggest({ dialogue, emotion, situation }) {
    const feeling = `${emotion} ${situation}`;
    const sad = /슬픔|슬퍼|미안|우울|눈물/.test(feeling);
    const angry = /화남|화나|분노|짜증/.test(feeling);
    const surprised = /놀람|놀라|진짜|당황/.test(feeling);
    return {
      expressionGuide: sad ? '눈썹을 낮추고 입꼬리를 작게 내리기' : angry ? '눈썹을 안쪽으로 모으고 볼에 힘주기' : surprised ? '눈과 입을 크게 열기' : '기본 눈 모양을 유지하며 입꼬리를 올리기',
      poseGuide: sad ? '어깨를 낮추고 두 손을 앞으로 모으기' : angry ? '팔짱을 끼고 몸을 살짝 앞으로 기울이기' : surprised ? '두 손을 볼 옆으로 들고 뒤로 젖히기' : '한 손을 흔들고 몸을 살짝 기울이기',
      compositionGuide: `${situation || '대화에 반응하는 순간'}: 캐릭터를 중앙에 크게, 외곽 여백 확보. CANON 몸 비율 유지.`,
      effectGuide: sad ? '작은 눈물 1~2개' : angry ? '머리 옆 작은 분노 표시' : surprised ? '머리 위 짧은 강조선 2개' : '손 옆 작은 반짝임',
      textPlacementGuide: dialogue.length > 8 ? '대사는 위쪽 두 줄, 얼굴·외곽선과 겹치지 않게' : '대사는 위쪽 중앙, 얼굴과 충분히 간격 두기',
    };
  },
};
