import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { playMessageSound } from '../utils/sound';
import { isMessageFromSelf } from '../lib/messagingRoles';
import { buildConversationId } from '../utils/chatConversationId';
import { useSocket } from './SocketContext';
import { loadState } from './dataStorage';

/**
 * Messages / groups state, socket listeners, and messaging API for DataProvider.
 */
export function useDataMessaging({ currentUser, students, teachers, staffs, triggerBackgroundSync }) {
  const [messages, setMessages] = useState(() => loadState('thvp_messages', []));
  const [groups, setGroups] = useState(() => loadState('thvp_groups', []));

  const {
    onGroupNew, onRecallReceive, onReactionReceive, onMessageReceive, onReadAck,
  } = useSocket();

  // Strip null entries that may exist in legacy localStorage caches
  useEffect(() => {
    setMessages((prev) => {
      if (!Array.isArray(prev)) return prev;
      const next = prev.filter(Boolean);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  useEffect(() => {
    let unsubGroup, unsubRecall, unsubMsg;

    if (onGroupNew) {
      unsubGroup = onGroupNew((newGroup) => {
        setGroups(prev => {
          if (prev.some(g => g._id === newGroup._id)) return prev;
          return [newGroup, ...prev];
        });
      });
    }

    if (onRecallReceive) {
      unsubRecall = onRecallReceive((data) => {
        setMessages(prev => prev.map(m =>
          String(m.id) === String(data.messageId) ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' } : m
        ));
      });
    }

    let unsubReaction;
    if (onReactionReceive) {
      unsubReaction = onReactionReceive((data) => {
        setMessages(prev => prev.map(m =>
          String(m.id) === String(data.messageId) ? { ...m, reactions: data.reactions } : m
        ));
      });
    }

    if (onMessageReceive) {
      unsubMsg = onMessageReceive((data) => {
        if (!isMessageFromSelf(data, currentUser)) {
          playMessageSound();
        }
        setMessages(prev => {
          if (prev.some(m => String(m.id) === String(data._id))) return prev;

          const mappedMsg = {
            id: data._id,
            convId: data.conversationId,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            receiverId: data.receiverId,
            receiverName: data.receiverName,
            receiverRole: data.receiverRole,
            content: data.content,
            time: new Date(data.createdAt || Date.now()),
            read: data.isRead || false,
            isGroup: data.isGroup || false,
            groupId: data.groupId,
            isRecalled: data.isRecalled || false,
            messageType: data.messageType || 'text',
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            fileExpired: data.fileExpired || false,
            reactions: data.reactions || [],
          };

          // Ghép tin tạm (optimistic): server chuẩn hoá senderId='admin' khi staff/admin nhắn HV
          // nên không được so khớp senderId với bản temp (vẫn là id staff thật).
          const tempIdx = prev.findIndex(
            (m) =>
              String(m.id).startsWith('temp_') &&
              String(m.convId) === String(data.conversationId) &&
              String(m.content || '') === String(data.content || '') &&
              String(m.messageType || 'text') === String(data.messageType || 'text') &&
              String(m.fileUrl || '') === String(data.fileUrl || '') &&
              String(m.fileName || '') === String(data.fileName || '')
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = mappedMsg;
            return updated;
          }
          return [...prev, mappedMsg];
        });
      });
    }

    let unsubRead;
    if (onReadAck) {
      unsubRead = onReadAck((data) => {
        setMessages(prev => prev.map(m =>
          m.convId === data.conversationId ? { ...m, read: true } : m
        ));
      });
    }

    return () => {
      if (unsubGroup) unsubGroup();
      if (unsubRecall) unsubRecall();
      if (unsubReaction) unsubReaction();
      if (unsubMsg) unsubMsg();
      if (unsubRead) unsubRead();
    };
  }, [onGroupNew, onRecallReceive, onMessageReceive, onReactionReceive, currentUser]);

  useEffect(() => { localStorage.setItem('thvp_messages', JSON.stringify(messages)); }, [messages]);
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
        setMessages((prev) => {
          const merged = prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: d._id,
                  senderId: d.senderId,
                  senderName: d.senderName,
                  senderRole: d.senderRole,
                  receiverId: d.receiverId,
                  receiverName: d.receiverName,
                  receiverRole: d.receiverRole,
                  content: d.content,
                  messageType: d.messageType || m.messageType,
                  fileUrl: d.fileUrl || m.fileUrl,
                  fileName: d.fileName || m.fileName,
                  time: new Date(d.createdAt || m.time),
                  read: d.isRead ?? m.read,
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
    }
    return newMsg;
  }, []);

  const syncMessages = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const json = await api.messages.syncByUser(userId);
      if (json.success) {
        const syncedMsgs = json.data.map(m => {
          const convId = m.isGroup && m.groupId
            ? `group_${m.groupId}`
            : m.conversationId;
          return {
            id: m._id,
            convId,
            groupId: m.groupId,
            isGroup: m.isGroup || false,
            senderId: m.senderId,
            senderName: m.senderName,
            senderRole: m.senderRole,
            receiverId: m.receiverId,
            receiverName: m.receiverName,
            receiverRole: m.receiverRole,
            content: m.content,
            messageType: m.messageType || 'text',
            fileUrl: m.fileUrl || '',
            fileName: m.fileName || '',
            fileExpired: m.fileExpired || false,
            time: new Date(m.createdAt),
            read: m.isRead,
            isRecalled: m.isRecalled || false,
            reactions: m.reactions || [],
          };
        });

        // ⚠️ MERGE: Không ghi đè — giữ tin real-time, thêm tin từ server nếu chưa có
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => String(m.id)));
          const newFromServer = syncedMsgs.filter(m => !existingIds.has(String(m.id)));
          if (newFromServer.length === 0) return prev; // Không có gì mới
          // Merge: server msgs làm nền tảng, real-time msgs bọm lầy
          const serverIds = new Set(syncedMsgs.map(m => String(m.id)));
          // Giữ lại: temp msgs (chưa có id từ server) và real-time msgs
          const realtimeOnly = prev.filter(m => !serverIds.has(String(m.id)));
          return [...syncedMsgs, ...realtimeOnly].sort((a, b) => new Date(a.time) - new Date(b.time));
        });
      }
    } catch (err) {
    }
  }, []);

  const toggleMessageReaction = useCallback(async (messageId, type) => {
    try {
      const json = await api.messages.toggleReaction(messageId, type);
      if (json.success) {
        setMessages(prev => prev.map(m =>
          String(m.id) === String(messageId) ? { ...m, reactions: json.data } : m
        ));
      }
    } catch (err) {
    }
  }, []);

  const recallMessage = useCallback(async (messageId) => {
    try {
      const json = await api.messages.recall(messageId);
      if (json.success) {
        setMessages(prev => prev.map(m =>
          String(m.id) === String(messageId) ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' } : m
        ));
      }
    } catch (err) {
    }
  }, []);

  const softDeleteMessage = useCallback(async (messageId) => {
    try {
      const json = await api.messages.softDelete(messageId);
      if (json.success) {
        // Chỉ ẩn/xóa khỏi mảng cục bộ trên giao diện của user này
        setMessages(prev => prev.filter(m => String(m.id) !== String(messageId)));
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

  const markMessagesRead = useCallback(async (convId, readerId, extraReceiverIds = []) => {
    const receiverTargets = new Set([String(readerId), ...extraReceiverIds.map(String)]);
    let needsUpdate = false;
    setMessages(prev => {
      const hasUnread = prev.some(m => m.convId === convId && receiverTargets.has(String(m.receiverId)) && !m.read);
      if (!hasUnread) return prev; // Ngắt vòng lặp vô hạn nếu không có tin chưa đọc
      needsUpdate = true;
      return prev.map(m =>
        m.convId === convId && receiverTargets.has(String(m.receiverId)) ? { ...m, read: true } : m
      );
    });

    if (needsUpdate) {
      // Đồng bộ lên backend thông qua centralized api service (có token)
      try {
        await api.messages.markRead(convId, readerId);
      } catch (err) {
      }
    }
  }, []);

  const getConversations = useCallback((userId) => {
    const sId = String(userId);
    const safeStudents = students.filter(Boolean);
    const safeTeachers = teachers.filter(Boolean);
    const safeStaffs = staffs.filter(Boolean);
    const safeMessages = messages.filter(Boolean);
    const isSuperAdmin = sId === 'admin' || (safeTeachers.find(t => String(t.id) === sId)?.adminRole === 'SUPER_ADMIN');
    const userRole = (sId === 'admin' || (safeTeachers.find(t => String(t.id) === sId)?.adminRole)) ? 'admin' : (safeStudents.find(s => String(s.id) === sId) ? 'student' : 'teacher');

    // Filter messages where user is sender or receiver; only SUPER_ADMIN can see receiverId='admin' mailbox
    const userMsgs = safeMessages.filter(m => {
      const isDirect = String(m.senderId) === sId || String(m.receiverId) === sId;
      const isAdminMailbox = isSuperAdmin && (String(m.senderId) === 'admin' || String(m.receiverId) === 'admin');
      return isDirect || isAdminMailbox;
    });
    const convMap = {};

    // 1. Add existing conversations from messages
    userMsgs.forEach(m => {
      const mTime = new Date(m.time).getTime();
      const existing = convMap[m.convId];
      const existingTime = existing ? new Date(existing.lastTime).getTime() : 0;

      if (!existing || mTime > existingTime) {
        // Xác định xem mình có phải là người gửi không (hộp chung 'admin' chỉ dành cho SUPER_ADMIN)
        const isMeSender = String(m.senderId) === sId || (isSuperAdmin && String(m.senderId) === 'admin');

        const otherUserId = isMeSender ? m.receiverId : m.senderId;
        const otherName = isMeSender ? m.receiverName : m.senderName;
        const otherRole = isMeSender ? m.receiverRole : m.senderRole;

        // Ưu tiên lấy branchCode trực tiếp từ tin nhắn (nếu có), nếu không mới tìm trong list local
        let branchCode = isMeSender ? m.receiverBranchCode : m.senderBranchCode;

        if (!branchCode) {
          if (otherRole === 'teacher') {
            const t = safeTeachers.find(t => String(t.id) === String(otherUserId));
            branchCode = t?.branchCode || '';
          } else if (otherRole === 'student') {
            const s = safeStudents.find(s => String(s.id) === String(otherUserId));
            branchCode = s?.branchCode || '';
          } else if (otherRole === 'admin' || otherRole === 'staff') {
            const st = safeStaffs.find(st => String(st.id) === String(otherUserId) || String(st._id) === String(otherUserId));
            branchCode = st?.branchCode || '';
          }
        }

        convMap[m.convId] = {
          id: m.convId,
          user: {
            id: otherUserId,
            name: otherName,
            role: otherRole,
            avatar: String(otherName || 'U').substring(0, 2).toUpperCase(),
            online: true,
            branchCode: branchCode
          },
          lastMessage: m.content,
          lastTime: m.time,
          unread: userMsgs.filter(um =>
            um.convId === m.convId &&
            (String(um.receiverId) === sId || (isSuperAdmin && String(um.receiverId) === 'admin')) &&
            !um.read
          ).length,
        };
      }
    });

    // 2. Add potential contacts
    if (userRole === 'student') {
      const student = safeStudents.find(s => String(s.id) === sId);
      if (student && student.teacherId) {
        const tid = String(student.teacherId || '');
        const t = safeTeachers.find(t => String(t.id) === tid);
        const convId = buildConversationId('student', sId, 'teacher', tid);
        if (t && !convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: { id: t.id, name: t.name, role: 'teacher', avatar: String(t.name || 'GV').substring(0, 2).toUpperCase(), online: true, branchCode: t.branchCode || '' },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      }
      // Thêm Admin vào danh bạ của Học viên (Dùng ID 'admin' cho Super Admin)
      const adminConvId = buildConversationId('student', sId, 'admin', 'admin');
      if (!convMap[adminConvId]) {
        convMap[adminConvId] = {
          id: adminConvId,
          user: { id: 'admin', name: 'Phòng Tuyển Sinh', role: 'admin', avatar: 'AD', online: true, branchCode: '' },
          lastMessage: 'Chưa có tin nhắn',
          lastTime: new Date(0),
          unread: 0,
        };
      }
    } else if (userRole === 'teacher') {
      const myStudents = safeStudents.filter(s => s && String(s.teacherId) === sId);
      myStudents.forEach(s => {
        const convId = buildConversationId('teacher', sId, 'student', s.id || s._id);
        if (!convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: { id: s.id, name: s.name, role: 'student', avatar: String(s.name || 'HV').substring(0, 2).toUpperCase(), online: true, branchCode: s.branchCode || '' },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      });

      // Admin contact (Dùng ID 'admin' cho Super Admin)
      const adminConvId = buildConversationId('admin', 'admin', 'teacher', sId);
      if (!convMap[adminConvId]) {
        convMap[adminConvId] = {
          id: adminConvId,
          user: { id: 'admin', name: 'Phòng Tuyển Sinh', role: 'admin', avatar: 'AD', online: true, branchCode: '' },
          lastMessage: 'Chưa có tin nhắn',
          lastTime: new Date(0),
          unread: 0,
        };
      }
    } else if (userRole === 'admin') {
      // Dùng ID thật của Staff để tạo convId riêng tư
      teachers.filter(t => t && (t.status === 'Active' || t.status === 'active')).forEach(t => {
        const convId = buildConversationId('admin', sId, 'teacher', t.id);
        if (!convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: { id: t.id, name: t.name, role: 'teacher', avatar: String(t.name || 'GV').substring(0, 2).toUpperCase(), online: true, branchCode: t.branchCode || '' },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      });

      safeStudents.filter(s => s && (s.id || s._id)).forEach(s => {
        const convId = buildConversationId('admin', sId, 'student', s.id || s._id);
        if (!convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: { id: s.id, name: s.name, role: 'student', avatar: String(s.name || 'HV').substring(0, 2).toUpperCase(), online: true, branchCode: s.branchCode || '' },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      });
    }

    // 3. Add Groups
    if (groups && Array.isArray(groups)) {
      groups.filter(g => g && g._id).filter(g => g.participants?.some(p => String(p.userId) === sId)).forEach(g => {
        const groupMsgs = safeMessages.filter(m => String(m.groupId) === String(g._id));
        const lastMsg = groupMsgs.length > 0 ? groupMsgs[groupMsgs.length - 1] : null;
        const convId = `group_${g._id}`;

        convMap[convId] = {
          id: convId,
          isGroup: true,
          user: { id: g._id, name: g.name, role: 'group', avatar: 'GN', online: true },
          lastMessage: lastMsg ? lastMsg.content : 'Bắt đầu cuộc trò chuyện nhóm',
          lastTime: lastMsg ? lastMsg.time : new Date(g.createdAt || 0),
          unread: groupMsgs.filter(m => !m.read && String(m.senderId) !== sId).length,
        };
      });
    }

    return Object.values(convMap).sort((a, b) => {
      // Ghim Admin lên đầu
      if (a.user?.role === 'admin' && b.user?.role !== 'admin') return -1;
      if (b.user?.role === 'admin' && a.user?.role !== 'admin') return 1;
      // Đảm bảo so sánh bằng số (ms) để tránh lỗi khi time là string từ localStorage
      const timeA = new Date(a.lastTime).getTime();
      const timeB = new Date(b.lastTime).getTime();
      return timeB - timeA;
    });
  }, [messages, students, teachers, staffs, groups]);

  const getMessages = useCallback((convId) => {
    return messages.filter(m => m && m.convId === convId).sort((a, b) => a.time - b.time);
  }, [messages]);

  return {
    messages, setMessages, groups, setGroups,
    sendMessage, syncMessages, toggleMessageReaction, recallMessage,
    softDeleteMessage, createChatGroup, deleteChatGroup,
    markMessagesRead, getConversations, getMessages,
  };
}
