import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { canvasHtml } from '../painter/canvas-html';
import { dataUrl } from '../services/images';
import type { Caption, Motion, MotionLoop, PainterWork } from '../types';

// sheets 를 켜면 공식 도구에 넣을 360x360 PNG 프레임까지 함께 돌려준다. 양이 크므로 내보낼 때만 켠다.
// line: LINE 움직이는 스티커용 PNG 프레임(w×h 칸, count 장 · still 이면 첫 장만). 카카오 경로와 따로 만든다(2026-10-27).
export type LineSpec = { w: number; h: number; count: number; still?: boolean; pad?: number };
export type LineFrames = { loop: number; count: number; sheets: string[] };
export type Baker = { bake: (work: PainterWork, motion: Motion, sheets?: boolean) => Promise<MotionLoop>; line: (work: PainterWork, motion: Motion, spec: LineSpec) => Promise<LineFrames> };

// The same engine the painter uses, kept off-screen so a cut can be rebuilt without opening it.
// Applying one movement to several cuts has to produce real files for each of them; anything less
// would leave a set whose board says "moving" and whose bundle ships stills.
export const MotionBaker = forwardRef<Baker>(function MotionBaker(_, ref) {
  const web = useRef<WebView>(null), ready = useRef(false), sequence = useRef(0);
  const pending = useRef(new Map<number, { stage: 'init' | 'frames'; sheets: boolean; spec?: LineSpec; resolve: (loop: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const send = (message: object) => web.current?.injectJavaScript(`window.command(${JSON.stringify(message)});true;`);

  useImperativeHandle(ref, () => ({
    bake: (work: PainterWork, motion: Motion, sheets = false) => run<MotionLoop>(work, motion, sheets),
    line: (work: PainterWork, motion: Motion, spec: LineSpec) => run<LineFrames>(work, motion, false, spec),
  }));
  async function run<T>(work: PainterWork, motion: Motion, sheets: boolean, spec?: LineSpec): Promise<T> {
      if (!ready.current) throw new Error('움직임 만들기가 준비 중입니다.');
      const decode = (list: PainterWork['layers']) => Promise.all(list.map(async ({ image, ...rest }) => ({ ...rest, data: image ? await dataUrl(image) : undefined })));
      const layers = await decode(work.layers);
      // 애니메이션 장도 함께 보낸다(첫 장 = layers).
      const frames = work.frames && work.frames.length > 1 ? await Promise.all(work.frames.map(async (f, i) => ({ id: f.id, duration: f.duration, layers: i === 0 ? layers : await decode(f.layers) }))) : undefined;
      const id = ++sequence.current;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => { pending.current.delete(id); reject(new Error('움직임 만들기 시간 초과')); }, 60000);
        pending.current.set(id, { stage: 'init', sheets, spec, resolve, reject, timer });
        send({ type: 'init', id, layers, frames, references: [], activeLayerId: work.activeLayerId, caption: work.caption ?? null, motion });
      });
  }

  React.useEffect(() => () => {
    for (const p of pending.current.values()) { clearTimeout(p.timer); p.reject(new Error('움직임 만들기가 닫혔습니다.')); }
    pending.current.clear();
  }, []);

  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}>
    <WebView ref={web} source={{ html: canvasHtml }} originWhitelist={['about:*']} javaScriptEnabled
      onShouldStartLoadWithRequest={r => r.url === 'about:blank'}
      onMessage={e => {
        let m: { type: string; id?: number; gif?: MotionLoop; line?: LineFrames; message?: string };
        try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
        if (m.type === 'ready') { ready.current = true; return; }
        if (m.id === undefined) return;
        const job = pending.current.get(m.id);
        if (!job) return;
        if (m.type === 'initialized' && job.stage === 'init') { job.stage = 'frames'; send(job.spec ? { type: 'lineFrames', id: m.id, spec: job.spec } : { type: 'frames', id: m.id, fps: 12, sheets: job.sheets }); return; }
        clearTimeout(job.timer); pending.current.delete(m.id);
        if (m.type === 'frames' && m.gif) job.resolve(m.gif);
        else if (m.type === 'lineFrames' && m.line) job.resolve(m.line);
        else job.reject(new Error(m.message || '움직임을 만들지 못했어요.'));
      }} />
  </View>;
});
