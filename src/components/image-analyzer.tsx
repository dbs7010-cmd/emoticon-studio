import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { canvasHtml } from '../painter/canvas-html';
import { dataUrl } from '../services/images';
import type { LocalImage, Metrics } from '../types';
export type Analyzer = { analyze: (image: LocalImage) => Promise<Metrics> };
export const ImageAnalyzer = forwardRef<Analyzer>(function ImageAnalyzer(_, ref) {
  const web = useRef<WebView>(null), ready = useRef(false), sequence = useRef(0);
  const pending = useRef(new Map<number, { resolve: (m: Metrics) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  useImperativeHandle(ref, () => ({ analyze: async image => {
    if (!ready.current) throw new Error('픽셀 검사기가 준비 중입니다.');
    const data = await dataUrl(image), id = ++sequence.current;
    return new Promise<Metrics>((resolve, reject) => {
      const timer = setTimeout(() => { pending.current.delete(id); reject(new Error('픽셀 검사 시간 초과')); }, 20000);
      pending.current.set(id, { resolve, reject, timer });
      web.current?.injectJavaScript(`window.command(${JSON.stringify({ type: 'analyze', id, data })});true;`);
    });
  } }));
  React.useEffect(() => () => { for (const p of pending.current.values()) { clearTimeout(p.timer); p.reject(new Error('검사기 닫힘')); } pending.current.clear(); }, []);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}><WebView ref={web} source={{ html: canvasHtml }} originWhitelist={['about:*']} onShouldStartLoadWithRequest={r => r.url === 'about:blank'} onMessage={e => {
    const m = JSON.parse(e.nativeEvent.data); if (m.type === 'ready') ready.current = true;
    const p = pending.current.get(m.id); if (!p) return;
    clearTimeout(p.timer); pending.current.delete(m.id);
    if (m.type === 'analysis') p.resolve(m.metrics); else p.reject(new Error(m.message || '픽셀 검사 실패'));
  }} /></View>;
});
