import type { ChatMessage, Conversation, DemoUser } from '../types';
import { getChatStickerById, getChatStickerIdFromToken } from '../utils/chatStickers';
import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';

type RawContact = {
  id?: string;
  name?: string;
  role?: string;
  adminRole?: string | null;
  avatar?: string;
  phone?: string;
  personalPhone?: string;
  zalo?: string;
};

type RawConversation = {
  conversationId?: string;
  otherUser?: { id?: string; name?: string; role?: string };
  lastMessage?: { content?: string; createdAt?: string };
  unreadCount?: number;
};

type RawMessage = {
  _id?: string;
  id?: string;
  content?: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  senderAdminRole?: string | null;
  senderAvatar?: string;
  sender?: {
    id?: string;
    role?: string;
    adminRole?: string | null;
    displayName?: string;
    avatar?: string;
  };
  createdAt?: string;
  isRead?: boolean;
  isRecalled?: boolean;
  recipientRejected?: boolean;
  messageType?: string;
  fileUrl?: string;
  fileName?: string;
  groupId?: string;
  updatedAt?: string;
  isPinned?: boolean;
  reactions?: Array<{ type?: string; userId?: string; userName?: string }>;
  payload?: {
    type?: string;
    sticker_id?: string;
    replyTo?: { id?: string; content?: string; messageType?: string };
  };
};

type RawGroup = {
  _id?: string;
  name?: string;
  participants?: Array<{ userId?: string; name?: string; role?: string }>;
  createdBy?: { userId?: string };
  updatedAt?: string;
  lastMessage?: { content?: string; senderName?: string; sentAt?: string };
  unreadCount?: number;
};

type RawPinnedConversations = {
  data?: string[];
};

const MOJIBAKE_RE = /\u00c3.|\u00e1\u00ba|\u00e1\u00bb|\u00c4|\u00c6\u00b0/;

export type ChatAttachmentUpload = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  file?: Blob;
};

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function fixMojibakeText(value: string) {
  if (!MOJIBAKE_RE.test(value) || value.includes('\uFFFD')) return value;
  try {
    const bytes = Array.from(value, (character) => `%${(character.charCodeAt(0) & 0xff).toString(16).padStart(2, '0')}`).join('');
    return decodeURIComponent(bytes);
  } catch {
    return value;
  }
}

function formatMessageTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function timestamp(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function contactCategory(role: string, adminRole?: string | null): Conversation['category'] {
  const ar = String(adminRole || '').toUpperCase();
  const r = role.toLowerCase();
  if (ar === 'SUPPORT' || r === 'support') return 'support';
  if (ar === 'STAFF' || r === 'staff' || r === 'recruitment') return 'recruitment';
  if (r === 'teacher') return 'teacher';
  if (r === 'student') return 'student';
  if (r === 'group') return 'group';
  if (r === 'admin') return 'admin';
  return 'support';
}

function roleLabel(role: string, adminRole?: string | null) {
  const ar = String(adminRole || '').toUpperCase();
  const r = role.toLowerCase();
  if (ar === 'SUPPORT' || r === 'support') return 'Hỗ trợ';
  if (ar === 'STAFF' || r === 'staff' || r === 'recruitment') return 'Tuyển sinh';
  if (r === 'teacher') return 'Giảng viên';
  if (r === 'student') return 'Học viên';
  if (r === 'group') return 'Nhóm';
  if (r === 'admin') return 'Admin';
  return 'Hỗ trợ';
}

function roleBadge(role: string, adminRole?: string | null) {
  const ar = String(adminRole || '').toUpperCase();
  const r = role.toLowerCase();
  if (ar === 'SUPPORT' || r === 'support') return 'HT';
  if (ar === 'STAFF' || r === 'staff' || r === 'recruitment') return 'NV';
  if (r === 'teacher') return 'GV';
  if (r === 'student') return 'HV';
  if (r === 'group') return 'GR';
  if (r === 'admin') return 'AD';
  return 'HT';
}

function roleColor(role: string, adminRole?: string | null) {
  const cat = contactCategory(role, adminRole);
  switch (cat) {
    case 'teacher': return '#F59E0B';
    case 'student': return '#0EA5E9';
    case 'recruitment': return '#64748B';
    case 'admin': return '#E11D48';
    case 'group': return '#EF4444';
    default: return '#2563EB';
  }
}

function avatarUri(value?: string) {
  const avatar = text(value);
  if (/^(https?:\/\/|data:image\/)/i.test(avatar)) return avatar;
  if (!avatar.startsWith('/')) return undefined;
  const apiBaseUrl = String(process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL || '').trim();
  return apiBaseUrl ? new URL(avatar, `${apiBaseUrl.replace(/\/+$/, '')}/`).toString() : undefined;
}

export function buildDirectConversationId(user: Pick<DemoUser, 'id' | 'role'>, contactId: string, contactRole: string) {
  const normalizedRole = contactRole.toLowerCase();
  const parts = user.role === 'student' && normalizedRole === 'admin'
    ? ['admin_admin', `student_${user.id}`]
    : [`${user.role}_${user.id}`, `${normalizedRole}_${contactId}`];
  return parts.sort().join('__');
}

const reactionTypeToEmoji: Record<string, string> = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
  wow: '😲',
  sad: '😭',
  angry: '😡',
};

const reactionEmojiToType: Record<string, string> = Object.fromEntries(
  Object.entries(reactionTypeToEmoji).map(([type, emoji]) => [emoji, type]),
);

export function getChatReactionEmoji(type: string) {
  return reactionTypeToEmoji[type];
}

export function getChatReactionType(emoji: string) {
  return reactionEmojiToType[emoji];
}

function mapReactions(value: RawMessage['reactions']): ChatMessage['reactions'] {
  return Array.isArray(value)
    ? value
      .filter((reaction) => typeof reaction?.type === 'string' && typeof reaction?.userId === 'string')
      .map((reaction) => ({
        type: reaction.type!,
        userId: reaction.userId!,
        ...(reaction.userName ? { userName: reaction.userName } : {}),
      }))
    : [];
}

export function getCurrentUserReaction(reactions: ChatMessage['reactions'], userId: string) {
  const reaction = reactions?.find((item) => item.userId === userId);
  return reaction ? reactionTypeToEmoji[reaction.type] : undefined;
}

export function mapLiveReaction(value: unknown, userId: string) {
  const reactions = mapReactions(Array.isArray(value) ? value : undefined);
  return { reactions, reaction: getCurrentUserReaction(reactions, userId) };
}

function mapMessage(raw: RawMessage, user: DemoUser, index: number): ChatMessage {
  const messageType = text(raw.messageType, 'text');
  const reactions = mapReactions(raw.reactions);
  const replyToContent = text(
    raw.payload?.replyTo?.content,
    raw.payload?.replyTo?.messageType === 'image' ? '[Hình ảnh]' : raw.payload?.replyTo?.messageType ? '[Tệp đính kèm]' : '',
  );
  const stickerId = raw.payload?.type === 'sticker' && raw.payload.sticker_id
    ? getChatStickerById(raw.payload.sticker_id)?.id
    : getChatStickerIdFromToken(text(raw.content));
  const content = fixMojibakeText(text(raw.content));
  const attachmentName = fixMojibakeText(text(raw.fileName, 'Tệp đính kèm'));
  const fallbackAttachmentName = messageType === 'file' && content.startsWith('Đã gửi tệp: ')
    ? content.slice('Đã gửi tệp: '.length).trim()
    : '';
  const hasInvalidAttachmentName = /[\u0000-\u001f\u007f\ufffd]/.test(attachmentName);
  const fileName = hasInvalidAttachmentName && fallbackAttachmentName
    ? fallbackAttachmentName
    : attachmentName;
  const timestampMs = timestamp(raw.createdAt);
  return {
    id: text(raw._id || raw.id, `message-${index}`),
    messageType,
    text: stickerId
      || (messageType === 'image' && content === '[Hình ảnh]')
      || (messageType === 'file' && content.startsWith('Đã gửi tệp:'))
      ? ''
      : content,
    time: formatMessageTime(raw.createdAt),
    ...(timestampMs !== undefined ? { timestampMs } : {}),
    mine: String(raw.senderId || raw.sender?.id || '') === user.id,
    senderId: text(raw.senderId || raw.sender?.id),
    senderName: text(raw.senderName || raw.sender?.displayName),
    senderRole: text(raw.senderRole || raw.sender?.role),
    senderAdminRole: raw.senderAdminRole || raw.sender?.adminRole || null,
    ...(text(raw.senderAvatar || raw.sender?.avatar)
      ? { senderAvatarUri: resolveMobilePublicUrl(text(raw.senderAvatar || raw.sender?.avatar)) }
      : {}),
    reactions,
    reaction: getCurrentUserReaction(reactions, user.id),
    pinned: Boolean(raw.isPinned),
    ...(raw.payload?.replyTo?.id ? {
      replyTo: {
        id: String(raw.payload.replyTo.id),
        content: replyToContent,
        ...(raw.payload.replyTo.messageType ? { messageType: raw.payload.replyTo.messageType } : {}),
      },
      replyToText: replyToContent,
    } : {}),
    ...(stickerId ? { stickerId } : {}),
    ...(raw.isRead ? { state: 'read' as const } : {}),
    ...(raw.isRecalled ? { recalled: true } : {}),
    ...(raw.recipientRejected ? { recipientRejected: true } : {}),
    ...(messageType === 'image' || messageType === 'file'
      ? {
          attachmentType: messageType,
          attachmentName: fileName,
          attachmentUrl: raw.fileUrl ? resolveMobilePublicUrl(raw.fileUrl) : undefined,
        }
      : {}),
  };
}

export async function getMessageContacts(user: DemoUser): Promise<Conversation[]> {
  if (!user.id || user.previewMode) {
    throw new Error('Danh bạ cần phiên đăng nhập thật. Vui lòng đăng nhập bằng tài khoản của bạn.');
  }
  const [contactsPayload, conversationsPayload, groupsPayload, pinnedPayload] = await Promise.all([
    mobileApiRequest<{ data?: RawContact[] }>('/messages/contacts'),
    mobileApiRequest<{ data?: RawConversation[] }>(`/messages/conversations/${encodeURIComponent(user.id)}`),
    mobileApiRequest<{ data?: RawGroup[] }>(`/messages/groups/user/${encodeURIComponent(user.id)}`),
    mobileApiRequest<RawPinnedConversations>('/messages/pinned-conversations'),
  ]);
  if (!Array.isArray(contactsPayload.data)
    || !Array.isArray(conversationsPayload.data)
    || !Array.isArray(groupsPayload.data)
    || !Array.isArray(pinnedPayload.data)) {
    throw new Error('Máy chủ trả về danh bạ, cuộc trò chuyện hoặc nhóm không hợp lệ.');
  }
  const pinnedConversations = new Set(pinnedPayload.data.map(String));

  const conversationByContact = new Map(
    conversationsPayload.data
      .filter((item) => item.otherUser?.id)
      .map((item) => [String(item.otherUser?.id), item]),
  );

  const directConversations = contactsPayload.data
    .filter((contact) => Boolean(contact.id && contact.role))
    .map((contact) => {
      const rawRole = text(contact.role);
      const adminRole = contact.adminRole || null;
      const history = conversationByContact.get(String(contact.id));
      const cat = contactCategory(rawRole, adminRole);
      const conversationId = history?.conversationId || buildDirectConversationId(user, String(contact.id), rawRole);
      return {
        id: conversationId,
        name: text(contact.name, 'Người dùng'),
        role: roleLabel(rawRole, adminRole),
        adminRole,
        category: cat,
        roleBadge: roleBadge(rawRole, adminRole),
        isPinned: pinnedConversations.has(conversationId),
        lastMessage: text(history?.lastMessage?.content, 'Bắt đầu cuộc trò chuyện'),
        time: history ? formatMessageTime(history.lastMessage?.createdAt) : '',
        lastActivityAt: timestamp(history?.lastMessage?.createdAt),
        unread: Number.isFinite(Number(history?.unreadCount)) ? Number(history?.unreadCount) : 0,
        color: roleColor(rawRole, adminRole),
        avatarUri: avatarUri(contact.avatar),
        phone: text(contact.phone || contact.personalPhone),
        zalo: text(contact.zalo),
        participantId: String(contact.id),
        participantRole: rawRole.toLowerCase(),
        online: false,
      };
    });
  const groupConversations = groupsPayload.data
    .filter((group) => (
      Boolean(group._id && group.name)
      && group.participants?.some((participant) => String(participant.userId || '') === user.id)
    ))
    .map((group) => {
      const lastActivity = group.lastMessage?.sentAt || group.updatedAt;
      if (typeof group.unreadCount !== 'number' || !Number.isInteger(group.unreadCount) || group.unreadCount < 0) {
        throw new Error('Máy chủ trả về số tin nhắn chưa đọc của nhóm không hợp lệ.');
      }
      const conversationId = `group_${group._id}`;
      return {
        id: conversationId,
        name: text(group.name, 'Nhóm chat'),
        role: `Nhóm chat · ${(group.participants || []).length} thành viên`,
        category: 'group' as const,
        roleBadge: 'GR',
        isPinned: pinnedConversations.has(conversationId),
        participantId: String(group._id),
        participantRole: 'group',
        groupCreatorId: text(group.createdBy?.userId),
        groupParticipants: (group.participants || [])
          .filter((participant) => participant.userId && participant.name && participant.role)
          .map((participant) => ({
            userId: String(participant.userId),
            name: String(participant.name),
            role: String(participant.role),
          })),
        lastMessage: text(group.lastMessage?.content, 'Bắt đầu cuộc trò chuyện nhóm'),
        time: formatMessageTime(lastActivity),
        lastActivityAt: timestamp(lastActivity),
        unread: group.unreadCount,
        color: '#EF4444',
        online: false,
      };
    });
  return [...directConversations, ...groupConversations];
}

export async function getMessageThread(conversationId: string, user: DemoUser): Promise<ChatMessage[]> {
  const payload = await mobileApiRequest<{ data?: RawMessage[] }>(`/messages/${encodeURIComponent(conversationId)}`);
  if (!Array.isArray(payload.data)) throw new Error('Máy chủ trả về nội dung cuộc trò chuyện không hợp lệ.');
  return payload.data.map((message, index) => mapMessage(message, user, index));
}

export async function markConversationRead(conversationId: string) {
  await mobileApiRequest(`/messages/read/${encodeURIComponent(conversationId)}`, { method: 'PUT' });
}

export async function uploadChatAttachment(attachment: ChatAttachmentUpload) {
  const formData = new FormData();
  if (attachment.file) {
    formData.append('file', attachment.file, attachment.name);
  } else {
    const filePart = {
      uri: attachment.uri,
      name: attachment.name,
      type: attachment.mimeType || 'application/octet-stream',
    } as unknown as Blob;
    formData.append('file', filePart);
  }
  const payload = await mobileApiRequest<{ url?: string; name?: string }>('/messages/upload', {
    method: 'POST',
    body: formData,
  });
  if (!payload.url) throw new Error('Máy chủ không trả về liên kết tệp đã tải lên.');
  return {
    url: payload.url,
    name: text(payload.name, attachment.name),
    messageType: attachment.mimeType.startsWith('image/') ? 'image' as const : 'file' as const,
  };
}

export async function createMessageGroup(
  name: string,
  members: Conversation[],
): Promise<Conversation> {
  const participants = members.map((member) => {
    if (!member.participantId || !member.participantRole) {
      throw new Error(`Không thể thêm ${member.name} vào nhóm vì thiếu thông tin tài khoản.`);
    }
    return { userId: member.participantId, name: member.name, role: member.participantRole };
  });
  const payload = await mobileApiRequest<{ data?: RawGroup }>('/messages/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), participants }),
  });
  if (!payload.data?._id) throw new Error('Máy chủ không xác nhận nhóm chat đã tạo.');
  const group = payload.data;
  return {
    id: `group_${group._id}`,
    name: text(group.name, name),
    role: `Nhóm chat · ${(group.participants || []).length} thành viên`,
    category: 'group',
    roleBadge: 'GR',
    participantId: String(group._id),
    participantRole: 'group',
    lastMessage: 'Nhóm chat mới',
    time: 'Vừa xong',
    unread: 0,
    color: '#EF4444',
  };
}

export async function addMessageGroupMembers(
  groupId: string,
  members: Conversation[],
) {
  const participants = members.map((member) => {
    if (!member.participantId || !member.participantRole) {
      throw new Error(`Không thể thêm ${member.name} vào nhóm vì thiếu thông tin tài khoản.`);
    }
    return { userId: member.participantId, name: member.name, role: member.participantRole };
  });
  if (!participants.length) throw new Error('Vui lòng chọn ít nhất một thành viên.');
  await mobileApiRequest(`/messages/groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participants }),
  });
}

export async function leaveMessageGroup(groupId: string) {
  await mobileApiRequest(`/messages/groups/${encodeURIComponent(groupId)}/leave`, { method: 'POST' });
}

export async function deleteMessageGroup(groupId: string) {
  await mobileApiRequest(`/messages/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
}

export function mapLiveChatMessage(raw: Record<string, unknown>, user: DemoUser): ChatMessage {
  return mapMessage(raw as RawMessage, user, Date.now());
}

export async function sendChatMessage(
  conversation: Conversation,
  user: DemoUser,
  content: string,
  attachment?: { url: string; name: string; messageType: 'image' | 'file' },
  replyTo?: ChatMessage,
) {
  const groupId = conversation.id.startsWith('group_')
    ? conversation.id.slice('group_'.length)
    : '';
  if (!groupId && (!conversation.participantId || !conversation.participantRole)) {
    throw new Error('Không thể gửi tin nhắn: thiếu thông tin người nhận.');
  }
  const isAiSupport = String(conversation.participantId || '') === 'ai_support';
  const payload = await mobileApiRequest<{ data?: RawMessage }>(
    isAiSupport ? '/ai-support/message' : '/messages',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiverId: groupId || conversation.participantId,
        receiverName: conversation.name,
        receiverRole: isAiSupport ? 'system' : groupId ? 'group' : conversation.participantRole,
        content,
        messageType: attachment?.messageType || 'text',
        ...(attachment ? { fileUrl: attachment.url, fileName: attachment.name } : {}),
        ...(groupId ? { isGroup: true, groupId, conversationId: conversation.id } : {}),
        ...(isAiSupport ? { conversationId: conversation.id } : {}),
        ...(replyTo ? {
          payload: {
            replyTo: {
              id: replyTo.id,
              content: replyTo.text || replyTo.attachmentName || (replyTo.stickerId ? '[Sticker]' : ''),
              ...(replyTo.attachmentType ? { messageType: replyTo.attachmentType } : {}),
            },
          },
        } : {}),
      }),
    },
  );
  if (!payload.data) throw new Error('Máy chủ không xác nhận tin nhắn đã gửi.');
  return mapMessage(payload.data, user, Date.now());
}

export async function searchChatMessages(conversationId: string, user: DemoUser, query: string) {
  const params = new URLSearchParams({
    q: query,
    conversationId,
  });
  const payload = await mobileApiRequest<{ data?: RawMessage[] }>(
    `/messages/search/${encodeURIComponent(user.id)}?${params.toString()}`,
  );
  if (!Array.isArray(payload.data)) throw new Error('Máy chủ trả về kết quả tìm kiếm không hợp lệ.');
  return payload.data.reverse().map((message, index) => mapMessage(message, user, index));
}

export async function reactToChatMessage(messageId: string, emoji: string, user: DemoUser) {
  const type = getChatReactionType(emoji);
  if (!type) throw new Error('Cảm xúc này chưa được hỗ trợ.');
  const payload = await mobileApiRequest<{ data?: RawMessage['reactions'] }>(
    `/messages/${encodeURIComponent(messageId)}/reaction`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    },
  );
  return mapLiveReaction(payload.data, user.id);
}

export async function recallChatMessage(messageId: string) {
  await mobileApiRequest(`/messages/${encodeURIComponent(messageId)}/recall`, { method: 'PATCH' });
}

export async function deleteChatMessageForMe(messageId: string) {
  await mobileApiRequest(`/messages/${encodeURIComponent(messageId)}/soft-delete`, { method: 'PATCH' });
}

export async function togglePinnedChatMessage(conversationId: string, messageId: string) {
  await mobileApiRequest(`/messages/${encodeURIComponent(conversationId)}/pin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  });
}

export async function setPinnedConversation(conversationId: string, pinned: boolean) {
  await mobileApiRequest(`/messages/pin-conversation/${encodeURIComponent(conversationId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned }),
  });
}
