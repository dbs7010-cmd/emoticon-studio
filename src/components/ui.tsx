import React from 'react';
import { View, Text, TextInput, StyleSheet, Image, Modal, Pressable, ScrollView } from 'react-native';
import { Host, Button } from '@expo/ui';
import { imageUri } from '../services/storage';
import type { LocalImage } from '../types';

export function Action({ title, onPress, disabled = false, primary = false }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Host matchContents style={{ minHeight: primary ? 56 : 44 }}><Button onPress={onPress} disabled={disabled} variant={primary ? 'filled' : 'outlined'} label={title} style={{ height: primary ? 56 : 44 }} /></Host>;
}
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 20 }}>
    <View accessibilityViewIsModal style={{ maxHeight: '80%', backgroundColor: '#fafbf8', borderRadius: 16, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.subtitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={{ padding: 12 }}><Text style={{ fontSize: 20 }}>×</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}><View style={{ gap: 12 }}>{children}</View></ScrollView>
    </View>
  </View></Modal>;
}
export function Field({ label, value, onChangeText, multiline = true }: { label: string; value: string; onChangeText: (s: string) => void; multiline?: boolean }) {
  return <View style={{ gap: 6 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && { minHeight: 76, textAlignVertical: 'top' }]} placeholder={`${label} 입력`} placeholderTextColor="#89857d" /></View>;
}
export function Preview({ image, label, size = 140 }: { image?: LocalImage; label: string; size?: number }) {
  return <View style={{ flex: 1, gap: 6 }}><Text style={styles.label}>{label}</Text><View style={{ height: size, backgroundColor: '#e0e3e6', borderRadius: 12, justifyContent: 'center' }}>{image ? <Image accessibilityLabel={label} source={{ uri: imageUri(image.path) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <Text style={{ textAlign: 'center', color: '#6d6b65' }}>이미지 없음</Text>}</View></View>;
}
export const styles = StyleSheet.create({
  page: { padding: 12, gap: 10, paddingBottom: 20 },
  card: { padding: 12, gap: 8, backgroundColor: '#fff', borderRadius: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#282923' },
  subtitle: { fontSize: 19, fontWeight: '700', color: '#30372e' },
  label: { fontSize: 14, fontWeight: '600', color: '#4c5349' },
  input: { fontSize: 16, borderWidth: 1, borderColor: '#cdd1c6', borderRadius: 10, padding: 12, backgroundColor: '#fafbf8', color: '#222' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  muted: { color: '#66695f', fontSize: 14, lineHeight: 21 },
});
