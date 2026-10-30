import { t } from '../i18n/index';
// 강좌 보기(2026-10-15 · 2026-10-16 유튜브식으로 다시). 맨 위 영상(지금 단계) → 제목·한 줄 정보 → 지금 단계 설명 → 단계 목록(챕터).
// 영상은 한 번에 하나만 돈다(소리 없음 · 반복). 단계 목록을 누르면 그 단계로 간다. 마지막 '정리'도 목록의 한 줄이다.
import React, { useState } from 'react';
import { Image, Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { T, Clay, Glyph } from './app-ui';
import type { Lesson, LessonAction } from '../constants/lessons';

const C = T;
function StepVideo({ source, width, height }: { source: number; width: number; height: number }) {
  const player = useVideoPlayer(source, p => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView testID="강좌 영상" player={player} nativeControls={false} contentFit="contain" style={{ width, height, backgroundColor: C.surface2 }} />;
}

export function LessonView({ lesson, onBack, onAction }: { lesson: Lesson; onBack: () => void; onAction: (a: LessonAction) => void }) {
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(0);
  const total = lesson.steps.length + 1;   // 마지막 = 정리
  const step = lesson.steps[at];
  // 플레이어: 화면 폭 가득(좌우 여백 16 을 넘어 붙인다). 높이는 화면의 50% 까지 — 아래 설명과 단계 목록이 함께 보이게.
  const playerW = width, playerH = Math.min(Math.round(width * 4 / 3), Math.round(height * .5));
  const mediaW = Math.min(playerW, Math.round(playerH * 3 / 4));
  const image = step?.image ?? (!step ? lesson.thumb : undefined);
  return <View testID="강좌 보기" style={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, marginLeft: -8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('ui.backLesson')} onPress={onBack} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><Glyph name="chevron-left" size={24} color={C.ink} /></Pressable>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.muted }}>{t('ui.lessons')}</Text>
    </View>
    {/* 플레이어 */}
    <View testID="강좌 플레이어" style={{ marginHorizontal: -16, width: playerW, height: step?.video ? playerH : undefined, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2 }}>
      {step?.video ? <StepVideo key={lesson.id + at} source={step.video} width={mediaW} height={playerH} />
        : image ? <Image accessibilityIgnoresInvertColors source={image} style={{ width: playerW, height: (() => { const r = Image.resolveAssetSource?.(image); return Math.min(r && r.width ? Math.round(playerW * r.height / r.width) : Math.round(playerW * 9 / 16), playerH); })() }} resizeMode="contain" />
        : <View style={{ width: playerW, height: Math.round(playerW * 9 / 16), alignItems: 'center', justifyContent: 'center', backgroundColor: C.accentSoft }}>
            <Text style={{ fontSize: 44, fontWeight: '800', color: C.yellowInk }}>{String(at + 1).padStart(2, '0')}</Text>
          </View>}
    </View>
    {/* 제목 · 한 줄 정보 */}
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={{ fontSize: 20, lineHeight: 27, fontWeight: '800', color: C.ink, letterSpacing: -.4 }}>{lesson.title}</Text>
      <Text style={{ fontSize: 13, color: C.muted }}>{t("release.d101", { v0: (lesson.minutes), v1: (lesson.steps.length), v2: (lesson.summary) })}</Text>
    </View>
    {/* 지금 단계 설명 */}
    {step ? <View style={{ gap: 6, padding: 16, borderRadius: 20, backgroundColor: C.surface2 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: C.pointInk }}>{`${at + 1}. ${step.title}`}</Text>
      <Text style={{ fontSize: 15, lineHeight: 23, color: C.ink }}>{step.body}</Text>
      {at < total - 1 && <Pressable accessibilityRole="button" accessibilityLabel={t("release.s0415")} onPress={() => setAt(at + 1)}
        style={{ alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 18, borderRadius: 22, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.pointSoft }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: C.pointInk }}>{at === total - 2 ? t("release.s0416") : t("release.s0415")}</Text>
        <Glyph name="chevron-right" size={18} color={C.pointInk} />
      </Pressable>}
    </View> : <View testID="강좌 정리" style={{ gap: 12 }}>
      <View style={{ borderRadius: C.radius.card, padding: 18, gap: 10, ...Clay.yellow }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: C.yellowInk }}>{t('ui.keyPoints')}</Text>
        {lesson.points.map((p, i) => <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}><Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>{i + 1}</Text></View>
          <Text style={{ flex: 1, fontSize: 16, lineHeight: 23, fontWeight: '700', color: C.ink }}>{p}</Text>
        </View>)}
      </View>
      {!!lesson.tryIt && <Pressable accessibilityRole="button" accessibilityLabel={lesson.tryIt.label} onPress={() => onAction(lesson.tryIt!.action)}
        style={({ pressed }) => ({ minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, ...(pressed ? Clay.buttonPressed : Clay.button) })}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.accentInk }}>{t("release.d102", { v0: (lesson.tryIt.label) })}</Text>
      </Pressable>}
      {!!lesson.youtube && <Pressable accessibilityRole="link" accessibilityLabel={t("release.s0418")} onPress={() => Linking.openURL(lesson.youtube!).catch(() => {})}
        style={{ minHeight: 48, borderRadius: C.radius.card, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{t("release.s0418")}</Text>
      </Pressable>}
    </View>}
    {/* 단계 목록(챕터): 누르면 그 단계로 */}
    <View testID="강좌 단계 목록" accessible={false} style={{ gap: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 4 }}>{t("release.s0420")}</Text>
      {[...lesson.steps.map(s => s.title), t("release.s0421")].map((title, i) => { const on = i === at;
        return <Pressable key={i} accessibilityRole="button" accessibilityLabel={t("release.d129", { v0: (i + 1), v1: (title) })} accessibilityState={{ selected: on }} onPress={() => setAt(i)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: 14, backgroundColor: on ? C.pointSoft : 'transparent' }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.point : i < at ? C.fillPressed : C.fill }}>
            {i < at ? <Glyph name="check" size={16} color={C.ink} /> : <Text style={{ fontSize: 13, fontWeight: '800', color: on ? '#FFFFFF' : C.ink }}>{i + 1}</Text>}
          </View>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: on ? '800' : '500', color: on ? C.pointInk : C.ink }}>{title}</Text>
          {i < lesson.steps.length && !!lesson.steps[i].video && <Glyph name="play-circle-outline" size={18} color={on ? C.pointInk : C.faint} />}
        </Pressable>; })}
    </View>
  </View>;
}
