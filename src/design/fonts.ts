// 문구 폰트 파일 읽기(2026-11-03). 캔버스(WebView)가 FontFace 로 읽어 문구를 그린다. 없는 글자는 기기 기본 글꼴로 보인다.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { fontOf } from './font-list';

const FILES: Record<string, number> = {
  gaegu: require('../../assets/fonts/gaegu.woff2'),
  nanumpen: require('../../assets/fonts/nanumpen.woff2'),
  jua: require('../../assets/fonts/jua.woff2'),
  poorstory: require('../../assets/fonts/poorstory.woff2'),
  gamjaflower: require('../../assets/fonts/gamjaflower.woff2'),
  himelody: require('../../assets/fonts/himelody.woff2'),
  singleday: require('../../assets/fonts/singleday.woff2'),
  cutefont: require('../../assets/fonts/cutefont.woff2'),
  yeonsung: require('../../assets/fonts/yeonsung.woff2'),
  dokdo: require('../../assets/fonts/dokdo.woff2'),
  yomogi: require('../../assets/fonts/yomogi.woff2'),
  kleeone: require('../../assets/fonts/kleeone.woff2'),
  hachimaru: require('../../assets/fonts/hachimaru.woff2'),
  yusei: require('../../assets/fonts/yusei.woff2'),
  kurenaido: require('../../assets/fonts/kurenaido.woff2'),
  huninn: require('../../assets/fonts/huninn.woff2'),
  iansui: require('../../assets/fonts/iansui.woff2'),
  wenkai: require('../../assets/fonts/wenkai.woff2'),
};
// 캔버스에 보낼 폰트 자료(base64 WOFF2). 한 번 읽은 것은 앱이 켜져 있는 동안 다시 읽지 않는다.
const cache = new Map<string, Promise<string>>();
export function fontData(key: string): Promise<string> | null {
  const f = fontOf(key), mod = FILES[key];
  if (!f || !mod) return null;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!uri || !uri.includes(':')) throw new Error('font file missing: ' + key);
      return await new File(uri).base64();
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}
// 문구가 쓰는 폰트를 캔버스 init 에 함께 싣는다(그리기 화면 · 움직임 굽기 공통). 읽지 못하면 빈 목록 — 기본 글꼴로 그린다.
export async function fontsFor(style?: string | null): Promise<{ key: string; data: string }[]> {
  const p = style ? fontData(style) : null;
  if (!p) return [];
  try { return [{ key: style!, data: await p }]; } catch { return []; }
}
