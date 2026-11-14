// 바이럴 기획 A 「선 몇 개가 인사가 되기까지」 녹화 1단계: 빈 칸에 콘을 손가락 획으로 그린다(에뮬레이터 전용, 2026-10-21).
// 사용: node scripts/promo/record-a.cjs <단계>   단계 = draw | shot
const r = require('../lessons/rec.cjs');
const { draw } = require('../lessons/corn-strokes.cjs');
const step = process.argv[2] || 'draw';
if (step === 'draw') {
  r.touches(false);
  r.start('promo-a-draw', 60);
  draw(['body', 'sprout', 'armL', 'armWave', 'skirt', 'eyes', 'mouth']);
  r.sleep(800);
  r.stop();
  console.log(r.pull('promo-a-draw'));
}
if (step === 'strokes') draw(['body', 'sprout', 'armL', 'armWave', 'skirt', 'eyes', 'mouth']);
if (step === 'shot') r.shot(process.argv[3]);
