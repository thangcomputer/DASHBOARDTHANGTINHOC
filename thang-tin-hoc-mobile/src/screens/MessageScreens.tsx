import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { FileText, ImagePlus, Paperclip, Plus, Send, Smile } from 'lucide-react-native';
import { AppHeader, AppScreen, Avatar, Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton, SearchField } from '../components/ui';
import { useAuth } from '../app/AuthContext';
import { messageService } from '../services/mockService';
import { useMockResource } from '../hooks/useMockResource';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import type { ChatMessage, Conversation } from '../types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function MessagesScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'student' | 'teacher' | 'recruitment' | 'admin' | 'support' | 'group'>('all');
  const [createdGroups, setCreatedGroups] = useState<Conversation[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const categoryFilters: { id: typeof category; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    ...(user?.role === 'teacher'
      ? [{ id: 'student' as const, label: 'Học viên' }, { id: 'admin' as const, label: 'Admin' }, { id: 'recruitment' as const, label: 'Tuyển sinh' }]
      : [{ id: 'teacher' as const, label: 'Giảng viên' }, { id: 'recruitment' as const, label: 'Tuyển sinh' }]),
    { id: 'support', label: 'Hỗ trợ' },
    { id: 'group', label: 'Nhóm' },
  ];
  const loader = useCallback(() => messageService.conversations(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const resource = useMockResource(loader);
  const baseConversations = [...createdGroups, ...(resource.data || [])];
  const availableMembers = (resource.data || []).filter((item) => item.category !== 'group');
  const groupCandidates = availableMembers.filter((item) =>
    `${item.name} ${item.role}`.toLocaleLowerCase('vi-VN').includes(memberSearch.trim().toLocaleLowerCase('vi-VN')));
  const conversations = baseConversations.filter((item) => (
    (category === 'all' || item.category === category)
    && `${item.name} ${item.lastMessage}`.toLowerCase().includes(query.toLowerCase())
  ));

  return (
    <AppScreen>
      <AppHeader title={isTeacher ? 'Hộp thư' : 'Tin nhắn'} subtitle="Trao đổi với lớp học và trung tâm" />
      <SearchField value={query} onChangeText={setQuery} placeholder="Tìm họ, tên, tên đệm, SĐT..." />
      {isTeacher ? (
        <Pressable onPress={() => setShowCreateGroup(true)} style={styles.createGroupButton} accessibilityRole="button" accessibilityLabel="Tạo nhóm chat">
          <Plus size={17} color={colors.brand} />
          <Text style={styles.createGroupText}>Tạo nhóm chat</Text>
        </Pressable>
      ) : null}
      <View style={styles.filters}>
          {categoryFilters.map((filter) => (
            <Pressable
              key={filter.id}
              onPress={() => setCategory(filter.id)}
              style={[styles.filterChip, category === filter.id && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: category === filter.id }}
            >
              <Text style={[styles.filterText, category === filter.id && styles.filterTextActive]}>{filter.label}</Text>
            </Pressable>
          ))}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !conversations.length ? <EmptyState title="Chưa có cuộc trò chuyện" message="Tin nhắn mới sẽ xuất hiện tại đây." /> : null}
      {!resource.loading && !resource.error && conversations.map((conversation) => (
        <Pressable
          key={conversation.id}
          onPress={() => navigation.navigate('Conversation', { conversationId: conversation.id, conversationName: conversation.name })}
          accessibilityRole="button"
          accessibilityLabel={`Mở cuộc trò chuyện với ${conversation.name}`}
        >
          <Card style={styles.conversation}>
            <Avatar name={conversation.name} color={conversation.color} />
            <View style={styles.conversationCopy}>
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{conversation.name}</Text>
                <Text style={styles.time}>{conversation.time}</Text>
              </View>
              <Text style={styles.role}>{conversation.role}</Text>
              {conversation.online !== undefined ? (
                <Text style={[styles.onlineStatus, conversation.online ? styles.online : styles.offline]}>
                  {conversation.online ? '● Đang hoạt động' : '● Ngoại tuyến'}
                </Text>
              ) : null}
              <View style={styles.rowBetween}>
                <Text numberOfLines={1} style={styles.preview}>{conversation.lastMessage}</Text>
                {conversation.unread ? <View style={styles.unread}><Text style={styles.unreadText}>{conversation.unread}</Text></View> : null}
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
      <Modal visible={isTeacher && showCreateGroup} transparent animationType="slide" onRequestClose={() => setShowCreateGroup(false)}>
        <View style={styles.groupModalBackdrop}>
          <View style={styles.groupModal}>
            <View style={styles.rowBetween}>
              <Text style={styles.title}>Tạo nhóm chat mới</Text>
              <Pressable onPress={() => setShowCreateGroup(false)} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Đóng tạo nhóm"><Text style={styles.createGroupText}>Đóng</Text></Pressable>
            </View>
            <Text style={styles.role}>Tên nhóm</Text>
            <TextInput value={groupName} onChangeText={setGroupName} placeholder="Ví dụ: Nhóm học tập" style={styles.messageInput} />
            <Text style={styles.role}>Chọn thành viên ({selectedMembers.length})</Text>
            <SearchField value={memberSearch} onChangeText={setMemberSearch} placeholder="Tìm họ, tên, SĐT..." />
            <ScrollView style={styles.memberList}>
              {groupCandidates.map((member) => {
                const selected = selectedMembers.includes(member.id);
                return (
                  <Pressable key={member.id} onPress={() => setSelectedMembers((current) => selected ? current.filter((id) => id !== member.id) : [...current, member.id])} style={styles.memberRow} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
                    <Avatar name={member.name} color={member.color} size={34} />
                    <View style={styles.conversationCopy}>
                      <Text style={styles.title}>{member.name}</Text>
                      <Text style={styles.role}>{member.role}</Text>
                    </View>
                    <Text style={[styles.memberCheck, selected && styles.memberCheckSelected]}>{selected ? '✓' : ''}</Text>
                  </Pressable>
                );
              })}
              {!groupCandidates.length ? <EmptyState title="Không có thành viên" message="Không tìm thấy người phù hợp trong dữ liệu demo." /> : null}
            </ScrollView>
            <Text style={styles.note}>Nhóm chỉ được thêm vào danh sách demo trên thiết bị này; không tạo nhóm hoặc gửi lời mời thật.</Text>
            <PrimaryButton title="Tạo nhóm demo" disabled={!groupName.trim() || selectedMembers.length < 2} onPress={() => {
              if (selectedMembers.length < 2 || !groupName.trim()) {
                Alert.alert('Thiếu thông tin', 'Nhập tên nhóm và chọn ít nhất hai thành viên.');
                return;
              }
              const participants = availableMembers.filter((member) => selectedMembers.includes(member.id));
              if (participants.length < 2) {
                Alert.alert('Chưa đủ thành viên', 'Chọn ít nhất hai thành viên còn trong danh sách.');
                return;
              }
              setCreatedGroups((current) => [{
                id: `teacher-group-${Date.now()}`,
                name: groupName.trim(),
                role: `Nhóm · ${participants.map((member) => member.name).join(', ')}`,
                category: 'group',
                online: false,
                lastMessage: 'Nhóm chat mới',
                time: 'Vừa xong',
                unread: 0,
                color: colors.blueSoft,
              }, ...current]);
              setCategory('group');
              setGroupName('');
              setMemberSearch('');
              setSelectedMembers([]);
              setShowCreateGroup(false);
            }} />
            <PrimaryButton title="Hủy bỏ" variant="quiet" onPress={() => setShowCreateGroup(false)} />
          </View>
        </View>
      </Modal>
      <Text style={styles.note}>Tài khoản demo: {user?.name}. Tin nhắn không kết nối Socket.IO.</Text>
    </AppScreen>
  );
}

export function ConversationScreen() {
  const route = useRoute<NativeStackScreenProps<AppStackParamList, 'Conversation'>['route']>();
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const threadLoader = useCallback(
    () => messageService.thread(route.params.conversationId, user?.role === 'teacher' ? 'teacher' : 'student'),
    [route.params.conversationId, user?.role],
  );
  const resource = useMockResource(threadLoader);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'sticker' | 'gif' | 'reaction' | 'attachment' | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<{ name: string; type: 'image' | 'file' } | null>(null);
  const threadRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const thread = messages || resource.data || [];
  const conversationName = route.params.conversationName || 'Cuộc trò chuyện';

  const send = () => {
    const text = draft.trim();
    if (!text && !selectedAttachment) return;
    setMessages((current) => [
      ...(current || resource.data || []),
      {
        id: `local-${Date.now()}`,
        text,
        time: 'Vừa xong',
        mine: true,
        ...(isTeacher ? { state: 'sent' as const } : {}),
        replyToText: replyingTo?.text,
        ...(selectedAttachment ? { attachmentName: selectedAttachment.name, attachmentType: selectedAttachment.type } : {}),
      },
    ]);
    setDraft('');
    setReplyingTo(null);
    setSelectedAttachment(null);
  };

  const addDemoAttachment = (name: string, type: 'image' | 'file') => {
    setMessages((current) => [
      ...(current || resource.data || []),
      { id: `local-file-${Date.now()}`, text: '', time: 'Vừa xong', mine: true, attachmentName: name, attachmentType: type, state: 'sent' },
    ]);
    setPicker(null);
  };

  const addDemoSticker = () => {
    setMessages((current) => [
      ...(current || resource.data || []),
      { id: `local-sticker-${Date.now()}`, text: '', sticker: '👍', time: 'Vừa xong', mine: true, state: 'sent' },
    ]);
    setPicker(null);
  };

  const addDemoGif = (label: string) => {
    setMessages((current) => [
      ...(current || resource.data || []),
      { id: `local-gif-${Date.now()}`, text: '', time: 'Vừa xong', mine: true, gifLabel: label, attachmentType: 'gif', state: 'sent' },
    ]);
    setPicker(null);
  };

  const reactToLatest = (reaction: string) => {
    const latest = [...thread].reverse().find((message) => !message.mine);
    if (!latest) {
      Alert.alert('Chưa có tin nhắn', 'Cần có tin nhắn nhận được để thả cảm xúc.');
      setPicker(null);
      return;
    }
    setMessages((current) => (current || resource.data || []).map((message) => (
      message.id === latest.id ? { ...message, reaction } : message
    )));
    setPicker(null);
  };

  const handleMessageMenu = (message: ChatMessage) => {
    Alert.alert('Tùy chọn tin nhắn', 'Chọn thao tác demo', [
      { text: 'Trả lời', onPress: () => setReplyingTo(message) },
      { text: 'Thả cảm xúc', onPress: () => setMessages((current) => (current || resource.data || []).map((item) => item.id === message.id ? { ...item, reaction: item.reaction ? undefined : '👍' } : item)) },
      { text: pinnedId === message.id ? 'Bỏ ghim' : 'Ghim tin nhắn', onPress: () => setPinnedId(pinnedId === message.id ? null : message.id) },
      ...(message.mine ? [{ text: 'Thu hồi', style: 'destructive' as const, onPress: () => setMessages((current) => (current || resource.data || []).map((item) => item.id === message.id ? { ...item, recalled: true } : item)) }] : []),
      { text: 'Đóng', style: 'cancel' },
    ]);
  };

  useEffect(() => {
    if (!resource.loading) threadRef.current?.scrollToEnd({ animated: true });
  }, [resource.loading, thread.length]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}>
      <AppScreen scroll={false} contentStyle={styles.chatScreen}>
        <AppHeader
          title={conversationName}
          subtitle="Cuộc trò chuyện demo · Nhấn giữ tin nhắn để thao tác"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          ref={threadRef}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: true })}
        >
          {resource.loading ? <LoadingSkeleton rows={2} /> : null}
          {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
          {!resource.loading && !resource.error && !thread.length ? <EmptyState title="Bắt đầu cuộc trò chuyện" message="Gửi lời chào đầu tiên nhé." /> : null}
          {!resource.loading && !resource.error && thread.map((message) => (
            <Pressable key={message.id} onLongPress={() => handleMessageMenu(message)} delayLongPress={350} accessibilityRole="button" accessibilityLabel="Tùy chọn tin nhắn">
            <View style={[styles.messageLine, message.mine && styles.messageLineMine]}>
              {!message.mine ? <Avatar name={conversationName} size={30} color="#F6E9D9" /> : null}
              <View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleOther, pinnedId === message.id && styles.pinnedBubble]}>
                {message.replyToText ? <Text style={[styles.replyPreview, message.mine && styles.messageTimeMine]}>↪ {message.replyToText}</Text> : null}
                {message.sticker ? <Text style={styles.sticker}>{message.sticker}</Text> : null}
                {message.gifLabel ? <View style={styles.chatGif}><Text style={styles.chatGifText}>GIF</Text><Text style={styles.messageText}>{message.gifLabel}</Text></View> : null}
                {message.text ? <Text style={[styles.messageText, message.mine && styles.messageTextMine]}>{message.recalled ? 'Tin nhắn đã được thu hồi' : message.text}</Text> : null}
                {message.attachmentName ? <View style={styles.chatAttachment}>{message.attachmentType === 'image' ? <ImagePlus size={18} color={message.mine ? '#FFFFFF' : colors.brand} /> : <FileText size={18} color={message.mine ? '#FFFFFF' : colors.brand} />}<Text style={[styles.attachmentName, message.mine && styles.messageTextMine]}>{message.attachmentName}</Text></View> : null}
                {message.reaction ? <Text style={styles.reaction}>{message.reaction}</Text> : null}
                <Text style={[styles.messageTime, message.mine && styles.messageTimeMine]}>{message.time}{isTeacher && message.state ? ` · ${message.state === 'read' ? 'Đã xem' : message.state === 'delivered' ? 'Đã nhận' : 'Đã gửi'}` : ''}</Text>
              </View>
            </View>
            </Pressable>
          ))}
        </ScrollView>
        {replyingTo ? (
          <View style={styles.replyBar}>
            <Text numberOfLines={1} style={styles.replyBarText}>Trả lời: {replyingTo.recalled ? 'Tin nhắn đã được thu hồi' : replyingTo.text}</Text>
            <Pressable onPress={() => setReplyingTo(null)} accessibilityRole="button" accessibilityLabel="Hủy trả lời"><Text style={styles.cancelReply}>×</Text></Pressable>
          </View>
        ) : null}
        {selectedAttachment ? (
          <View style={styles.replyBar}>
            <Text numberOfLines={1} style={styles.replyBarText}>Tệp đã chọn: {selectedAttachment.name}</Text>
            <Pressable onPress={() => setSelectedAttachment(null)} accessibilityRole="button" accessibilityLabel="Bỏ tệp đã chọn"><Text style={styles.cancelReply}>×</Text></Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable
            onPress={() => setPicker('attachment')}
            style={styles.attachButton}
            accessibilityRole="button"
            accessibilityLabel="Chọn ảnh hoặc tệp demo"
          >
            <Paperclip size={19} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => setPicker('reaction')} style={styles.attachButton} accessibilityRole="button" accessibilityLabel="Thả cảm xúc">
            <Smile size={19} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => setPicker('sticker')}
            style={styles.attachButton}
            accessibilityRole="button"
            accessibilityLabel="Chọn sticker demo"
          >
            <Smile size={19} color={colors.muted} />
          </Pressable>
          <Pressable onPress={() => setPicker('gif')} style={styles.gifButton} accessibilityRole="button" accessibilityLabel="Chọn GIF demo"><Text style={styles.gifButtonText}>GIF</Text></Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={colors.muted}
            style={styles.messageInput}
            multiline
            maxLength={500}
            accessibilityLabel="Nhập tin nhắn demo"
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() && !selectedAttachment}
            style={[styles.sendButton, !draft.trim() && !selectedAttachment && styles.sendButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn demo"
            accessibilityState={{ disabled: !draft.trim() && !selectedAttachment }}
          >
            <Send size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerCard}>
              <View style={styles.rowBetween}><Text style={styles.title}>{picker === 'attachment' ? 'Ảnh và tệp đính kèm' : picker === 'reaction' ? 'Thả cảm xúc' : picker === 'gif' ? 'GIF demo' : 'Sticker demo'}</Text><Pressable onPress={() => setPicker(null)} accessibilityRole="button"><Text style={styles.createGroupText}>Đóng</Text></Pressable></View>
              {picker === 'attachment' ? (
                <>
                  <Pressable style={styles.pickerOption} onPress={() => { setSelectedAttachment({ name: 'Anh-minh-hoa-demo.jpg', type: 'image' }); setPicker(null); }}><ImagePlus size={18} color={colors.brand} /><Text style={styles.role}>Chọn ảnh mẫu</Text></Pressable>
                  <Pressable style={styles.pickerOption} onPress={() => { setSelectedAttachment({ name: 'Tai-lieu-demo.pdf', type: 'file' }); setPicker(null); }}><FileText size={18} color={colors.brand} /><Text style={styles.role}>Chọn tệp mẫu</Text></Pressable>
                  {selectedAttachment ? <Pressable style={styles.pickerOption} onPress={() => setSelectedAttachment(null)}><Text style={styles.role}>Bỏ tệp đang chọn</Text></Pressable> : null}
                </>
              ) : null}
              {picker === 'sticker' ? <View style={styles.pickerOptions}>{['👍', '😊', '🎉', '❤️'].map((sticker) => <Pressable key={sticker} style={styles.stickerOption} onPress={() => { addDemoSticker(); setMessages((current) => (current || resource.data || []).map((message, index, all) => index === all.length - 1 ? { ...message, sticker } : message)); }}><Text style={styles.sticker}>{sticker}</Text></Pressable>)}</View> : null}
              {picker === 'gif' ? <View style={styles.pickerOptions}>{['Vỗ tay', 'Chúc mừng', 'Cảm ơn'].map((gif) => <Pressable key={gif} style={styles.gifOption} onPress={() => addDemoGif(gif)}><Text style={styles.chatGifText}>GIF</Text><Text style={styles.role}>{gif} · minh họa</Text></Pressable>)}</View> : null}
              {picker === 'reaction' ? <View style={styles.pickerOptions}>{['👍', '❤️', '😂', '😮', '😢', '🙏'].map((reaction) => <Pressable key={reaction} style={styles.stickerOption} onPress={() => reactToLatest(reaction)}><Text style={styles.sticker}>{reaction}</Text></Pressable>)}</View> : null}
              <Text style={styles.note}>Chỉ là lựa chọn cục bộ trong bản demo; không tải hoặc truyền tệp/GIF thật.</Text>
            </View>
          </View>
        </Modal>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  chatScreen: { flex: 1, paddingBottom: spacing.sm },
  conversation: { flexDirection: 'row', alignItems: 'center' },
  createGroupButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  createGroupText: { color: colors.brand, fontSize: typography.small, fontWeight: '700' },
  groupModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  groupModal: { maxHeight: '88%', gap: spacing.md, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  closeButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.sm },
  memberList: { maxHeight: 260, borderTopWidth: 1, borderTopColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line },
  memberRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  memberCheck: { width: 24, height: 24, textAlign: 'center', textAlignVertical: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 6, color: colors.muted, overflow: 'hidden' },
  memberCheckSelected: { color: '#FFFFFF', backgroundColor: colors.brand, borderColor: colors.brand },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filterChip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: spacing.md, justifyContent: 'center' },
  filterChipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  filterText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  conversationCopy: { flex: 1, gap: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { color: colors.ink, fontSize: typography.body, fontWeight: '700', flexShrink: 1 },
  time: { color: colors.muted, fontSize: typography.caption },
  role: { color: colors.brand, fontSize: typography.caption, fontWeight: '600' },
  onlineStatus: { fontSize: 10, fontWeight: '700' },
  online: { color: colors.green },
  offline: { color: colors.muted },
  preview: { color: colors.muted, fontSize: typography.small, flex: 1 },
  unread: { minWidth: 20, height: 20, borderRadius: radius.pill, paddingHorizontal: 5, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  note: { color: colors.muted, fontSize: typography.caption, textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
  thread: { paddingVertical: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  messageLine: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  messageLineMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 5 },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 5 },
  pinnedBubble: { borderWidth: 2, borderColor: colors.gold },
  messageText: { color: colors.ink, fontSize: typography.body, lineHeight: 21 },
  replyPreview: { color: colors.muted, fontSize: typography.caption, fontStyle: 'italic' },
  attachmentName: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  reaction: { alignSelf: 'flex-end', fontSize: 16 },
  sticker: { fontSize: 38, lineHeight: 46 },
  messageTextMine: { color: '#FFFFFF' },
  messageTime: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end' },
  messageTimeMine: { color: '#D2ECEA' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  attachButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  messageInput: { flex: 1, maxHeight: 110, minHeight: 42, paddingVertical: 10, color: colors.ink, fontSize: typography.body },
  sendButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  replyBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.brandSoft, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  replyBarText: { flex: 1, color: colors.brandDark, fontSize: typography.caption, fontWeight: '600' },
  cancelReply: { color: colors.brandDark, fontSize: 24, paddingHorizontal: spacing.sm },
  gifButton: { height: 40, minWidth: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.canvas },
  gifButtonText: { color: colors.brand, fontSize: 10, fontWeight: '900' },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  pickerCard: { gap: spacing.md, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  pickerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pickerOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.canvas },
  stickerOption: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.canvas },
  gifOption: { minWidth: 90, minHeight: 76, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.canvas },
  chatGif: { minWidth: 112, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.goldSoft },
  chatGifText: { color: colors.brand, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  chatAttachment: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
