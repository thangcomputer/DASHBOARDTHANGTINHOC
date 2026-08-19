import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { buildConversationId } from '../utils/chatConversationId';
import { useSocket } from './SocketContext';
import { loadState } from './dataStorage';
import { getMessagingRole } from '../lib/messagingRoles';
import { resolveMessagingActor, normalizeMessage } from '../lib/messagingIdentity';
import { sortConversationsByLastMessageAt } from '../lib/conversationList';
import { isAiSupportConversationId } from '../utils/aiSupport';

/**
 * Messages / groups state, socket listeners, and messaging API for DataProvider.
 */
export function useDataMessaging({ currentUser, students, teachers, staffs, triggerBackgroundSync }) {
  const [messages, setMessages] = useState(() => loadState('thvp_messages', []));
  const [groups, setGroups] = useState(() => loadState('thvp_groups', []));

  const {
    onGroupNew, onRecallReceive, onReactionReceive, onMessageReceive, onMessageSent, onReadAck,
  } = useSocket();

  // Strip null entries that may exist in legacy localStorage caches
  useEffect(() => {
    setMessages((prev) => {
      if (!Array.isArray(prev)) return prev;
      const next = prev.filter(Boolean);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const upsertServerMessage = useCallback((data) => {
    if (!data?._id && !data?.id) return;
    const serverId = String(data._id || data.id);
    setMessages((prev) => {
      if (prev.some((m) => String(m.id) === serverId)) {
        // Already present (other tab / prior HTTP) — drop matching temp only
        return prev.filter((m) => !(String(m.id).startsWith('temp_')
          && String(m.convId) === String(data.conversationId)
          && String(m.content || '') === String(data.content || '')
          && String(m.messageType || 'text') === String(data.messageType || 'text')
          && String(m.fileUrl || '') === String(data.fileUrl || '')));
      }

      const n = normalizeMessage(data);
      const mappedMsg = {
        id: n.id,
        convId: n.conversationId,
        senderId: n.senderId,
        senderName: n.senderName,
        senderRole: n.senderRole,
        senderAvatar: n.senderAvatar,
        sender: n.sender,
        receiverId: n.receiverId,
        receiverName: n.receiverName,
        receiverRole: n.receiverRole,
        receiverAvatar: n.receiverAvatar,
        receiver: n.receiver,
        content: n.content,
        time: n.time instanceof Date ? n.time : new Date(n.time || Date.now()),
        read: n.read,
        isGroup: n.isGroup,
        groupId: n.groupId,
        isRecalled: n.isRecalled,
        messageType: n.messageType,
        fileName: n.fileName,
        fileUrl: n.fileUrl,
        fileExpired: n.fileExpired,
        aiImageRemaining: n.aiImageRemaining,
        reactions: n.reactions,
      };

      const tempIdx = prev.findIndex(
        (m) =>
          String(m.id).startsWith('temp_') &&
          String(m.convId) === String(data.conversationId) &&
          String(m.content || '') === String(data.content || '') &&
          String(m.messageType || 'text') === String(data.messageType || 'text') &&
          String(m.fileUrl || '') === String(data.fileUrl || '') &&
          String(m.fileName || '') === String(data.fileName || ''),
      );
      if (tempIdx !== -1) {
        const updated = [...prev];
        updated[tempIdx] = mappedMsg;
        return updated;
      }
      return [...prev, mappedMsg];
    });
  }, []);

  useEffect(() => {
    let unsubGroup, unsubRecall, unsubMsg, unsubSent;

    if (onGroupNew) {
      unsubGroup = onGroupNew((newGroup) => {
        setGroups((prev) => {
          if (prev.some((g) => g._id === newGroup._id)) return prev;
          return [newGroup, ...prev];
        });
      });
    }

    if (onRecallReceive) {
      unsubRecall = onRecallReceive((data) => {
        setMessages((prev) => prev.map((m) =>
          (String(m.id || m._id) === String(data.messageId) || String(m.id) === String(data.messageId))
            ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' } : m
        ));
      });
    }

    let unsubReaction;
    if (onReactionReceive) {
      unsubReaction = onReactionReceive((data) => {
        setMessages((prev) => prev.map((m) =>
          String(m.id) === String(data.messageId) ? { ...m, reactions: data.reactions } : m
        ));
      });
    }

    if (onMessageReceive) {
      unsubMsg = onMessageReceive((data) => upsertServerMessage(data));
    }
    if (onMessageSent) {
      // Multi-tab same sender: message:sent carries persisted _id
      unsubSent = onMessageSent((data) => upsertServerMessage(data));
    }

    let unsubRead;
    if (onReadAck) {
      unsubRead = onReadAck((data) => {
        const convId = data?.conversationId;
        if (!convId) return;
        setMessages((prev) => {
          let changed = false;
          const next = prev.map((m) => {
            if (String(m.convId) !== String(convId) || m.read === true) return m;
            changed = true;
            return { ...m, read: true };
          });
          return changed ? next : prev;
        });
      });
    }

    return () => {
      if (unsubGroup) unsubGroup();
      if (unsubRecall) unsubRecall();
      if (unsubReaction) unsubReaction();
      if (unsubMsg) unsubMsg();
      if (unsubSent) unsubSent();
      if (unsubRead) unsubRead();
    };
  }, [onGroupNew, onRecallReceive, onMessageReceive, onMessageSent, onReactionReceive, onReadAck, upsertServerMessage, currentUser]);

  useEffect(() => {
    try {
      const capped = messages.length > 2000 ? messages.slice(-2000) : messages;
      localStorage.setItem('thvp_messages', JSON.stringify(capped));
    } catch { /* localStorage quota exceeded — ignore */ }
  }, [messages]);
  useEffect(() => { localStorage.setItem('thvp_groups', JSON.stringify(groups)); }, [groups]);

  // Gửi tin nhắn qua API → lưu MongoDB → phát Socket.io
  const sendMessage = useCallback(async (msg) => {
    const tempId = `temp_${Date.now()}`;
    const convId = msg.conversationId || (msg.isGroup && msg.groupId
      ? `group_${msg.groupId}`
      : buildConversationId(msg.senderRole, msg.senderId, msg.receiverRole, msg.receiverId));
    const newMsg = {
      id: tempId,
      convId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderRole: msg.senderRole,
      receiverId: msg.receiverId,
      receiverName: msg.receiverName,
      receiverRole: msg.receiverRole,
      content: msg.content,
      messageType: msg.messageType || 'text',
      fileUrl: msg.fileUrl || '',
      fileName: msg.fileName || '',
      time: new Date(),
      read: false,
      isRecalled: false,
      reactions: [],
    };
    setMessages(prev => [...prev, newMsg]);

    // Gửi lên backend lưu vào MongoDB → thay tempId bằng _id thật
    try {
      const res = await api.messages.send({
        conversationId: convId,
        senderId: String(msg.senderId),
        senderName: msg.senderName,
        senderRole: msg.senderRole,
        receiverId: String(msg.receiverId),
        receiverName: msg.receiverName,
        receiverRole: msg.receiverRole,
        content: msg.content,
        messageType: msg.messageType || 'text',
        fileUrl: msg.fileUrl || '',
        fileName: msg.fileName || '',
        isGroup: msg.isGroup || false,
        groupId: msg.groupId || null,
      });
      if (res?.success && res?.data?._id) {
        const d = res.data;
        const n = normalizeMessage(d);
        setMessages((prev) => {
          // Primary dedupe key: server _id (HTTP + socket race)
          if (prev.some((m) => String(m.id) === String(d._id))) {
            return prev.filter((m) => m.id !== tempId);
          }
          const merged = prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: n.id,
                  convId: n.conversationId || m.convId,
                  senderId: n.senderId,
                  senderName: n.senderName,
                  senderRole: n.senderRole,
                  senderAvatar: n.senderAvatar,
                  sender: n.sender,
                  receiverId: n.receiverId,
                  receiverName: n.receiverName,
                  receiverRole: n.receiverRole,
                  receiverAvatar: n.receiverAvatar,
                  receiver: n.receiver,
                  content: n.content,
                  messageType: n.messageType || m.messageType,
                  fileUrl: n.fileUrl || m.fileUrl,
                  fileName: n.fileName || m.fileName,
                  aiImageRemaining: n.aiImageRemaining ?? m.aiImageRemaining,
                  time: n.time instanceof Date ? n.time : new Date(n.time || m.time),
                  read: n.read ?? m.read,
                }
              : m
          );
          const seen = new Set();
          return merged.filter((m) => {
            const id = String(m.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        });
        return { ...newMsg, id: res.data._id };
      }
    } catch (err) {
      const failMsg = err?.message || 'Gửi tin nhắn thất bại';
      setMessages((prev) => prev.map((m) => (
        m.id === tempId
          ? { ...m, failed: true, failReason: failMsg, code: err?.code || err?.data?.code }
          : m
      )));
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('cms:toast', {
            detail: { type: 'error', message: failMsg },
          }));
        } catch { /* ignore */ }
      }
      return { ...newMsg, failed: true, failReason: failMsg };
    }
    return newMsg;
  }, []);

  const syncMessages = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const json = await api.messages.syncByUser(userId);
      if (json.success) {
        const syncedMsgs = (json.data || []).map((m) => {
          const n = normalizeMessage(m);
          const convId = m.isGroup && m.groupId
            ? `group_${m.groupId}`
            : (n.conversationId || m.conversationId);
          return {
            id: n.id,
            convId,
            groupId: n.groupId,
            isGroup: n.isGroup,
            senderId: n.senderId,
            senderName: n.senderName,
            senderRole: n.senderRole,
            senderAvatar: n.senderAvatar,
            sender: n.sender,
            receiverId: n.receiverId,
            receiverName: n.receiverName,
            receiverRole: n.receiverRole,
            receiverAvatar: n.receiverAvatar,
            receiver: n.receiver,
            content: n.content,
            messageType: n.messageType,
            fileUrl: n.fileUrl,
            fileName: n.fileName,
            fileExpired: n.fileExpired,
            aiImageRemaining: n.aiImageRemaining,
            time: n.time instanceof Date ? n.time : new Date(m.createdAt || Date.now()),
            read: n.read,
            isRecalled: n.isRecalled,
            reactions: n.reactions,
          };
        });

        // Server là nguồn đúng (kể cả isRead). Chỉ giữ tin temp_* chưa lên server.
        // Tránh badge "chưa đọc" từ localStorage cũ khi đã đọc trên server.
        setMessages(prev => {
          const localById = new Map(prev.map(m => [String(m.id), m]));
          const merged = syncedMsgs.map(sm => {
            const local = localById.get(String(sm.id));
            return {
              ...sm,
              // Đã đọc local (optimistic) hoặc server đều tính là đã đọc
              read: Boolean(sm.read) || Boolean(local?.read),
            };
          });
          const serverIds = new Set(syncedMsgs.map(m => String(m.id)));
          const temps = prev.filter(m => String(m.id).startsWith('temp_') && !serverIds.has(String(m.id)));
          return [...merged, ...temps].sort((a, b) => new Date(a.time) - new Date(b.time));
        });
      }
    } catch (err) {
    }
  }, []);

  const toggleMessageReaction = useCallback(async (messageId, type) => {
    try {
      const json = await api.messages.toggleReaction(messageId, type);
      if (json.success) {
        setMessages((prev) => prev.map((m) =>
          String(m.id || m._id) === String(messageId) ? { ...m, reactions: json.data } : m
        ));
      }
    } catch (err) {
    }
  }, []);

  const recallMessage = useCallback(async (messageId) => {
    const json = await api.messages.recall(messageId);
    if (json.success) {
      setMessages(prev => prev.map(m =>
        String(m.id || m._id) === String(messageId) ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' } : m
      ));
    } else {
      throw new Error(json.message || 'Không thể thu hồi tin nhắn');
    }
  }, []);

  const softDeleteMessage = useCallback(async (messageId) => {
    try {
      const json = await api.messages.softDelete(messageId);
      if (json.success) {
        // Chỉ ẩn/xóa khỏi mảng cục bộ trên giao diện của user này
        setMessages(prev => prev.filter(m => String(m.id || m._id) !== String(messageId)));
      }
    } catch (err) {
    }
  }, []);

  const createChatGroup = useCallback(async (name, participants) => {
    try {
      const json = await api.messages.createGroup(name, participants);
      if (json.success) {
        setGroups(prev => [json.data, ...prev]);
        triggerBackgroundSync();
        return json.data;
      }
    } catch (err) {
    }
    return null;
  }, [triggerBackgroundSync]);

  const deleteChatGroup = useCallback(async (groupId) => {
    try {
      const json = await api.messages.deleteGroup(groupId);
      if (json.success) {
        setGroups(prev => prev.filter(g => String(g._id) !== String(groupId) && String(g.id) !== String(groupId)));
        setMessages(prev => prev.filter(m => m.convId !== `group_${groupId}`));
        triggerBackgroundSync();
        return true;
      }
    } catch (err) {
    }
    return false;
  }, [triggerBackgroundSync]);

  const leaveChatGroup = useCallback(async (groupId) => {
    try {
      const json = await api.messages.leaveGroup(groupId);
      if (json.success) {
        setGroups(prev => prev.filter(g => String(g._id) !== String(groupId) && String(g.id) !== String(groupId)));
        setMessages(prev => prev.filter(m => m.convId !== `group_${groupId}`));
        triggerBackgroundSync();
        return true;
      }
    } catch (err) {
    }
    return false;
  }, [triggerBackgroundSync]);

  const addGroupMembers = useCallback(async (groupId, participants) => {
    try {
      const json = await api.messages.addGroupMembers(groupId, participants);
      if (json.success) {
        setGroups(prev => prev.map(g => String(g._id) === String(groupId) ? json.data : g));
        triggerBackgroundSync();
        return true;
      }
    } catch (err) {
    }
    return false;
  }, [triggerBackgroundSync]);

  const markMessagesRead = useCallback(async (convId, readerId, extraReceiverIds = []) => {
    if (!convId) return;
    // extraReceiverIds giữ tương thích caller (admin mailbox); server tự suy receiverTargets từ token
    void extraReceiverIds;

    setMessages(prev => {
      let changed = false;
      const next = prev.map(m => {
        if (String(m.convId) !== String(convId) || m.read === true) return m;
        changed = true;
        return { ...m, read: true };
      });
      return changed ? next : prev;
    });

    // Luôn gọi API (idempotent) — tránh lệch badge khi local/server không khớp
    try {
      await api.messages.markRead(convId, readerId);
    } catch (err) {
    }
  }, []);

  const getConversations = useCallback((userId) => {
    const sId = String(userId);
    const safeStudents = Array.isArray(students) ? students.filter(Boolean) : [];
    const safeTeachers = Array.isArray(teachers) ? teachers.filter(Boolean) : [];
    const safeStaffs = Array.isArray(staffs) ? staffs.filter(Boolean) : [];
    const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];
    const isSupportStaff = currentUser?.role === 'staff'
      || currentUser?.adminRole === 'STAFF'
      || currentUser?.adminRole === 'SUPPORT'
      || safeStaffs.some(st => String(st.id || st._id) === sId);
    const isSuperAdmin = sId === 'admin'
      || currentUser?.adminRole === 'SUPER_ADMIN'
      || currentUser?.adminRole === 'HIGH_ADMIN'
      || (safeTeachers.find(t => String(t.id) === sId)?.adminRole === 'SUPER_ADMIN')
      || (safeTeachers.find(t => String(t.id) === sId)?.adminRole === 'HIGH_ADMIN');
    const userRole = getMessagingRole(currentUser || { id: sId })
      || (safeStudents.find(s => String(s.id) === sId) ? 'student' : 'teacher');

    const userMsgs = safeMessages.filter(m => {
      const isDirect = String(m.senderId) === sId || String(m.receiverId) === sId;
      // Legacy shared admin mailbox — SUPER/HIGH only (not STAFF/SUPPORT)
      const isAdminMailbox = isSuperAdmin && (String(m.senderId) === 'admin' || String(m.receiverId) === 'admin');
      return isDirect || isAdminMailbox;
    });
    const convMap = {};

    // 1. Add existing conversations from messages
    userMsgs.forEach(m => {
      if (isAiSupportConversationId(m.convId)) return;
      const mTime = new Date(m.time).getTime();
      const existing = convMap[m.convId];
      const existingTime = existing ? new Date(existing.lastTime).getTime() : 0;

      if (!existing || mTime > existingTime) {
        const isMeSender = String(m.senderId) === sId
          || (isSuperAdmin && String(m.senderId) === 'admin');

        const isViewerStaffOrAdmin = isSupportStaff || sId === 'admin' || isSuperAdmin || currentUser?.role === 'staff' || currentUser?.role === 'admin';
        const otherUserId = isMeSender ? m.receiverId : m.senderId;
        const otherRole = isMeSender ? m.receiverRole : m.senderRole;

        // Bỏ qua hội thoại tự chat với chính mình / peer ảo AI
        if (String(otherUserId) === String(sId) || String(otherUserId) === 'ai_support') return;

        // Không ẩn DM theo students/teachers/staffs local — directory thiếu theo role
        // (Admin students=[] đến khi mở tab HV; GV teachers=[self]). Ghost cleanup: purge orphans + Inbox contacts.

        // Phase 8.21: resolve by participant ID. NEVER map otherRole==="admin" → SUPER profile.
        const peerHintName = isMeSender ? m.receiverName : m.senderName;
        const actor = resolveMessagingActor(
          {
            id: otherUserId,
            role: otherRole,
            name: peerHintName,
            avatar: isMeSender
              ? (m.receiverAvatar || m.receiver?.avatar)
              : (m.senderAvatar || m.sender?.avatar),
            adminRole: isMeSender ? m.receiver?.adminRole : m.sender?.adminRole,
            displayRole: isMeSender ? m.receiver?.displayRole : m.sender?.displayRole,
            displayName: isMeSender
              ? (m.receiver?.displayName || m.receiverName)
              : (m.sender?.displayName || m.senderName),
          },
          { teachers: safeTeachers, students: safeStudents, staffs: safeStaffs },
        );

        const matchedStudent = safeStudents.find(s => String(s.id || s._id) === String(otherUserId));
        const matchedTeacher = safeTeachers.find(t => String(t.id || t._id) === String(otherUserId));
        const matchedStaff = safeStaffs.find(st => String(st.id || st._id) === String(otherUserId));
        const finalGender = matchedStudent?.gender || matchedTeacher?.gender || matchedStaff?.gender || '';

        const finalName = actor.displayName;
        const finalRole = actor.role;
        const finalAdminRole = actor.adminRole;
        const finalAvatar = actor.avatar || String(finalName || 'H').substring(0, 2).toUpperCase();

        // Ưu tiên lấy branchCode trực tiếp từ tin nhắn (nếu có), nếu không mới tìm trong list local
        let branchCode = isMeSender ? m.receiverBranchCode : m.senderBranchCode;

        if (!branchCode) {
          if (finalRole === 'teacher') {
            const t = safeTeachers.find(t => String(t.id) === String(otherUserId));
            branchCode = t?.branchCode || '';
          } else if (finalRole === 'student') {
            const s = safeStudents.find(s => String(s.id) === String(otherUserId));
            branchCode = s?.branchCode || '';
          } else if (finalRole === 'admin' || finalRole === 'staff') {
            const st = safeStaffs.find(st => String(st.id) === String(otherUserId) || String(st._id) === String(otherUserId));
            branchCode = st?.branchCode || '';
          }
        }

        convMap[m.convId] = {
          id: m.convId,
          user: {
            id: otherUserId,
            name: finalName,
            role: finalRole,
            adminRole: finalAdminRole,
            gender: finalGender,
            avatar: finalAvatar || String(finalName || 'H').substring(0, 2).toUpperCase(),
            online: true,
            branchCode: branchCode
          },
          lastMessage: m.content,
          lastTime: m.time,
          unread: (() => {
            const seen = new Set();
            let n = 0;
            for (const um of userMsgs) {
              if (um.convId !== m.convId) continue;
              if (!(String(um.receiverId) === sId || (isSuperAdmin && String(um.receiverId) === 'admin'))) continue;
              if (um.read === true) continue;
              const id = String(um.id);
              if (seen.has(id)) continue;
              seen.add(id);
              n += 1;
            }
            return n;
          })(),
        };
      }
    });

    // Phase 6: contact discovery is server-authoritative via GET /api/messages/contacts.
    // Do NOT seed unauthorized peers from local students/teachers/staffs arrays.
    // Conversation list here = message activity (+ groups below) only.

    // 3. Add Groups
    if (groups && Array.isArray(groups)) {
      groups.filter(g => g && g._id).filter(g => g.participants?.some(p => String(p.userId) === sId)).forEach(g => {
        const groupMsgs = safeMessages.filter(m => String(m.groupId) === String(g._id));
        const lastMsg = groupMsgs.reduce((best, m) => {
          if (!best) return m;
          return new Date(m.time).getTime() > new Date(best.time).getTime() ? m : best;
        }, null);
        const convId = `group_${g._id}`;

        convMap[convId] = {
          id: convId,
          isGroup: true,
          user: { id: g._id, name: g.name, role: 'group', avatar: 'GN', online: true },
          lastMessage: lastMsg ? lastMsg.content : 'Bắt đầu cuộc trò chuyện nhóm',
          lastTime: lastMsg ? lastMsg.time : new Date(g.createdAt || 0),
          unread: groupMsgs.filter(m => m.read !== true && String(m.senderId) !== sId).length,
        };
      });
    }

    // Ai nhắn sau → lên đầu (immutable — không sort tại chỗ trên shared state)
    return sortConversationsByLastMessageAt(Object.values(convMap));
  }, [messages, students, teachers, staffs, groups, currentUser]);

  const getMessages = useCallback((convId) => {
    const id = String(convId || '');
    return messages
      .filter((m) => m && (String(m.convId || '') === id || String(m.conversationId || '') === id))
      .sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
  }, [messages]);

  return {
    messages, setMessages, groups, setGroups,
    sendMessage, syncMessages, toggleMessageReaction, recallMessage,
    softDeleteMessage, createChatGroup, deleteChatGroup, leaveChatGroup, addGroupMembers,
    markMessagesRead, getConversations, getMessages,
  };
}
