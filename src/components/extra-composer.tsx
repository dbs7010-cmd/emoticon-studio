import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

// 부가 이미지를 그려 주는 숨은 캔버스. 아이콘(78×78)과 공유 이미지(600×166)는 이모티콘과 비율이
// 달라서, 자동으로 늘리면 그림이 찌그러진다. 그래서 **원본은 건드리지 않고** 사용자가 정한
// 위치·크기 그대로 새 판에 얹어 그린다. 비율은 언제나 유지한다.
//
// 화면의 미리보기와 여기서 나오는 파일이 같아야 하므로 계산식을 한 곳에 둔다: 아래 place() 가 그것이고,
// 화면 쪽도 같은 식을 쓴다.
export type Placement = { scale: number; dx: number; dy: number };
export type Composer = { compose: (source: string, frame: { width: number; height: number }, place: Placement, background: string | null) => Promise<string> };

// 그림을 프레임 안에 놓는 규칙. scale 1 은 "프레임에 꽉 맞게 넣기"(비율 유지)이고,
// dx·dy 는 프레임 크기를 1로 본 이동량이다.
export const placeInFrame = (image: { width: number; height: number }, frame: { width: number; height: number }, place: Placement) => {
  const fit = Math.min(frame.width / image.width, frame.height / image.height);
  const w = image.width * fit * place.scale, h = image.height * fit * place.scale;
  return { x: (frame.width - w) / 2 + place.dx * frame.width, y: (frame.height - h) / 2 + place.dy * frame.height, w, h };
};

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<script>
var send = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
// placeInFrame 과 같은 식을 글자로 둔다. 예전에는 placeInFrame.toString() 을 넣었는데, 출시 빌드(Hermes)는 함수 본문을
// 바이트코드로만 갖고 있어 "function () { [bytecode] }" 가 들어가 아이콘·공유 이미지 만들기가 늘 실패했다(2026-10-15 에뮬레이터).
var place = function (image, frame, place) {
  var fit = Math.min(frame.width / image.width, frame.height / image.height);
  var w = image.width * fit * place.scale, h = image.height * fit * place.scale;
  return { x: (frame.width - w) / 2 + place.dx * frame.width, y: (frame.height - h) / 2 + place.dy * frame.height, w: w, h: h };
};
window.command = function (m) {
  if (m.type !== 'compose') return;
  var img = new Image();
  img.onload = function () {
    try {
      var c = document.createElement('canvas');
      c.width = m.frame.width; c.height = m.frame.height;
      var g = c.getContext('2d');
      if (m.background) { g.fillStyle = m.background; g.fillRect(0, 0, c.width, c.height); }
      var box = place({ width: img.width, height: img.height }, m.frame, m.place);
      g.drawImage(img, box.x, box.y, box.w, box.h);
      send({ type: 'composed', id: m.id, data: c.toDataURL('image/png') });
    } catch (e) { send({ type: 'composed', id: m.id, message: String(e) }); }
  };
  img.onerror = function () { send({ type: 'composed', id: m.id, message: '그림을 읽지 못했어요.' }); };
  img.src = m.source;
};
send({ type: 'ready' });
</script></body>`;

export const ExtraComposer = forwardRef<Composer>(function ExtraComposer(_, ref) {
  const web = useRef<WebView>(null), ready = useRef(false), sequence = useRef(0);
  const pending = useRef(new Map<number, { resolve: (data: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const send = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);

  useImperativeHandle(ref, () => ({
    compose: (source, frame, place, background) => new Promise<string>((resolve, reject) => {
      if (!ready.current) { reject(new Error('그림판이 아직 준비되지 않았어요.')); return; }
      const id = ++sequence.current;
      const timer = setTimeout(() => { pending.current.delete(id); reject(new Error('시간이 너무 오래 걸렸어요.')); }, 20000);
      pending.current.set(id, { resolve, reject, timer });
      send({ type: 'compose', id, source, frame, place, background });
    }),
  }));

  React.useEffect(() => () => {
    for (const p of pending.current.values()) { clearTimeout(p.timer); p.reject(new Error('화면이 닫혔어요.')); }
    pending.current.clear();
  }, []);

  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}>
    <WebView ref={web} source={{ html }} originWhitelist={['about:*']} javaScriptEnabled
      onShouldStartLoadWithRequest={r => r.url === 'about:blank'}
      onMessage={e => {
        let m: { type: string; id?: number; data?: string; message?: string };
        try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
        if (m.type === 'ready') { ready.current = true; return; }
        if (m.id === undefined) return;
        const job = pending.current.get(m.id);
        if (!job) return;
        clearTimeout(job.timer); pending.current.delete(m.id);
        if (m.data) job.resolve(m.data); else job.reject(new Error(m.message || '그리지 못했어요.'));
      }} />
  </View>;
});
