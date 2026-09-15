import * as Picker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { newImageFile, newMotionFile, localFile } from './storage';
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
  return { finalImage: saveDrawing(payload.data, payload.metrics), work: { version: 1, activeLayerId: payload.activeLayerId, layers, references: refs, caption } };
}
