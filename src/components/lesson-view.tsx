// 강좌 보기(2026-10-15). 단계를 한 장씩 넘겨 본다 — 영상은 한 번에 하나만 돈다(소리 없음 · 반복).
// 마지막 장은 '핵심 정리' 세 줄 + '바로 해 보기' 하나(+ 유튜브 전체 영상 링크가 있으면 그 줄).
import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { T, Clay, Glyph } from './ui';
import type { Lesson, LessonAction } from '../constants/lessons';

const C = T;
function StepVideo({ source, size }: { source: number; size: number }) {
  const player = useVideoPlayer(source, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView testID="강좌 영상" player={player} nativeControls={false} contentFit="contain" style={{ width: size, height: Math.round(size * 4 / 3), backgroundColor: C.surface2 }} />;
}

// 사진은 제 비율대로(세로로 긴 화면 캡처도 잘리지 않게). 너무 길면 화면 높이의 60% 에서 멈춘다.
function StepImage({ source, size }: { source: number; size: number }) {
  const { height } = useWindowDimensions();
  const r = Image.resolveAssetSource?.(source);
  const ratio = r && r.width ? r.height / r.width : 1;
  return <Image source={source} style={{ width: size, height: Math.min(Math.round(size * ratio), Math.round(height * .6)) }} resizeMode="contain" />;
}

export function LessonView({ lesson, onBack, onAction }: { lesson: Lesson; onBack: () => void; onAction: (a: LessonAction) => void }) {
  const { width } = useWindowDimensions();
  const [at, setAt] = useState(0);
  const total = lesson.steps.length + 1;   // 마지막 장 = 정리
  const step = lesson.steps[at];
  // 강좌 영상은 3:4(가로 1080 · 세로 1440 을 줄인 것). 화면이 낮아도 다음 버튼이 보이게 폭을 줄인다.
  const media = Math.min(width - 32, 360);
  return <View testID="강좌 보기" style={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, marginLeft: -8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="강좌 목록으로" onPress={onBack} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Glyph name="chevron-left" size={24} color={C.ink} /></Pressable>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>{lesson.title}</Text>
        <Text style={{ fontSize: 12, color: C.muted }}>{`${lesson.minutes}분 · ${lesson.steps.length}단계`}</Text>
      </View>
    </View>
    {/* 진행: 지금 단계는 길쭉한 보라 */}
    <View accessible accessibilityLabel={`${total}장 중 ${at + 1}번째`} style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => <View key={i} style={{ flex: i === at ? 3 : 1, height: 6, borderRadius: 3, backgroundColor: i <= at ? C.point : C.fillPressed }} />)}
    </View>
    {step ? <View style={{ gap: 12 }}>
      <View style={{ alignItems: 'center', borderRadius: 24, overflow: 'hidden', ...Clay.card }}>
        {step.video ? <StepVideo key={lesson.id + at} source={step.video} size={media} />
          : step.image ? <StepImage source={step.image} size={media} />
          : <View style={{ width: media, height: media * .6, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentSoft }}>
              <Text style={{ fontSize: 44, fontWeight: '800', color: C.yellowInk }}>{String(at + 1).padStart(2, '0')}</Text>
            </View>}
      </View>
      <View style={{ gap: 4, paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: C.pointInk }}>{`${at + 1}단계`}</Text>
        <Text accessibilityRole="header" style={{ fontSize: 20, lineHeight: 27, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>{step.title}</Text>
        <Text style={{ fontSize: 15, lineHeight: 23, color: C.ink }}>{step.body}</Text>
      </View>
    </View> : <View testID="강좌 정리" style={{ gap: 12 }}>
      <View style={{ borderRadius: 28, padding: 20, gap: 10, ...Clay.yellow }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: C.yellowInk }}>핵심 정리</Text>
        {lesson.points.map((p, i) => <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{i + 1}</Text></View>
          <Text style={{ flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '700', color: C.ink }}>{p}</Text>
        </View>)}
      </View>
      {!!lesson.tryIt && <Pressable accessibilityRole="button" accessibilityLabel={lesson.tryIt.label} onPress={() => onAction(lesson.tryIt!.action)}
        style={({ pressed }) => ({ minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, ...(pressed ? Clay.buttonPressed : Clay.button) })}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.accentInk }}>{`바로 해 보기 · ${lesson.tryIt.label}`}</Text>
      </Pressable>}
      {!!lesson.youtube && <Pressable accessibilityRole="link" accessibilityLabel="유튜브에서 전체 영상 보기" onPress={() => Linking.openURL(lesson.youtube!).catch(() => {})}
        style={{ minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>유튜브에서 전체 영상 보기</Text>
      </Pressable>}
    </View>}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="이전 단계" disabled={at === 0} onPress={() => setAt(at - 1)}
        style={{ flex: 1, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill, opacity: at === 0 ? .4 : 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.ink }}>이전</Text>
      </Pressable>
      {at < total - 1 && <Pressable accessibilityRole="button" accessibilityLabel="다음 단계" onPress={() => setAt(at + 1)}
        style={{ flex: 2, minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: C.pointSoft }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.pointInk }}>{at === total - 2 ? '정리 보기' : '다음 단계'}</Text>
      </Pressable>}
    </View>
  </View>;
}
