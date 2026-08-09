import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import { useSocket } from './SocketContext';
import { useStudentsContext } from './StudentsContext';
import { useTeachersContext } from './TeachersContext';
import { isTeacherActive } from '../constants/teacherStatus';

import { buildConversationId } from '../utils/chatConversationId';

const MessagesContext = createContext(null);

function groupsKey(user) {
  if (!user?.role) return null;
  const id = user.id || user._id;
  if (!id) return null;
  return ['messageGroups', id];
}

async function fetchGroups([, userId]) {
  const res = await api.messages.getGroups(userId);
  return res?.success ? res.data.map((g) => ({ ...g, id: g._id })) : [];
}

const makeConvId = (role1, id1, role2, id2) =>
  buildConversationId(role1, id1, role2, id2);

export function MessagesProvider({ user, children }) {
  const [messages, setMessages] = useState([]);
  const { students } = useStudentsContext();
  const { teachers } = useTeachersContext();
  const {
    onGroupNew, onRecallReceive, onReactionReceive, onMessageReceive, onMessageSent,
  } = useSocket();

  const { data: groups = [], mutate: mutateGroups, isValidating } = useSWR(
    groupsKey(user),
    fetchGroups,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const refreshGroups = useCallback(() => mutateGroups(), [mutateGroups]);

  useEffect(() => {
    let unsubGroup;
    let unsubRecall;
    let unsubReaction;
    let unsubMsg;
    let unsubSent;

    const upsert = (data) => {
      if (!data?._id) return;
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(data._id))) {
          return prev.filter((m) => !(String(m.id).startsWith('temp_')
            && String(m.content || '') === String(data.content || '')
            && String(m.convId) === String(data.conversationId)));
        }
        const mappedMsg = {
          id: data._id,
          convId: data.conversationId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole,
          receiverId: data.receiverId,
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
        const tempIdx = prev.findIndex(
          (m) => String(m.id).startsWith('temp_')
            && String(m.convId) === String(data.conversationId)
            && String(m.content || '') === String(data.content || ''),
        );
        if (tempIdx !== -1) {
          const updated = [...prev];
          updated[tempIdx] = mappedMsg;
          return updated;
        }
        return [...prev, mappedMsg];
      });
    };

    if (onGroupNew) {
      unsubGroup = onGroupNew((newGroup) => {
        mutateGroups((prev = []) => {
          if (prev.some((g) => g._id === newGroup._id)) return prev;
          return [{ ...newGroup, id: newGroup._id }, ...prev];
        }, { revalidate: false });
      });
    }

    if (onRecallReceive) {
      unsubRecall = onRecallReceive((data) => {
        setMessages((prev) => prev.map((m) =>
          String(m.id) === String(data.messageId)
            ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' }
            : m
        ));
      });
    }

    if (onReactionReceive) {
      unsubReaction = onReactionReceive((data) => {
        setMessages((prev) => prev.map((m) =>
          String(m.id) === String(data.messageId) ? { ...m, reactions: data.reactions } : m
        ));
      });
    }

    if (onMessageReceive) unsubMsg = onMessageReceive(upsert);
    if (onMessageSent) unsubSent = onMessageSent(upsert);

    return () => {
      if (unsubGroup) unsubGroup();
      if (unsubRecall) unsubRecall();
      if (unsubReaction) unsubReaction();
      if (unsubMsg) unsubMsg();
      if (unsubSent) unsubSent();
    };
  }, [onGroupNew, onRecallReceive, onMessageReceive, onMessageSent, onReactionReceive, mutateGroups]);

  const sendMessage = useCallback(async (msg) => {
    const tempId = `temp_${Date.now()}`;
    const convId = msg.isGroup && msg.groupId
      ? `group_${msg.groupId}`
      : buildConversationId(msg.senderRole, msg.senderId, msg.receiverRole, msg.receiverId);
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
    setMessages((prev) => [...prev, newMsg]);

    try {
      const res = await api.messages.send({
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
        setMessages((prev) => {
          if (prev.some((m) => String(m.id) === String(res.data._id))) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: res.data._id,
                  convId: res.data.conversationId || m.convId,
                  senderId: res.data.senderId,
                  senderRole: res.data.senderRole,
                  receiverId: res.data.receiverId,
                  receiverRole: res.data.receiverRole,
                }
              : m
          );
        });
        return { ...newMsg, id: res.data._id, convId: res.data.conversationId || convId };
      }
    } catch {
      /* optimistic UI kept */
    }
    return newMsg;
  }, []);

  const syncMessages = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const json = await api.messages.syncByUser(uid);
      if (json.success) {
        const syncedMsgs = json.data.map((m) => {
          const convId = m.isGroup && m.groupId ? `group_${m.groupId}` : m.conversationId;
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
            read: Boolean(m.isRead),
            isRecalled: m.isRecalled || false,
            reactions: m.reactions || [],
          };
        });

        setMessages((prev) => {
          const localById = new Map(prev.map((m) => [String(m.id), m]));
          const merged = syncedMsgs.map((sm) => {
            const local = localById.get(String(sm.id));
            return {
              ...sm,
              read: Boolean(sm.read) || Boolean(local?.read),
            };
          });
          const serverIds = new Set(syncedMsgs.map((m) => String(m.id)));
          const temps = prev.filter((m) => String(m.id).startsWith('temp_') && !serverIds.has(String(m.id)));
          return [...merged, ...temps].sort((a, b) => new Date(a.time) - new Date(b.time));
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMessageReaction = useCallback(async (messageId, type) => {
    try {
      const json = await api.messages.toggleReaction(messageId, type);
      if (json.success) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id || m._id) === String(messageId) ? { ...m, reactions: json.data } : m
          )
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  const recallMessage = useCallback(async (messageId) => {
    const json = await api.messages.recall(messageId);
    if (json.success) {
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === String(messageId)
            ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' }
            : m
        )
      );
    } else {
      throw new Error(json.message || 'Không thể thu hồi tin nhắn');
    }
  }, []);

  const softDeleteMessage = useCallback(async (messageId) => {
    try {
      const json = await api.messages.softDelete(messageId);
      if (json.success) {
        setMessages((prev) => prev.filter((m) => String(m.id || m._id) !== String(messageId)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const createChatGroup = useCallback(async (name, participants) => {
    try {
      const json = await api.messages.createGroup(name, participants);
      if (json.success) {
        mutateGroups((prev = []) => [{ ...json.data, id: json.data._id }, ...prev], { revalidate: false });
        await refreshGroups();
        return json.data;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [mutateGroups, refreshGroups]);

  const deleteChatGroup = useCallback(async (groupId) => {
    try {
      const json = await api.messages.deleteGroup(groupId);
      if (json.success) {
        mutateGroups(
          (prev = []) => prev.filter((g) => String(g._id) !== String(groupId) && String(g.id) !== String(groupId)),
          { revalidate: false }
        );
        setMessages((prev) => prev.filter((m) => m.convId !== `group_${groupId}`));
        await refreshGroups();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }, [mutateGroups, refreshGroups]);

  const markMessagesRead = useCallback(async (convId, readerId) => {
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

    try {
      await api.messages.markRead(convId, readerId);
    } catch {
      /* ignore */
    }
  }, []);

  const getConversations = useCallback((uid) => {
    const sId = String(uid);
    const userRole = (sId === 'admin')
      ? 'admin'
      : (students.find((s) => String(s.id) === sId) ? 'student' : 'teacher');

    const userMsgs = messages.filter((m) => String(m.senderId) === sId || String(m.receiverId) === sId);
    const convMap = {};

    userMsgs.forEach((m) => {
      const mTime = new Date(m.time).getTime();
      const existing = convMap[m.convId];
      const existingTime = existing ? new Date(existing.lastTime).getTime() : 0;
      if (!existing || mTime > existingTime) {
        const otherUserId = String(m.senderId) === sId ? m.receiverId : m.senderId;
        const otherName = String(m.senderId) === sId ? m.receiverName : m.senderName;
        const otherRole = String(m.senderId) === sId ? m.receiverRole : m.senderRole;
        convMap[m.convId] = {
          id: m.convId,
          user: {
            id: otherUserId,
            name: otherName,
            role: otherRole,
            avatar: String(otherName || 'U').substring(0, 2).toUpperCase(),
            online: true,
          },
          lastMessage: m.content,
          lastTime: m.time,
          unread: userMsgs.filter((um) => um.convId === m.convId && String(um.receiverId) === sId && um.read !== true).length,
        };
      }
    });

    if (userRole === 'student') {
      const student = students.find((s) => String(s.id) === sId);
      if (student?.teacherId) {
        const t = teachers.find((te) => te.id === student.teacherId);
        const convId = makeConvId('student', sId, 'teacher', student.teacherId);
        if (t && !convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: {
              id: t.id,
              name: t.name,
              role: 'teacher',
              avatar: String(t.name || 'GV').substring(0, 2).toUpperCase(),
              online: true,
            },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      }
      const adminConvId = makeConvId('student', sId, 'admin', 'admin');
      if (!convMap[adminConvId]) {
        convMap[adminConvId] = {
          id: adminConvId,
          user: { id: 'admin', name: 'Admin Thắng Tin Học', role: 'admin', avatar: 'AD', online: true },
          lastMessage: 'Chưa có tin nhắn',
          lastTime: new Date(0),
          unread: 0,
        };
      }
    } else if (userRole === 'teacher') {
      students.filter((s) => String(s.teacherId) === sId).forEach((s) => {
        const convId = makeConvId('teacher', sId, 'student', s.id);
        if (!convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: {
              id: s.id,
              name: s.name,
              role: 'student',
              avatar: String(s.name || 'HV').substring(0, 2).toUpperCase(),
              online: true,
            },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      });
      const adminConvId = makeConvId('admin', 'admin', 'teacher', sId);
      if (!convMap[adminConvId]) {
        convMap[adminConvId] = {
          id: adminConvId,
          user: { id: 'admin', name: 'Admin Thắng Tin Học', role: 'admin', avatar: 'AD', online: true },
          lastMessage: 'Chưa có tin nhắn',
          lastTime: new Date(0),
          unread: 0,
        };
      }
    } else if (userRole === 'admin') {
      teachers.filter((t) => isTeacherActive(t.status)).forEach((t) => {
        const convId = makeConvId('admin', 'admin', 'teacher', t.id);
        if (!convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: {
              id: t.id,
              name: t.name,
              role: 'teacher',
              avatar: String(t.name || 'GV').substring(0, 2).toUpperCase(),
              online: true,
            },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      });
      students.forEach((s) => {
        const convId = makeConvId('admin', 'admin', 'student', s.id);
        if (!convMap[convId]) {
          convMap[convId] = {
            id: convId,
            user: {
              id: s.id,
              name: s.name,
              role: 'student',
              avatar: String(s.name || 'HV').substring(0, 2).toUpperCase(),
              online: true,
            },
            lastMessage: 'Chưa có tin nhắn',
            lastTime: new Date(0),
            unread: 0,
          };
        }
      });
    }

    if (groups?.length) {
      groups.filter((g) => g.participants?.some((p) => String(p.userId) === sId)).forEach((g) => {
        const groupMsgs = messages.filter((m) => String(m.groupId) === String(g._id));
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
          unread: groupMsgs.filter((m) => m.read !== true && String(m.senderId) !== sId).length,
        };
      });
    }

    // Ai nhắn sau → lên đầu
    return Object.values(convMap).sort((a, b) => {
      const timeA = new Date(a.lastTime || 0).getTime();
      const timeB = new Date(b.lastTime || 0).getTime();
      return timeB - timeA;
    });
  }, [messages, students, teachers, groups]);

  const getMessages = useCallback((convId) =>
    messages.filter((m) => m.convId === convId).sort((a, b) => a.time - b.time),
  [messages]);

  const value = useMemo(() => ({
    messages,
    groups,
    sendMessage,
    syncMessages,
    markMessagesRead,
    getConversations,
    getMessages,
    recallMessage,
    softDeleteMessage,
    createChatGroup,
    deleteChatGroup,
    toggleMessageReaction,
    refreshGroups,
    isGroupsLoading: isValidating,
  }), [
    messages, groups, sendMessage, syncMessages, markMessagesRead,
    getConversations, getMessages, recallMessage, softDeleteMessage,
    createChatGroup, deleteChatGroup, toggleMessageReaction, refreshGroups, isValidating,
  ]);

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessagesContext() {
  const ctx = useContext(MessagesContext);
  if (!ctx) {
    return {
      messages: [],
      groups: [],
      sendMessage: async () => {},
      syncMessages: async () => {},
      markMessagesRead: async () => {},
      getConversations: () => [],
      getMessages: () => [],
      recallMessage: async () => {},
      softDeleteMessage: async () => {},
      createChatGroup: async () => null,
      deleteChatGroup: async () => false,
      toggleMessageReaction: async () => {},
      refreshGroups: async () => {},
      isGroupsLoading: false,
    };
  }
  return ctx;
}
