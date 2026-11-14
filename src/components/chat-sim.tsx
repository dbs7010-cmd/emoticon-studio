// 채팅에서 써 보기(2026-10-13 사용자 요청). 진짜 채팅이 아니다 — 이 세트로 만든 이모티콘을 대화 속에 넣어 보며
// 크기·표정·말투가 대화에 어울리는지 본다. 아무것도 보내거나 저장하지 않는다(화면을 닫으면 대화는 사라진다).
// - 특정 메신저 화면을 흉내 내지 않는다(색·모양은 emoti 토큰). 밝은/어두운 바탕을 바꿔 투명 테두리·흰 외곽도 확인한다.
// - 이모티콘을 누르면 입력창 위에 미리 보이고, 보내기를 눌러야 대화에 들어간다. '나 / 친구'로 누가 보낸 말인지 고른다.
import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImtiIcon, IconSize } from '../design/icons';
import { T } from './ui';

export type ChatSticker = { number: number; uri: string };
type Who = 'me' | 'friend';
type Message = { id: number; who: Who; text?: string; sticker?: ChatSticker };

const DARK = { bg: '#24221F', bubbleMe: '#F5E642', bubbleFriend: '#3A3733', ink: '#F7F6F3', inkOnMe: '#1F1D1A', muted: '#A8A29A' };
const LIGHT = { bg: T.surface2, bubbleMe: T.accent, bubbleFriend: T.paper, ink: T.ink, inkOnMe: T.accentInk, muted: T.muted };

export function ChatSim({ visible, setName, stickers, onClose }: { visible: boolean; setName: string; stickers: ChatSticker[]; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, who: 'friend', text: '뭐 해? 오늘 하루 어땠어?' }]);
  const [text, setText] = useState('');
  const [who, setWho] = useState<Who>('me');
  const [tray, setTray] = useState(true);
  const [picked, setPicked] = useState<ChatSticker | null>(null);
  const [dark, setDark] = useState(false);
  const seq = useRef(1);
  const list = useRef<ScrollView>(null);
  const c = dark ? DARK : LIGHT;

  const send = () => {
    const body = text.trim();
    if (!body && !picked) return;
    const next: Message[] = [];
    if (picked) next.push({ id: seq.current++, who, sticker: picked });
    if (body) next.push({ id: seq.current++, who, text: body });
    setMessages(m => [...m, ...next]); setText(''); setPicked(null);
  };
  const reset = () => { setMessages([{ id: 0, who: 'friend', text: '뭐 해? 오늘 하루 어땠어?' }]); setPicked(null); setText(''); };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: T.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 머리줄: 뒤로 · 제목 · 바탕 바꾸기 · 처음부터 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4, gap: 2, borderBottomWidth: 1, borderColor: T.line }}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}>
            <ImtiIcon name="back" size={IconSize.tool} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: T.ink }}>채팅에서 써 보기</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: T.muted }}>{setName} · 연습용이라 아무에게도 보내지지 않아요</Text>
          </View>
          <Pressable accessibilityRole="switch" accessibilityLabel="어두운 바탕" accessibilityState={{ checked: dark }} onPress={() => setDark(!dark)}
            style={({ pressed }) => ({ height: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center', backgroundColor: dark ? T.ink : pressed ? T.fillPressed : T.fill })}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: dark ? T.paper : T.ink }}>{dark ? '어두운 바탕' : '밝은 바탕'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="대화 처음부터" onPress={reset} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}>
            <ImtiIcon name="restore" size={IconSize.tool} />
          </Pressable>
        </View>

        {/* 대화 */}
        <ScrollView ref={list} style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }} onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}>
          {messages.map(m => { const mine = m.who === 'me';
            return <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {!mine && <Text style={{ fontSize: 12, color: c.muted, marginBottom: 4, marginLeft: 4 }}>친구</Text>}
              {m.sticker
                ? <Image accessibilityLabel={`${m.sticker.number}번 이모티콘`} source={{ uri: m.sticker.uri }} style={{ width: 120, height: 120 }} resizeMode="contain" />
                : <View style={{ maxWidth: '78%', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 16, borderTopRightRadius: mine ? 4 : 16, borderTopLeftRadius: mine ? 16 : 4, backgroundColor: mine ? c.bubbleMe : c.bubbleFriend }}>
                    <Text style={{ fontSize: 15, lineHeight: 21, color: mine ? c.inkOnMe : c.ink }}>{m.text}</Text>
                  </View>}
            </View>; })}
        </ScrollView>

        {/* 고른 이모티콘 미리보기(보내기 전) */}
        {picked && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: T.paper, borderTopWidth: 1, borderColor: T.line }}>
          <Image source={{ uri: picked.uri }} style={{ width: 72, height: 72 }} resizeMode="contain" />
          <Text style={{ flex: 1, fontSize: 13, color: T.muted }}>{picked.number}번 · 보내기를 누르면 대화에 들어가요</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="고른 이모티콘 빼기" onPress={() => setPicked(null)} style={{ width: T.tap, height: T.tap, alignItems: 'center', justifyContent: 'center' }}>
            <ImtiIcon name="close" size={IconSize.row} color={T.muted} />
          </Pressable>
        </View>}

        {/* 입력 줄: 누가 · 글 · 이모티콘 판 · 보내기 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: T.paper, borderTopWidth: picked ? 0 : 1, borderColor: T.line }}>
          <Pressable accessibilityRole="button" accessibilityLabel={who === 'me' ? '보내는 사람: 나' : '보내는 사람: 친구'} onPress={() => setWho(who === 'me' ? 'friend' : 'me')}
            style={({ pressed }) => ({ height: 40, minWidth: 52, paddingHorizontal: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: who === 'me' ? T.accentSoft : pressed ? T.fillPressed : T.fill })}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: T.ink }}>{who === 'me' ? '나' : '친구'}</Text>
          </Pressable>
          <TextInput value={text} onChangeText={setText} placeholder="말을 적어 보세요" placeholderTextColor={T.faint} onFocus={() => setTray(false)} onSubmitEditing={send} returnKeyType="send"
            style={{ flex: 1, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: T.surface2, fontSize: 15, color: T.ink }} />
          <Pressable accessibilityRole="button" accessibilityLabel={tray ? '이모티콘 판 닫기' : '이모티콘 판 열기'} onPress={() => setTray(!tray)}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tray ? T.accentSoft : pressed ? T.fillPressed : 'transparent' })}>
            <ImtiIcon name="sticker" size={IconSize.tool} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="보내기" disabled={!text.trim() && !picked} onPress={send}
            style={({ pressed }) => ({ height: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: !text.trim() && !picked ? T.fill : pressed ? T.accentLine : T.accent })}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: !text.trim() && !picked ? T.faint : T.accentInk }}>보내기</Text>
          </Pressable>
        </View>

        {/* 이모티콘 판: 이 세트에서 그린 칸(움직이는 칸은 움직이는 그림으로) */}
        {tray && <View style={{ height: 232, backgroundColor: T.paper, borderTopWidth: 1, borderColor: T.line }}>
          {stickers.length
            ? <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8 }}>
                {stickers.map(s => <Pressable key={s.number} accessibilityRole="button" accessibilityLabel={`${s.number}번 이모티콘 고르기`} accessibilityState={{ selected: picked?.number === s.number }} onPress={() => setPicked(s)}
                  style={({ pressed }) => ({ width: '25%', aspectRatio: 1, padding: 6, borderRadius: 12, backgroundColor: picked?.number === s.number ? T.accentSoft : pressed ? T.fill : 'transparent' })}>
                  <Image source={{ uri: s.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                </Pressable>)}
              </ScrollView>
            : <Text style={{ padding: 24, textAlign: 'center', fontSize: 14, color: T.muted }}>아직 그린 칸이 없어요. 칸을 하나 그리면 여기에 나와요.</Text>}
        </View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
