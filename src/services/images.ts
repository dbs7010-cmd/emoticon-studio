import * as Picker from 'expo-image-picker';
import { Asset } from 'expo-asset';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { newImageFile, newMotionFile, localFile } from './storage';
import type { ImageSourcePropType } from 'react-native';
import type { LocalImage, Metrics, PainterExport, PainterWork } from '../types';

export async function pickImages(multiple = false): Promise<LocalImage[]> {
  const result = await Picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, selectionLimit: multiple ? 8 : 1, quality: 1 });
  if (result.canceled) return [];
  const images: LocalImage[] = [];
  for (const asset of result.assets) {
    // Decode once into portable PNG, preserving dimensions and alpha. Never resize a final silently.
    const context = ImageManipulator.manipulate(asset.uri);
    const rendered = await context.renderAsync();
    const png = await rendered.saveAsync({ format: SaveFormat.PNG });
    const destination = newImageFile();
    new File(png.uri).copy(destination);
    images.push({ path: destination.name, width: png.width, height: png.height });
    context.release(); rendered.release();
  }
  return images;
}
// 앱에 함께 실린 그림(표현 가이드 예시 등)을 참고 사진과 같은 자리로 들여온다.
// 고른 사진과 똑같이 PNG 한 장으로 옮겨 놓아야, 참고 레이어의 저장·복원·삭제가 기존 정책 그대로 돈다
// (저장 파일은 LocalImage 경로로 참고를 찾는다 — 번들 모듈은 경로가 없어 그대로는 쓸 수 없다).
// 단계별 표시. 기기에서 막혔을 때 어느 칸에서 멈췄는지 짧은 한글로만 알린다 —
// 내부 경로·네이티브 오류 원문은 화면에 내보내지 않고 로그로만 남긴다.
async function stage<T>(step: 1 | 2 | 3, what: string, run: () => Promise<T> | T): Promise<T> {
  try { return await run(); }
  catch (e) {
    console.warn('[emoticon-studio] importBundledImage ' + step, e);
    throw new Error(`${what} (${step}단계)`);
  }
}

export async function importBundledImage(module: ImageSourcePropType): Promise<LocalImage> {
  // 정적 require(...) 로 들어온 번들 그림은 실행 시점에 숫자 손잡이다. 자리 정의가 쓰는 넓은 타입을 그대로 받고 여기서 좁힌다.
  const asset = Asset.fromModule(module as number);
  // Android 릴리스에서 번들 그림은 drawable 리소스로 들어간다. 그때 expo-asset 은 <Image> 호환을 위해
  // **파일 경로가 아니라 리소스 이름**(스킴 없는 문자열)을 localUri 에 넣고 '내려받음'으로 표시해 버린다.
  // 그러면 downloadAsync 가 그냥 돌아와 실제 파일이 만들어지지 않고, 그 이름을 파일로 아는 쪽(ImageManipulator)이 실패한다.
  // 네이티브 쪽은 이 이름을 읽을 수 있으므로, 표시만 지워 한 번 제대로 내려받게 한다.
  if (asset.downloaded && asset.localUri && !asset.localUri.includes(':')) {
    asset.downloaded = false;
    asset.localUri = null;
  }
  const uri = await stage(1, '그림을 찾지 못했어요', async () => {
    await asset.downloadAsync();
    const found = asset.localUri ?? asset.uri;
    // 여기서부터는 파일을 읽는 단계라 스킴이 없는 값은 파일이 아니다. 조용히 넘기지 않는다.
    if (!found || !found.includes(':')) throw new Error('no file uri');
    return found;
  });
  const png = await stage(2, '그림을 파일로 옮기지 못했어요', async () => {
    const context = ImageManipulator.manipulate(uri);
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.PNG });
    context.release(); rendered.release();
    return saved;
  });
  return stage(3, '앱에 저장하지 못했어요', () => {
    const destination = newImageFile();
    new File(png.uri).copy(destination);
    return { path: destination.name, width: png.width, height: png.height };
  });
}
export async function dataUrl(image: LocalImage): Promise<string> {
  if (Math.max(image.width, image.height) > 720) {
    const context = ImageManipulator.manipulate(localFile(image.path).uri);
    context.resize(image.width >= image.height ? { width: 720 } : { height: 720 });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.PNG, base64: true });
    const data = `data:image/png;base64,${result.base64}`;
    new File(result.uri).delete(); context.release(); rendered.release();
    return data;
  }
  return `data:image/png;base64,${await localFile(image.path).base64()}`;
}
export function saveDrawing(data: string, metrics: Metrics): LocalImage {
  if (!data.startsWith('data:image/png;base64,')) throw new Error('PNG 데이터가 아닙니다.');
  const file = newImageFile();
  file.write(data.slice(data.indexOf(',') + 1), { encoding: 'base64' });
  const header = file.bytesSync();
  if (header[0] !== 137 || header[1] !== 80) throw new Error('PNG 저장 검증 실패');
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  return { path: file.name, width: view.getUint32(16), height: view.getUint32(20), metrics };
}
// A piece someone kept out of a drawing. It is not a submission asset, so it carries no QA
// metrics: measuring a cutout against the 360×360 rules would be measuring the wrong thing.
export function saveCutout(data: string): LocalImage {
  if (!data.startsWith('data:image/png;base64,')) throw new Error('PNG 데이터가 아닙니다.');
  const file = newImageFile();
  file.write(data.slice(data.indexOf(',') + 1), { encoding: 'base64' });
  const header = file.bytesSync();
  if (header[0] !== 137 || header[1] !== 80) throw new Error('PNG 저장 검증 실패');
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  return { path: file.name, width: view.getUint32(16), height: view.getUint32(20) };
}
// The moving file the cut ships. Written and read back before it is trusted, the same way the
// still PNG is, so a half written loop never reaches a submission bundle.
export function saveMotionLoop(data: string): LocalImage {
  if (!data.startsWith('data:image/gif;base64,')) throw new Error('GIF 데이터가 아닙니다.');
  const file = newMotionFile();
  file.write(data.slice(data.indexOf(',') + 1), { encoding: 'base64' });
  const bytes = file.bytesSync();
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (header !== 'GIF89a') throw new Error('GIF 저장 검증 실패');
  return { path: file.name, width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
}
// 제출 형식 파일. 쓰고 나서 다시 읽어 RIFF/WEBP 헤더와 애니메이션 표시를 확인한다.
export function saveSubmitLoop(data: string): LocalImage {
  if (!data.startsWith('data:image/webp;base64,')) throw new Error('WebP 데이터가 아닙니다.');
  const file = newMotionFile('webp');
  file.write(data.slice(data.indexOf(',') + 1), { encoding: 'base64' });
  const bytes = file.bytesSync();
  const tag = String.fromCharCode(...bytes.slice(0, 4)) + String.fromCharCode(...bytes.slice(8, 12));
  if (tag !== 'RIFFWEBP') throw new Error('WebP 저장 검증 실패');
  // VP8X 의 너비·높이는 12바이트 헤더 뒤 24바이트 지점부터 3바이트씩 들어 있다.
  const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
  const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
  return { path: file.name, width, height };
}
export function savePainterWork(payload: PainterExport, references: LocalImage[]): { finalImage: LocalImage; work: PainterWork } {
  const layers = payload.layers.map(({ data, ...transform }) => {
    const { metrics: _compositeMetrics, ...image } = saveDrawing(data, payload.metrics);
    return { ...transform, image };
  });
  const refs = payload.references.map(({ path, ...transform }) => {
    const image = references.find(i => i.path === path);
    if (!image) throw new Error('참고 이미지 정보를 찾지 못했습니다.');
    return { ...transform, image };
  });
  const caption = payload.caption?.text.trim() ? payload.caption : undefined;
  // 애니메이션 장: 첫 장은 위에서 저장한 layers 를 그대로 가리키고(파일 중복 없음), 나머지 장은 레이어마다 파일로 남긴다.
  const frames = payload.frames && payload.frames.length > 1 ? payload.frames.map(f => ({ id: f.id, duration: f.duration,
    layers: f.layers === null ? layers : f.layers.map(({ data, ...transform }) => { const { metrics: _m, ...image } = saveDrawing(data, payload.metrics); return { ...transform, image }; }) })) : undefined;
  return { finalImage: saveDrawing(payload.data, payload.metrics), work: { version: 1, activeLayerId: payload.activeLayerId, layers, references: refs, caption, ...(frames ? { frames } : {}) } };
}
