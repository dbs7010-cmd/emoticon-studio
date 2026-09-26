// 검사용 react-native Animated 대역. 실제 애니메이션은 없고, 값은 즉시 목표값이 된다.
// 제품이 Animated 로 움직임을 그리더라도 검사는 '끝난 뒤의 상태'와 보낸 명령만 본다.
class Value {
  constructor(v) { this._value = v; }
  setValue(v) { this._value = v; }
  stopAnimation(cb) { if (cb) cb(this._value); }
  __getValue() { return this._value; }
}
const run = (fn) => ({ start: cb => { fn(); if (cb) cb({ finished: true }); }, stop() {} });
module.exports = {
  View: 'View',
  Value,
  timing: (value, { toValue }) => run(() => value.setValue(toValue)),
  spring: (value, { toValue }) => run(() => value.setValue(toValue)),
  parallel: list => run(() => list.forEach(a => a.start())),
};
