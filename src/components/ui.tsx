import React from 'react';
import { View, Text, TextInput, StyleSheet, Image, Modal, Pressable, ScrollView } from 'react-native';
import { Host, Button } from '@expo/ui';
import { imageUri } from '../services/storage';
import type { LocalImage } from '../types';

const C = { bg: '#F7F4EE', paper: '#FFFDF9', ink: '#232323', muted: '#77736C', line: '#E7E1D7', coral: '#FF7A59' };

export function Action({ title, onPress, disabled = false, primary = false }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Host matchContents style={{ minHeight: primary ? 56 : 44 }}><Button onPress={onPress} disabled={disabled} variant={primary ? 'filled' : 'outlined'} label={title} style={{ height: primary ? 56 : 44 }} /></Host>;
}
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#0005', justifyContent: 'center', padding: 20 }}>
    <View accessibilityViewIsModal style={{ maxHeight: '82%', backgroundColor: C.paper, borderRadius: 24, padding: 16, gap: 8, borderWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.subtitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={{ padding: 12 }}><Text style={{ fontSize: 20 }}>×</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}><View style={{ gap: 12 }}>{children}</View></ScrollView>
    </View>
  </View></Modal>;
}
export function Field({ label, value, onChangeText, multiline = true }: { label: string; value: string; onChangeText: (s: string) => void; multiline?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && { minHeight: 76, textAlignVertical: 'top' }]} placeholder={`${label} 입력`} placeholderTextColor="#918B82" /></View>;
}
export function Preview({ image, label, size = 140 }: { image?: LocalImage; label: string; size?: number }) {
  return <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>{label}</Text><View style={{ height: size, backgroundColor: '#F0ECE5', borderRadius: 16, justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>{image ? <Image accessibilityLabel={label} source={{ uri: imageUri(image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={{ textAlign: 'center', color: C.muted }}>이미지 없음</Text>}</View></View>;
}
export const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 24, backgroundColor: C.bg },
  card: { padding: 14, gap: 8, backgroundColor: C.paper, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  title: { fontSize: 28, fontWeight: '900', color: C.ink },
  subtitle: { fontSize: 19, fontWeight: '800', color: C.ink },
  label: { fontSize: 13, fontWeight: '700', color: '#544F48' },
  input: { fontSize: 16, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, backgroundColor: '#FFFFFF', color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  muted: { color: C.muted, fontSize: 14, lineHeight: 21 },
});
