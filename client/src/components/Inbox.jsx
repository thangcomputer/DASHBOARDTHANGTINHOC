import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageCircle, Send, X, Search, ChevronLeft,
  User, Circle, Image, Paperclip, Smile, Download,
  CheckCheck, Clock as ClockIcon, CheckCircle2, Users, Plus, Trash2, RotateCcw, MoreHorizontal, EyeOff, AlertCircle, ZoomIn
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useData, buildConversationId } from '../context/DataContext';
import { useLocation } from 'react-router-dom';
import { useToast } from '../utils/toast';
import { messagesAPI, resolveMediaUrl } from '../services/api';
import { displayFileName } from '../utils/validators';
import { resolveAvatarUrl, DEFAULT_AVATARS } from '../utils/defaultAvatars';
import { Megaphone, Loader2 } from 'lucide-react';
// ─── Helpers ──────────────────────────────────────────────────────────────────
const showFileName = (name) => displayFileName(name);
const formatTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60000) return 'Vừa xong';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} phút`;
  if (diffMs < 86400000) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const normalizeRole = (role) => (role === 'staff' ? 'admin' : role);

const isAttachmentExpired = (msg) =>
  Boolean(msg?.fileExpired) ||
  ((msg?.messageType === 'image' || msg?.messageType === 'file') && !msg?.fileUrl && !msg?.isRecalled);

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)(\?.*)?$/i;

const isImageMessage = (msg) => {
  if (!msg?.fileUrl || msg.isRecalled || isAttachmentExpired(msg)) return false;
  if (msg.messageType === 'image') return true;
  return IMAGE_EXT_RE.test(`${msg.fileName || ''} ${msg.fileUrl || ''}`);
};

function ImageLightbox({ preview, onClose, onDownload }) {
  if (!preview || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex flex-col bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold truncate min-w-0">{showFileName(preview.fileName)}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onDownload(preview.fileUrl, preview.fileName)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors"
          >
            <Download size={14} /> Tải ảnh
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      <div
        className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={preview.src}
          alt={showFileName(preview.fileName)}
          className="max-w-full max-h-[calc(100dvh-5rem)] w-auto h-auto object-contain rounded-lg shadow-2xl select-none"
          draggable={false}
        />
      </div>
      <p className="text-center text-white/50 text-[11px] font-bold pb-4 shrink-0">Bấm nền tối hoặc ESC để đóng</p>
    </div>,
    document.body
  );
}

const messageIsFromMe = (msg, currentUserId, currentUserRole) => {
  if (String(msg.senderId) === String(currentUserId)) return true;
  const r = String(currentUserRole || '').toLowerCase();
  // Legacy: một số tin cũ có senderId='admin' (đã từng gom identity).
  // Chỉ "hardcoded admin" (id='admin') mới coi đây là tin của mình,
  // nếu không sẽ làm STAFF thấy tin của SUPER_ADMIN bị đảo chiều.
  if ((r === 'admin' || r === 'staff') && String(currentUserId) === 'admin' && String(msg.senderId) === 'admin') return true;
  return false;
};

// ─── Reaction Picker (floating) ────────────────────────────────────────────────
const ReactionPicker = ({ msgId, isMine, onReact, myReactions }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Đóng khi click ngoài
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen(v => !v)}
        className="opacity-0 group-hover/msg:opacity-100 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-pink-500 transition-all rounded-full hover:bg-white hover:shadow-sm text-base"
        title="Thả cảm xúc"
      >
        <Smile size={15} />
      </button>

      {open && (
        <div
          className={`absolute bottom-full mb-2 ${isMine ? 'right-0' : 'left-0'} flex items-center gap-1 bg-white rounded-full px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-slate-100 z-[9999] animate-in zoom-in-75 duration-150`}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Heart */}
          <button
            onClick={(e) => { e.stopPropagation(); onReact(msgId, 'heart'); setOpen(false); }}
            className={`w-9 h-9 flex items-center justify-center text-xl rounded-full transition-all hover:scale-125 hover:bg-red-50 ${myReactions?.includes('heart') ? 'bg-red-50 scale-110' : ''}`}
            title="Tim"
          >
            ❤️
          </button>
          {/* Like */}
          <button
            onClick={(e) => { e.stopPropagation(); onReact(msgId, 'like'); setOpen(false); }}
            className={`w-9 h-9 flex items-center justify-center text-xl rounded-full transition-all hover:scale-125 hover:bg-blue-50 ${myReactions?.includes('like') ? 'bg-blue-50 scale-110' : ''}`}
            title="Thích"
          >
            👍
          </button>
        </div>
      )}
    </div>
  );
};

// ─── MAIN INBOX ──────────────────────────────────────────────────────────────
const Inbox = ({ currentUserId = 'admin', currentUserName = 'Admin', currentUserRole = 'admin', onNavigate }) => {
  const location = useLocation();
  const toast = useToast();
  const socketCtx = useSocket();
  const { sendMessage: socketSend, onlineUsers, lastSeenUsers, joinGroupChat, onMessageReceive, onReactionReceive, onRecallReceive, onContactListUpdated, socket } = socketCtx;
  const {
    getConversations, getMessages: ctxGetMessages, sendMessage: ctxSendMessage,
    markMessagesRead, syncMessages, recallMessage: ctxRecallMessage, createChatGroup, deleteChatGroup, groups,
    teachers, students, toggleMessageReaction: ctxToggleReaction,
    softDeleteMessage: ctxDeleteMessage
  } = useData();

  const dataContextConvs = getConversations(currentUserId);
  const [contacts, setContacts] = useState([]);
  const [seedContact, setSeedContact] = useState(null);
  const [hiddenList, setHiddenList] = useState([]);
  const [contactTab, setContactTab] = useState('all'); // 'all', 'student', 'teacher', 'admin', 'group'

  const isUserOnline = useCallback((userId) => {
    if (!userId || !onlineUsers || !Array.isArray(onlineUsers)) return false;
    const targetStr = String(userId);
    return onlineUsers.some(u => String(u.userId) === targetStr);
  }, [onlineUsers]);

  const getUserStatusText = useCallback((userId, isOnline) => {
    if (isOnline) {
      return (
        <span className="text-emerald-600 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Đang hoạt động
        </span>
      );
    }
    if (!userId || !lastSeenUsers) return <span className="text-slate-400">Offline</span>;
    const lastSeenTime = lastSeenUsers[String(userId)];
    if (!lastSeenTime) return <span className="text-slate-400">Offline</span>;

    try {
      const diffMs = Date.now() - new Date(lastSeenTime).getTime();
      if (isNaN(diffMs) || diffMs < 0) return <span className="text-slate-400">Offline</span>;

      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return <span className="text-slate-500 font-medium">Hoạt động vừa xong</span>;
      if (diffMins < 60) return <span className="text-slate-500 font-medium">Hoạt động {diffMins} phút trước</span>;
      if (diffHours < 24) return <span className="text-slate-500 font-medium">Hoạt động {diffHours} giờ trước</span>;
      if (diffDays < 7) return <span className="text-slate-500 font-medium">Hoạt động {diffDays} ngày trước</span>;
      return <span className="text-slate-400">Offline</span>;
    } catch {
      return <span className="text-slate-400">Offline</span>;
    }
  }, [lastSeenUsers]);

  useEffect(() => {
    (async () => {
      try {
        const [res, hiddenRes] = await Promise.all([
          messagesAPI.getContacts(),
          messagesAPI.getHiddenConversations()
        ]);
        if (res?.success) setContacts(res.data);
        if (hiddenRes?.success) setHiddenList(hiddenRes.data);
      } catch (err) {}
    })();
  }, []);

  const refreshHiddenList = useCallback(async () => {
    try {
      const hiddenRes = await messagesAPI.getHiddenConversations();
      if (hiddenRes?.success) setHiddenList(hiddenRes.data);
    } catch (err) {}
  }, []);

  // 📡 Re-fetch danh bạ khi server thông báo CONTACT_LIST_UPDATED (sau xếp lớp)
  const refreshContacts = useCallback(async () => {
    try {
      const res = await messagesAPI.getContacts();
      if (res?.success) setContacts(res.data);
    } catch (err) {}
  }, []);

  useEffect(() => {
    if (!onContactListUpdated) return;
    const unsub = onContactListUpdated((payload) => {
      refreshContacts();
    });
    return unsub;
  }, [onContactListUpdated, refreshContacts]);

  // Đồng bộ danh sách liên hệ khi dữ liệu hệ thống thay đổi (không chỉ CONTACT_LIST_UPDATED)
  useEffect(() => {
    if (!socket) return;
    let t = null;
    const bump = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        refreshContacts();
      }, 400);
    };
    ['data:refresh', 'student:new', 'student:assigned', 'teacher:new', 'student:updated'].forEach((ev) => socket.on(ev, bump));
    return () => {
      if (t) clearTimeout(t);
      ['data:refresh', 'student:new', 'student:assigned', 'teacher:new', 'student:updated'].forEach((ev) => socket.off(ev, bump));
    };
  }, [socket, refreshContacts]);

  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [pendingImage, setPendingImage] = useState(null);

  const conversations = useMemo(() => {
    const list = [];

    // Dedupe contacts từ API (tránh duplicate key + lọc trùng tên Super Admin)
    const seenContacts = new Set();
    const uniqueContacts = (contacts || []).filter((c) => {
      if (!c?.id) return false;
      const role = normalizeRole(c?.role);
      const nameKey = String(c?.name || '').trim().toLowerCase();
      const key = role === 'admin' ? `admin:${nameKey}` : `${String(c?.id)}:${role}`;
      if (seenContacts.has(key)) return false;
      seenContacts.add(key);
      return true;
    });

    const seenConvIds = new Set();

    uniqueContacts.forEach(c => {
      if (c.id === currentUserId) return;
      const convId = buildConversationId(currentUserRole, currentUserId, c.role, c.id);
      const existingConv = dataContextConvs.find(dc => String(dc.id) === String(convId));

      // Dedupe theo conversationId (phòng khi backend trả trùng contact)
      if (seenConvIds.has(convId)) return;
      seenConvIds.add(convId);

      list.push({
        id: convId,
        isGroup: false,
        isHidden: hiddenList.includes(convId),
        user: { id: c.id, name: c.name, role: c.role, adminRole: c.adminRole || null, avatar: c.avatar, gender: c.gender, phone: c.phone || '', online: isUserOnline(c.id) },
        lastMessage: existingConv?.lastMessage || 'Bắt đầu cuộc trò chuyện',
        lastTime: existingConv?.lastTime || new Date('2000-01-01'),
        unread: existingConv?.unread || 0,
      });
    });

    // Contact seed từ bảng tin / hỗ trợ online — chat không cần có sẵn trong danh bạ
    if (seedContact?.id && String(seedContact.id) !== String(currentUserId)) {
      const role = normalizeRole(seedContact.role);
      const convId = buildConversationId(currentUserRole, currentUserId, role, seedContact.id);
      if (!seenConvIds.has(convId)) {
        seenConvIds.add(convId);
        const existingConv = dataContextConvs.find((dc) => String(dc.id) === String(convId));
        list.unshift({
          id: convId,
          isGroup: false,
          isHidden: false,
          user: {
            id: seedContact.id,
            name: seedContact.name,
            role,
            adminRole: seedContact.adminRole || null,
            avatar: seedContact.avatar,
            gender: seedContact.gender,
            phone: seedContact.phone || '',
            online: isUserOnline(seedContact.id),
          },
          lastMessage: existingConv?.lastMessage || 'Bắt đầu cuộc trò chuyện',
          lastTime: existingConv?.lastTime || new Date(),
          unread: existingConv?.unread || 0,
        });
      }
    }

    const groupConvs = dataContextConvs.filter(dc => dc.isGroup).map(dc => ({
      ...dc,
      isHidden: hiddenList.includes(dc.id)
    }));
    list.push(...groupConvs);

    // Hội thoại có tin (kể cả chưa đọc) nhưng không còn trong danh bạ API — vẫn hiện để đọc/xóa badge
    dataContextConvs.forEach((dc) => {
      if (!dc || dc.isGroup || seenConvIds.has(dc.id)) return;
      const hasActivity = Number(dc.unread || 0) > 0
        || (dc.lastMessage && dc.lastMessage !== 'Chưa có tin nhắn' && dc.lastMessage !== 'Bắt đầu cuộc trò chuyện');
      if (!hasActivity) return;
      seenConvIds.add(dc.id);
      list.push({
        ...dc,
        isHidden: hiddenList.includes(dc.id),
      });
    });

    // Ai nhắn sau → lên đầu (theo thời gian tin gần nhất)
    const sortedList = list.sort((a, b) => {
      const timeA = new Date(a.lastTime || 0).getTime();
      const timeB = new Date(b.lastTime || 0).getTime();
      return timeB - timeA;
    });

    // Lọc trùng lặp tuyệt đối danh sách hội thoại theo user (không user nào bị trùng 2 dòng)
    const finalSeenUserKeys = new Set();
    const deduplicatedList = [];

    sortedList.forEach((item) => {
      if (item.isGroup) {
        deduplicatedList.push(item);
        return;
      }
      const role = normalizeRole(item.user?.role);
      const userKey = `${String(item.user?.id)}:${role}`;

      if (finalSeenUserKeys.has(userKey)) return;
      finalSeenUserKeys.add(userKey);
      deduplicatedList.push(item);
    });

    return deduplicatedList;
  }, [contacts, dataContextConvs, hiddenList, currentUserRole, currentUserId, onlineUsers, seedContact]);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [groupToDelete, setGroupToDelete] = useState(null); // ID của nhóm cần xóa
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  // Trạng thái recall đang xử lý
  const [recallingId, setRecallingId] = useState(null);

  // Broadcast states
  const [broadcastConfig, setBroadcastConfig] = useState(null); // { targetRole: 'student', label: 'Học viên' }
  const [broadcastContent, setBroadcastContent] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const EMOJIS = ['😊', '👍', '❤️', '👏', '🔥', '✅', '🆘', '📚', '💻', '💡'];

  useEffect(() => {
    if (!imagePreview) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setImagePreview(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [imagePreview]);

  const openImagePreview = useCallback((msg) => {
    if (!msg?.fileUrl) return;
    setImagePreview({
      src: resolveMediaUrl(msg.fileUrl),
      fileUrl: msg.fileUrl,
      fileName: msg.fileName || 'image',
    });
  }, []);

  // ─── Join groups ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeConv && activeConv.isGroup) {
      joinGroupChat(activeConv.user.id);
    }
  }, [activeConv, joinGroupChat]);

  useEffect(() => {
    if (groups && groups.length > 0) {
      groups.forEach(g => joinGroupChat(g._id));
    }
  }, [groups, joinGroupChat]);

  // ─── Sync messages khi mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (currentUserId && syncMessages) {
      syncMessages(currentUserId);
    }
  }, [currentUserId, syncMessages]);

  // ─── Helper tra cứu tên người gửi động chuẩn hệ thống ──────────────────────
  const resolveSenderName = useCallback((msg) => {
    if (!msg) return 'Người gửi';
    if (String(msg.senderId) === String(currentUserId)) return currentUserName || 'Người gửi';
    if (msg.senderId === 'admin') {
      const superDoc = (teachers || []).find(t => t.adminRole === 'SUPER_ADMIN' || t.role === 'admin');
      if (superDoc?.name) return superDoc.name;
      if (currentUserRole === 'admin' && currentUserName) return currentUserName;
    }
    const matchTeacher = (teachers || []).find(t => String(t.id || t._id) === String(msg.senderId));
    if (matchTeacher?.name) return matchTeacher.name;
    const matchStudent = (students || []).find(s => String(s.id || s._id) === String(msg.senderId));
    if (matchStudent?.name) return matchStudent.name;
    return msg.senderName || 'Người gửi';
  }, [currentUserId, currentUserName, currentUserRole, teachers, students]);

  // ─── Load messages khi chọn conversation ─────────────────────────────────────
  useEffect(() => {
    if (activeConv) {
      const msgs = ctxGetMessages(activeConv.id);
      setMessages(msgs.map(m => ({
        id: m.id,
        senderId: m.senderId,
        senderName: resolveSenderName(m),
        senderRole: m.senderRole || (m.senderId === 'admin' ? 'admin' : activeConv.user.role),
        content: m.content,
        time: m.time,
        isRead: m.read,
        isRecalled: m.isRecalled || false,
        messageType: m.messageType || 'text',
        fileName: m.fileName,
        fileUrl: m.fileUrl,
        fileExpired: m.fileExpired || false,
        reactions: m.reactions || [],
      })));
      markMessagesRead(activeConv.id, currentUserId, (currentUserRole === 'admin') ? ['admin'] : []);
    }
  }, [activeConv, ctxGetMessages, markMessagesRead, currentUserId, resolveSenderName]);

  // ─── Socket real-time listeners ──────────────────────────────────────────────
  useEffect(() => {
    let unsubRecall, unsubReaction, unsubMsg;

    if (onMessageReceive) {
      unsubMsg = onMessageReceive((data) => {
        // Chỉ cập nhật nếu tin nhắn thuộc cuộc trò chuyện đang chọn
        if (activeConv && (String(data.conversationId) === String(activeConv.id))) {
          setMessages(prev => {
            if (prev.some(m => String(m.id) === String(data._id))) return prev;
            const mappedMsg = {
              id: data._id,
              senderId: data.senderId,
              senderName: resolveSenderName(data),
              senderRole: data.senderRole,
              content: data.content,
              time: new Date(data.createdAt || Date.now()),
              isRead: data.isRead || false,
              isRecalled: data.isRecalled || false,
              messageType: data.messageType || 'text',
              fileName: data.fileName,
              fileUrl: data.fileUrl,
              fileExpired: data.fileExpired || false,
              reactions: data.reactions || [],
            };
            return [...prev, mappedMsg];
          });
          markMessagesRead(activeConv.id, currentUserId, (currentUserRole === 'admin') ? ['admin'] : []);
        }
      });
    }

    if (onRecallReceive) {
      unsubRecall = onRecallReceive((data) => {
        setMessages(prev => prev.map(m =>
          String(m.id) === String(data.messageId)
            ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' }
            : m
        ));
      });
    }

    if (onReactionReceive) {
      unsubReaction = onReactionReceive((data) => {
        setMessages(prev => prev.map(m =>
          String(m.id) === String(data.messageId) ? { ...m, reactions: data.reactions } : m
        ));
      });
    }

    return () => {
      if (unsubMsg) unsubMsg();
      if (unsubRecall) unsubRecall();
      if (unsubReaction) unsubReaction();
    };
  }, [activeConv, onMessageReceive, onRecallReceive, onReactionReceive, currentUserId, markMessagesRead]);

  // ─── Thu hồi tin nhắn ────────────────────────────────────────────────────────
  const handleRecall = useCallback(async (msgId) => {
    if (recallingId) return; // Chống double click
    setRecallingId(msgId);

    // Optimistic update ngay lập tức
    setMessages(prev => prev.map(m =>
      String(m.id) === String(msgId)
        ? { ...m, isRecalled: true, content: 'Tin nhắn đã được thu hồi' }
        : m
    ));

    try {
      await ctxRecallMessage(msgId);
    } catch (err) {
      // Rollback nếu API thất bại
      setMessages(prev => prev.map(m =>
        String(m.id) === String(msgId) ? { ...m, isRecalled: false } : m
      ));
      toast?.error('Không thể thu hồi tin nhắn. Vui lòng thử lại.');
    } finally {
      setRecallingId(null);
    }
  }, [recallingId, ctxRecallMessage, toast]);

  // ─── Xóa mềm lịch sử cá nhân ───────────────────────────────────────────────
  const [showMessageOptions, setShowMessageOptions] = useState(null);
  
  const handleDeleteHistory = useCallback(async (msgId) => {
    setShowMessageOptions(null);
    try {
      await ctxDeleteMessage(msgId);
      setMessages(prev => prev.filter(m => String(m.id) !== String(msgId)));
    } catch (err) {
      toast?.error('Không thể xóa lịch sử lúc này.');
    }
  }, [ctxDeleteMessage, toast]);

  // ─── Toggle reaction ──────────────────────────────────────────────────────────
  const handleReaction = useCallback(async (messageId, type) => {
    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (String(m.id) !== String(messageId)) return m;
      const reactions = [...(m.reactions || [])];
      const idx = reactions.findIndex(r => r.userId === currentUserId && r.type === type);
      if (idx > -1) {
        return { ...m, reactions: reactions.filter((_, i) => i !== idx) };
      } else {
        return { ...m, reactions: [...reactions, { userId: currentUserId, type, userName: currentUserName }] };
      }
    }));

    try {
      await ctxToggleReaction(messageId, type);
    } catch (err) {
    }
  }, [currentUserId, currentUserName, ctxToggleReaction]);

  // ─── Gửi tin nhắn ────────────────────────────────────────────────────────────
  const selectConversation = (conv) => {
    // Nếu conv truyền vào là object từ danh bạ (chưa có id hoặc id kiểu r_i__r_i)
    if (conv.user && !conv.lastMessage) {
      const properId = buildConversationId(currentUserRole, currentUserId, conv.user.role, conv.user.id);
      
      // Kiểm tra xem đã có conv này trong dataContext chưa
      const existing = dataContextConvs.find(dc => dc.id === properId);
      if (existing) {
        setActiveConv(existing);
      } else {
        setActiveConv({ ...conv, id: properId });
      }
    } else {
      setActiveConv(conv);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items || !activeConv) return;

    let imageFile = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (!imageFile) return;

    e.preventDefault();

    const file = imageFile;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('Ảnh quá lớn. Giới hạn 5MB.');
      setTimeout(() => setUploadError(''), 4000);
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const uploadRes = await messagesAPI.uploadMessageFile(file);
      if (!uploadRes.success) throw new Error(uploadRes.message || 'Lỗi lưu trữ ảnh');

      setPendingImage({
        url: uploadRes.url,
        fileName: file.name || 'screenshot.png',
      });
      toast.success('Đã dán ảnh từ bộ nhớ tạm! Nhấn Enter hoặc nút Gửi để gửi.');
    } catch (err) {
      setUploadError('Tải ảnh thất bại: ' + (err.message || ''));
      setTimeout(() => setUploadError(''), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if ((!newMsg.trim() && !pendingImage) || !activeConv) return;
    const contentText = newMsg.trim();

    if (pendingImage) {
      const msgData = {
        conversationId: activeConv.id,
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        receiverId: activeConv.user.id,
        receiverName: activeConv.user.name,
        receiverRole: activeConv.user.role,
        content: contentText || '[Hình ảnh]',
        messageType: 'image',
        fileUrl: pendingImage.url,
        fileName: pendingImage.fileName,
        isGroup: activeConv.isGroup || false,
        groupId: activeConv.isGroup ? activeConv.user.id : null,
      };
      await ctxSendMessage(msgData);
      setPendingImage(null);
      setNewMsg('');
    } else if (contentText) {
      const msgData = {
        conversationId: activeConv.id,
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        receiverId: activeConv.user.id,
        receiverName: activeConv.user.name,
        receiverRole: activeConv.user.role,
        content: contentText,
        messageType: 'text',
        isGroup: activeConv.isGroup || false,
        groupId: activeConv.isGroup ? activeConv.user.id : null,
      };
      await ctxSendMessage(msgData);
      setNewMsg('');
    }

    setShowEmojis(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeConv) return;

    const isImage = file.type.startsWith('image/');
    const maxSize = 5 * 1024 * 1024;
    const maxLabel = '5MB';

    if (file.size > maxSize) {
      setUploadError(`File quá lớn. Giới hạn ${maxLabel}.`);
      e.target.value = '';
      setTimeout(() => setUploadError(''), 4000);
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const uploadRes = await messagesAPI.uploadMessageFile(file);
      if (!uploadRes.success) throw new Error(uploadRes.message || 'Lỗi hệ thống lưu trữ');

      const msgData = {
        conversationId: activeConv.id,
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        receiverId: activeConv.user.id,
        receiverName: activeConv.user.name,
        receiverRole: activeConv.user.role,
        content: isImage ? '[Hình ảnh]' : `Đã gửi tệp: ${file.name}`,
        messageType: isImage ? 'image' : 'file',
        fileUrl: uploadRes.url,
        fileName: file.name,
        isGroup: activeConv.isGroup || false,
        groupId: activeConv.isGroup ? activeConv.user.id : null
      };

      await ctxSendMessage(msgData);
    } catch (err) {
      setUploadError('Tải tệp thất bại: ' + (err.message || ''));
      setTimeout(() => setUploadError(''), 4000);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const addEmoji = (emoji) => {
    setNewMsg(prev => prev + emoji);
    setShowEmojis(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDownload = useCallback(async (url, fileName) => {
    const safeName = showFileName(fileName);
    const fullUrl = resolveMediaUrl(url);
    if (!fullUrl) return;
    try {
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = safeName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = safeName || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setShowMessageOptions(null);
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHideConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      // Ẩn + đánh dấu đã đọc để badge không còn báo tin chưa đọc
      await markMessagesRead(convId, currentUserId, (currentUserRole === 'admin') ? ['admin'] : []);
      const res = await messagesAPI.hideConversation(convId);
      if (res.success) {
        setHiddenList(prev => [...prev, convId]);
        if (activeConv?.id === convId) {
          setActiveConv(null);
        }
        toast.success('Đã ẩn cuộc trò chuyện');
      }
    } catch (err) {
      toast.error('Lỗi khi ẩn cuộc trò chuyện');
    }
  };

  const filteredConvs = conversations.filter(c => {
    const isSearching = search.trim().length > 0;
    if (!isSearching && c.isHidden) return false;

    if (isSearching) {
      const searchStr = search.toLowerCase();
      const matchesName = (c.user?.name || '').toLowerCase().includes(searchStr);
      const phoneStr = (c.user.phone || '').replace(/\s+/g, '');
      const matchesPhone = phoneStr.includes(searchStr.replace(/\s+/g, ''));
      if (!matchesName && !matchesPhone) return false;
    }

    if (contactTab === 'all') return true;
    if (contactTab === 'group') return c.isGroup;
    return normalizeRole(c.user.role) === contactTab;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  // Auto-select conversation từ navigation state (kể cả chưa có trong danh bạ)
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    const selectId = location.state?.selectUserId;
    const selectUser = location.state?.selectUser;
    if (selectUser?.id) {
      setSeedContact({
        id: String(selectUser.id),
        name: selectUser.name || 'Người dùng',
        role: normalizeRole(selectUser.role || 'admin'),
        avatar: selectUser.avatar,
        phone: selectUser.phone || '',
      });
    }
    if (!selectId || hasAutoSelected.current) return;

    const found = conversations.find((c) => String(c.user?.id) === String(selectId));
    if (found) {
      hasAutoSelected.current = true;
      selectConversation(found);
      return;
    }

    if (selectUser && String(selectUser.id) === String(selectId) && currentUserId) {
      hasAutoSelected.current = true;
      const role = normalizeRole(selectUser.role || 'admin');
      const convId = buildConversationId(currentUserRole, currentUserId, role, selectUser.id);
      selectConversation({
        id: convId,
        isGroup: false,
        isHidden: false,
        user: {
          id: String(selectUser.id),
          name: selectUser.name || 'Người dùng',
          role,
          avatar: selectUser.avatar,
          phone: selectUser.phone || '',
          online: true,
        },
        lastMessage: 'Bắt đầu cuộc trò chuyện',
        lastTime: new Date(),
        unread: 0,
      });
    }
  }, [location.state?.selectUserId, location.state?.selectUser, conversations, currentUserId, currentUserRole]);

  return (
    <div className="cms-chat-shell">
      {/* ═══════ MAIN AREA ═══════ */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Sidebar: Conversations ── */}
        <div className={`
          w-full md:w-[min(42%,280px)] lg:w-[340px] xl:w-[380px] bg-white border-r border-gray-100 flex flex-col flex-shrink-0 min-w-0
          ${activeConv ? 'hidden md:flex' : 'flex'}
        `}>
          {/* Search & Add Group */}
          <div className="cms-chat-search-sticky">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm kiếm danh bạ..."
                  className="cms-input pl-10 pr-3"
                />
              </div>
              {currentUserRole !== 'student' && (
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  className="w-12 h-12 flex shrink-0 items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors shadow-sm"
                  title="Tạo nhóm chat"
                  aria-label="Tạo nhóm chat"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>

            {/* Hàng Tabs (Pills) Phân loại danh bạ */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'student', label: 'Học viên' },
                { id: 'teacher', label: 'Giảng viên' },
                { id: 'admin', label: 'Admin' },
                { id: 'group', label: 'Nhóm' }
              ].filter(tab => !(currentUserRole === 'student' && tab.id === 'student')).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setContactTab(tab.id)}
                  className={contactTab === tab.id ? 'cms-chip cms-chip-active' : 'cms-chip'}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-2 py-3 bg-white space-y-1 overscroll-contain">
            {filteredConvs.map(conv => {
              const isGroup = !!(groups || []).find(g => g._id === conv.user.id);
              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation({ ...conv, isGroup })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectConversation({ ...conv, isGroup });
                    }
                  }}
                  className={`cms-chat-conv-row ${
                    activeConv?.id === conv.id ? 'cms-chat-conv-row-active' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-md relative z-10 overflow-hidden ${
                      isGroup ? 'bg-red-500' : 'bg-white ring-2 ' + (
                        conv.user.role === 'teacher' ? 'ring-amber-400/80'
                          : conv.user.role === 'student' ? 'ring-sky-400/80'
                            : conv.user.role === 'admin' ? 'ring-rose-400/80'
                              : 'ring-slate-300'
                      )
                    }`}>
                      {isGroup ? (
                        <Users size={20} />
                      ) : (
                        <img
                          src={resolveAvatarUrl(conv.user)}
                          alt={conv.user.name || ''}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (el.dataset.fallback === '1') return;
                            el.dataset.fallback = '1';
                            const role = String(conv.user.role || '').toLowerCase();
                            el.src = DEFAULT_AVATARS[role] || DEFAULT_AVATARS.staff;
                          }}
                        />
                      )}
                    </div>
                    {!isGroup && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 z-20 text-[8px] px-1 min-w-[18px] h-4 rounded-md font-black leading-none flex items-center justify-center shadow-sm border border-white ${
                          conv.user.role === 'teacher' ? 'bg-amber-500 text-white'
                            : conv.user.role === 'student' ? 'bg-sky-500 text-white'
                              : conv.user.role === 'admin' ? (
                                Array.isArray(conv.user.permissions) && conv.user.permissions.length === 1 && conv.user.permissions.includes('manage_messages')
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-rose-600 text-white'
                              )
                                : 'bg-slate-600 text-white'
                        }`}
                      >
                        {conv.user.role === 'teacher' ? 'GV' : conv.user.role === 'student' ? 'HV' : (
                          Array.isArray(conv.user.permissions) && conv.user.permissions.length === 1 && conv.user.permissions.includes('manage_messages')
                            ? 'HT'
                            : 'AD'
                        )}
                      </span>
                    )}
                    {!isGroup && isUserOnline(conv.user.id) && (
                      <span className="absolute bottom-0 left-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white z-20" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0 pr-1">
                    <div className="flex justify-between items-center gap-2 mb-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <h4 className="font-semibold text-[#1E293B] text-base truncate">{conv.user.name}</h4>
                        {conv.unread > 0 && (
                          <span className="ml-1 min-w-[16px] h-4 px-1 bg-red-600 rounded-full text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                            {conv.unread > 99 ? '99+' : conv.unread}
                          </span>
                        )}
                        {conv.user.branchCode && (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0">
                            {conv.user.branchCode}
                          </span>
                        )}
                        {currentUserRole === 'admin' && conv.user.phone && (
                          <a 
                            href={`https://zalo.me/${conv.user.phone.replace(/\s+/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:scale-110 transition-transform cursor-pointer flex-shrink-0"
                            title="Chat Zalo"
                          >
                            <span className="bg-brand-zalo text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm tracking-wide shadow-sm">Zalo</span>
                          </a>
                        )}

                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={(e) => handleHideConversation(e, conv.id)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                          title="Ẩn cuộc trò chuyện"
                        >
                          <EyeOff size={14} />
                        </button>
                        <span className="text-xs text-slate-400 font-medium tabular-nums">{formatTime(conv.lastTime)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 overflow-hidden">
                      <p className={`text-[13px] truncate flex-1 font-medium ${conv.unread > 0 ? 'text-blue-600 border-l-[3px] border-blue-600 pl-1.5' : 'text-slate-500'}`}>
                        {conv.lastMessage || 'Bắt đầu trò chuyện...'}
                      </p>
                      {conv.unread > 0 && (
                        <div className="flex gap-1 items-center shrink-0">
                          <span className="px-1.5 py-0.5 bg-red-500 rounded-md text-white text-[10px] font-semibold animate-pulse shadow-sm">
                            Mới
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Chat Area ── */}
        <div className={`flex-1 flex flex-col bg-[#F8FAFC] min-w-0 ${!activeConv ? 'hidden md:flex' : 'flex'} relative`}>
          {!activeConv ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center p-8 bg-white/50 backdrop-blur-sm">
              <div className="text-center animate-in fade-in zoom-in duration-500">
                <div className="mb-6 relative inline-block">
                   <div className="absolute inset-0 bg-blue-100 rounded-full blur-2xl opacity-20 animate-pulse" />
                   <div className="relative w-24 h-24 bg-white rounded-[32px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 flex items-center justify-center">
                     <MessageCircle size={40} className="text-blue-500" />
                   </div>
                   <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg border-2 border-white rotate-12">
                     <CheckCircle2 size={20} />
                   </div>
                </div>
                <h3 className="text-slate-900 font-black text-xl mb-2">Trung tâm Tin học & Công nghệ</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto text-[14px] leading-relaxed">
                  Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu thảo luận hoặc gửi tài liệu.
                </p>
                 <div className="mt-8 flex flex-wrap gap-3 justify-center">
                    {['admin', 'staff'].includes(currentUserRole) ? (
                      <>
                         <button 
                           onClick={() => setBroadcastConfig({ targetRole: 'admin', label: 'Kênh Admin' })}
                           className="px-4 py-2 bg-white hover:bg-slate-50 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest border border-slate-100 shadow-sm transition-all active:scale-95"
                         >
                           📢 Gửi toàn bộ Admin
                         </button>
                         <button 
                           onClick={() => setBroadcastConfig({ targetRole: 'teacher', label: 'Giảng viên' })}
                           className="px-4 py-2 bg-white hover:bg-slate-50 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest border border-slate-100 shadow-sm transition-all active:scale-95"
                         >
                           📢 Gửi toàn bộ Giảng viên
                         </button>
                         <button 
                           onClick={() => setBroadcastConfig({ targetRole: 'student', label: 'Học viên' })}
                           className="px-4 py-2 bg-white hover:bg-slate-50 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest border border-slate-100 shadow-sm transition-all active:scale-95"
                         >
                           📢 Gửi toàn bộ Học viên
                         </button>
                      </>
                    ) : (
                      <>
                         <span className="px-3 py-1.5 bg-white rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 shadow-sm">Kênh Admin</span>
                         <span className="px-3 py-1.5 bg-white rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 shadow-sm">Giảng viên</span>
                         <span className="px-3 py-1.5 bg-white rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 shadow-sm">Học viên</span>
                      </>
                    )}
                 </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="cms-chat-header">
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => setActiveConv(null)}
                    className="md:hidden shrink-0 w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl text-slate-700 transition-colors"
                    aria-label="Quay lại danh sách"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold overflow-hidden ring-2 ring-white shadow-sm ${
                      activeConv.isGroup ? 'bg-red-500' : 'bg-white'
                    }`}>
                      {activeConv.isGroup ? (
                        <Users size={16} />
                      ) : (
                        <img
                          src={resolveAvatarUrl(activeConv.user)}
                          alt={activeConv.user.name || ''}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const el = e.currentTarget;
                            if (el.dataset.fallback === '1') return;
                            el.dataset.fallback = '1';
                            const role = String(activeConv.user.role || '').toLowerCase();
                            el.src = DEFAULT_AVATARS[role] || DEFAULT_AVATARS.staff;
                          }}
                        />
                      )}
                    </div>
                    {!activeConv.isGroup && isUserOnline(activeConv.user.id) && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-base truncate">{activeConv.user.name}</p>
                      {activeConv.user.branchCode && (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-sm">
                          Cơ sở: {activeConv.user.branchCode}
                        </span>
                      )}
                      {currentUserRole === 'admin' && activeConv.user.phone && (
                        <a 
                          href={`https://zalo.me/${activeConv.user.phone.replace(/\s+/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:scale-110 transition-transform cursor-pointer"
                          title="Chat Zalo"
                        >
                          <span className="bg-brand-zalo text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm tracking-wide">Zalo</span>
                        </a>
                      )}

                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {activeConv.isGroup
                        ? 'Nhóm trò chuyện'
                        : getUserStatusText(activeConv.user.id, isUserOnline(activeConv.user.id))}
                    </p>
                  </div>
                </div>
                {activeConv.isGroup && currentUserRole !== 'student' && (
                  <button
                    onClick={() => setGroupToDelete(activeConv.id.replace('group_', ''))}
                    className="flex shrink-0 items-center justify-center w-8 h-8 md:w-9 md:h-9 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm"
                    title="Xóa nhóm vĩnh viễn"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="cms-chat-messages">
                {messages.map(msg => {
                  const isMine = messageIsFromMe(msg, currentUserId, currentUserRole);
                  const role = normalizeRole(msg.senderRole);

                  const bubbleRoleClass =
                    !isMine && role === 'admin'
                      ? 'cms-bubble-other-admin'
                      : !isMine && role === 'teacher'
                        ? 'cms-bubble-other-teacher'
                        : !isMine && role === 'student'
                          ? 'cms-bubble-other-student'
                          : '';

                  const heartCount = (msg.reactions || []).filter(r => r.type === 'heart').length;
                  const likeCount = (msg.reactions || []).filter(r => r.type === 'like').length;
                  const myReactions = (msg.reactions || []).filter(r => r.userId === currentUserId).map(r => r.type);

                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group/msg relative`}>
                      <div className={`max-w-[85%] md:max-w-[70%] relative ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {!isMine && (
                          <div className="flex items-center gap-2 mb-1 ml-1">
                             <p className="text-xs text-gray-500 font-semibold">{msg.senderName}</p>
                             <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                               role === 'admin' ? 'bg-red-500 text-white' :
                               role === 'teacher' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                             }`}>
                               {role === 'admin' ? 'Admin' : role === 'teacher' ? 'Giảng viên' : 'Học viên'}
                             </span>
                          </div>
                        )}

                        {/* Bubble + action buttons */}
                        <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>

                          {/* Message bubble */}
                          <div className={`relative px-4 py-2.5 text-[14px] leading-relaxed transition-all ${
                            isMine ? 'cms-bubble-mine' : 'cms-bubble-other'
                          } ${bubbleRoleClass}`}>
                            {msg.isRecalled ? (
                               <p className="italic text-gray-400 flex items-center gap-1.5 text-xs">
                                 <RotateCcw size={12} /> Tin nhắn đã được thu hồi
                               </p>
                            ) : isAttachmentExpired(msg) ? (
                              <p className="italic text-amber-600/90 flex items-start gap-1.5 text-xs leading-relaxed">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <span>{msg.content || 'Tệp đính kèm đã hết hạn lưu trữ (10 ngày) và không còn được lưu trên hệ thống.'}</span>
                              </p>
                            ) : isImageMessage(msg) ? (
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openImagePreview(msg);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openImagePreview(msg);
                                      }
                                    }}
                                    className="group/img relative block w-full max-w-[min(420px,100%)] -mx-1 cursor-zoom-in touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-xl"
                                    title="Bấm để xem ảnh lớn"
                                  >
                                    <img
                                      src={resolveMediaUrl(msg.fileUrl)}
                                      alt={showFileName(msg.fileName) || 'Hình ảnh'}
                                      className="w-full h-auto rounded-xl max-h-96 object-contain border border-black/5 bg-black/5 select-none"
                                      draggable={false}
                                    />
                                    <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold shadow-sm pointer-events-none">
                                      <ZoomIn size={12} /> Phóng to
                                    </span>
                                  </div>
                                ) : msg.messageType === 'file' ? (
                                  <a href={resolveMediaUrl(msg.fileUrl)} download={showFileName(msg.fileName)} className={`flex items-center gap-3 py-2 px-3 rounded-xl transition hover:opacity-80 ${isMine ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                    <div className={`p-2 rounded-lg ${isMine ? 'bg-white/20' : 'bg-red-500 text-white'}`}>
                                      <Paperclip size={18} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-semibold text-xs truncate max-w-[150px]">{showFileName(msg.fileName)}</span>
                                      <span className="text-[10px] font-medium opacity-50">Tài liệu đính kèm</span>
                                    </div>
                                  </a>
                                ) : msg.content}

                            {/* Reaction badge */}
                            {!msg.isRecalled && (heartCount > 0 || likeCount > 0) && (
                              <div className={`cms-bubble-reactions absolute -bottom-3 ${isMine ? 'right-2' : 'left-2'}`}>
                                 {heartCount > 0 && (
                                   <span className="flex items-center gap-0.5 text-[11px]">
                                     <span>❤️</span>
                                     {heartCount > 1 && <span className="text-gray-500 font-bold">{heartCount}</span>}
                                   </span>
                                 )}
                                 {likeCount > 0 && (
                                   <span className="flex items-center gap-0.5 text-[11px]">
                                     <span>👍</span>
                                     {likeCount > 1 && <span className="text-gray-500 font-bold">{likeCount}</span>}
                                   </span>
                                 )}
                              </div>
                            )}
                          </div>

                          {/* Reaction picker button */}
                          {!msg.isRecalled && (
                            <ReactionPicker
                              msgId={msg.id}
                              isMine={isMine}
                              onReact={handleReaction}
                              myReactions={myReactions}
                            />
                          )}
                          
                          {/* Options/Menu button for Soft Delete */}
                          <div className="relative">
                            <button
                              onClick={() => setShowMessageOptions(showMessageOptions === msg.id ? null : msg.id)}
                              className="opacity-0 group-hover/msg:opacity-100 w-7 h-7 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-slate-600 hover:bg-slate-100 transition-all shadow-sm border border-slate-100 active:scale-90"
                              title="Tùy chọn"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                            {showMessageOptions === msg.id && (
                              <div className={`absolute bottom-full mb-1 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 ${isMine ? 'right-0' : 'left-0'}`}>
                                {msg.fileUrl && !isAttachmentExpired(msg) && (
                                  <button
                                    onClick={() => handleDownload(msg.fileUrl, msg.fileName)}
                                    className="flex items-center gap-2 whitespace-nowrap bg-white px-3 py-2 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-slate-100 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                                  >
                                    <Download size={12} /> Tải {msg.messageType === 'image' ? 'ảnh' : 'tệp'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteHistory(msg.id)}
                                  className="flex items-center gap-2 whitespace-nowrap bg-white px-3 py-2 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-slate-100 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={12} /> Xóa lịch sử
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Thu hồi button — chỉ hiện khi là tin của mình, chưa thu hồi và trong vòng 24h */}
                          {isMine && !msg.isRecalled && (() => {
                            const now = new Date();
                            const sentAt = new Date(msg.time);
                            const diffHours = (now - sentAt) / (1000 * 60 * 60);
                            return diffHours <= 24;
                          })() && (
                            <button
                              onClick={() => handleRecall(msg.id)}
                              disabled={recallingId === msg.id}
                              className="opacity-0 group-hover/msg:opacity-100 w-7 h-7 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm border border-slate-100 active:scale-90 disabled:opacity-30"
                              title="Thu hồi tin nhắn"
                            >
                              {recallingId === msg.id
                                ? <span className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full inline-block animate-spin" />
                                : <RotateCcw size={12} />
                              }
                            </button>
                          )}

                        </div>

                        {/* Time & read status */}
                        <div className={`flex items-center gap-1.5 mt-1.5 ${isMine ? 'justify-end' : ''}`}>
                          <span className="text-[10px] text-slate-400 font-medium tabular-nums">{formatTime(msg.time)}</span>
                          {isMine && !msg.isRecalled && String(msg.id).startsWith('temp_') ? (
                            <span title="Chưa gửi được (Kết nối yếu)">
                              <AlertCircle size={10} className="text-red-500 animate-pulse" />
                            </span>
                          ) : isMine && !msg.isRecalled && (
                            <span title={msg.isRead ? "Đã xem" : "Đã nhận"}>
                              {msg.isRead ? (
                                <CheckCheck size={12} className="text-blue-500" />
                              ) : (
                                <CheckCircle2 size={10} className="text-gray-300" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="cms-chat-input-bar relative z-10">
                {uploadError && (
                  <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{uploadError}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 relative max-w-4xl mx-auto">
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />

                  <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Gửi ảnh (tối đa 5MB, lưu 10 ngày)"
                    >
                      {isUploading ? <span className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full inline-block animate-spin" /> : <Image size={20} />}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-sm rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Đính kèm tài liệu (tối đa 5MB, lưu 10 ngày)"
                    >
                      <Paperclip size={20} />
                    </button>
                  </div>

                  <div className="flex-1 relative flex flex-col justify-end">
                    {pendingImage && (
                      <div className="mb-2 p-2 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between gap-2 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={resolveMediaUrl(pendingImage.url)}
                            alt="Preview"
                            className="w-10 h-10 object-cover rounded-lg border border-blue-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">Ảnh từ bộ nhớ tạm (Clipboard)</p>
                            <p className="text-[11px] text-blue-600 font-semibold truncate">{pendingImage.fileName}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingImage(null)}
                          className="w-7 h-7 rounded-lg bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition shrink-0"
                          title="Bỏ chọn ảnh"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {showEmojis && (
                      <div className="absolute bottom-full left-0 mb-3 bg-white p-2 rounded-2xl shadow-2xl border border-gray-100 flex gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                        {EMOJIS.map(e => (
                          <button key={e} onClick={() => addEmoji(e)} className="text-xl hover:scale-125 transition-transform">{e}</button>
                        ))}
                      </div>
                    )}
                    <div className="relative w-full">
                      <input
                        ref={inputRef}
                        value={newMsg}
                        onChange={e => setNewMsg(e.target.value)}
                        onKeyDown={handleKeyPress}
                        onPaste={handlePaste}
                        className="cms-input pl-4 pr-10 w-full"
                        placeholder={pendingImage ? "Nhập thêm Lời nhắn (nếu có) rồi nhấn Enter..." : "Nhập tin nhắn..."}
                      />
                      <button
                        onClick={() => setShowEmojis(!showEmojis)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${showEmojis ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <Smile size={18} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!newMsg.trim() && !pendingImage}
                    className="cms-btn cms-btn-primary cms-btn-icon"
                    title="Gửi tin nhắn"
                  >
                    <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Create Group Modal ── */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-[24px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-280 max-h-[min(92dvh,720px)] flex flex-col">
              <div className="px-5 py-4 bg-gradient-to-br from-red-700 to-red-900 text-white flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-2.5 min-w-0">
                   <Users size={18} className="text-red-200 shrink-0" />
                   <h3 className="font-semibold text-base tracking-tight truncate">Tạo nhóm chat mới</h3>
                 </div>
                 <button type="button" onClick={() => setShowCreateGroup(false)} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors" aria-label="Đóng"><X size={18}/></button>
              </div>
              <div className="p-5 space-y-5 overflow-y-auto min-h-0 flex-1">
                <div>
                   <label className="text-[13px] font-medium text-slate-600 mb-1.5 block">Tên nhóm</label>
                   <input
                     type="text"
                     value={groupName}
                     onChange={e => setGroupName(e.target.value)}
                     placeholder="Ví dụ: Nhóm học Tiếng Anh Giao Tiếp..."
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10 focus:bg-white transition-all font-medium text-sm text-slate-800"
                   />
                </div>

                 <div>
                  <label className="text-[13px] font-medium text-slate-600 mb-1.5 block">Chọn thành viên</label>
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Tìm tên giáo viên hoặc học viên..."
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-red-300 focus:bg-white transition-all font-medium text-slate-700"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                     {contacts
                       .filter(u => u.id !== currentUserId && u.id !== 'admin')
                       .filter(u => !memberSearch || (u.name || '').toLowerCase().includes(memberSearch.toLowerCase()))
                       .map(u => {
                         const isSelected = selectedParticipants.some(p => p.userId === u.id);
                         return (
                          <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all group ${isSelected ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>
                             <div className="relative">
                               <input
                                 type="checkbox"
                                 className="w-5 h-5 rounded-md border-2 border-slate-200 text-red-600 focus:ring-red-500 transition-all cursor-pointer"
                                 checked={isSelected}
                                 onChange={(e) => {
                                   if (e.target.checked) setSelectedParticipants([...selectedParticipants, { userId: u.id, name: u.name, role: u.role }]);
                                   else setSelectedParticipants(selectedParticipants.filter(p => p.userId !== u.id));
                                 }}
                               />
                             </div>
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm ${
                               u.role === 'admin' ? 'bg-red-500' :
                               u.role === 'teacher' ? 'bg-amber-600' : 'bg-emerald-600'
                             }`}>
                               {(u.name || '?')[0].toUpperCase()}
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{u.name}</p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {u.role === 'admin' ? 'Nhân viên / Admin' :
                                  u.role === 'teacher' ? 'Giảng viên' : 'Học viên'}
                                </p>
                             </div>
                          </label>
                         );
                       })}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateGroup(false)}
                    className="flex-1 min-h-12 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={!groupName.trim() || selectedParticipants.length === 0}
                    onClick={async () => {
                      try {
                        const newGroup = await createChatGroup(groupName, selectedParticipants);
                        if (newGroup) {
                          setShowCreateGroup(false);
                          setGroupName('');
                          setSelectedParticipants([]);
                          toast?.success('Tạo nhóm thành công!');
                        } else {
                          toast?.error('Không thể tạo nhóm. Vui lòng thử lại.');
                        }
                      } catch (err) {
                        toast?.error('Lỗi kết nối máy chủ.');
                      }
                    }}
                    className="flex-[1.4] min-h-12 py-3 px-4 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Tạo nhóm ngay
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* ── Delete Group Confirm Modal ── */}
      {groupToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-500 text-center p-8">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="font-black text-xl text-slate-800 mb-2">Xóa Nhóm Này?</h3>
              <p className="text-sm text-slate-500 font-bold mb-8 leading-relaxed">
                Toàn bộ tin nhắn và dữ liệu nhóm sẽ bị <span className="text-red-500">xóa vĩnh viễn</span> và không thể khôi phục. Bạn chắc chắn chứ?
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setGroupToDelete(null)}
                  className="flex-1 py-3.5 px-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={async () => {
                    const success = await deleteChatGroup(groupToDelete);
                    if (success) {
                       toast.success('Đã xóa nhóm vĩnh viễn');
                       setActiveConv(null);
                    } else {
                       toast.error('Có lỗi xảy ra khi xóa nhóm');
                    }
                    setGroupToDelete(null);
                  }}
                  className="flex-1 py-3.5 px-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                >
                  Xóa Vĩnh Viễn
                </button>
              </div>
           </div>
        </div>
      )}
      <ImageLightbox
        preview={imagePreview}
        onClose={() => setImagePreview(null)}
        onDownload={handleDownload}
      />

      {/* ── Broadcast Message Modal ── */}
      {broadcastConfig && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in slide-in-from-bottom-8 duration-500">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-black text-lg flex items-center gap-2">
                    <Megaphone size={20} /> Gửi tin nhắn hàng loạt
                  </h3>
                  <p className="text-blue-100 text-[11px] font-bold uppercase tracking-widest opacity-80 mt-1">
                    Đối tượng: <span className="text-white bg-white/20 px-2 py-0.5 rounded-lg ml-1">{broadcastConfig.label}</span>
                  </p>
                </div>
                <button onClick={() => setBroadcastConfig(null)} className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"><X size={20}/></button>
              </div>

              <div className="p-8">
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 flex gap-3 items-start">
                  <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-amber-700 font-bold leading-relaxed">
                    Tin nhắn này sẽ được gửi <span className="underline decoration-2">riêng biệt</span> tới từng người dùng thuộc nhóm <span className="text-amber-800 font-black">{broadcastConfig.label}</span>. 
                    {currentUserRole === 'staff' && ' Bạn chỉ có thể gửi cho người dùng thuộc cùng chi nhánh.'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Nội dung thông báo</label>
                    <textarea
                      value={broadcastContent}
                      onChange={(e) => setBroadcastContent(e.target.value)}
                      placeholder="Nhập nội dung tin nhắn gửi đi..."
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-[24px] px-6 py-5 text-[15px] font-medium outline-none focus:border-blue-500 focus:bg-white transition-all h-40 resize-none shadow-inner"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={() => setBroadcastConfig(null)}
                      disabled={isBroadcasting}
                      className="flex-1 py-4 px-6 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={async () => {
                        if (!broadcastContent.trim()) return toast.error('Vui lòng nhập nội dung');
                        setIsBroadcasting(true);
                        try {
                          const res = await messagesAPI.broadcast(broadcastConfig.targetRole, broadcastContent);
                          if (res.success) {
                             toast.success(res.message || 'Đã gửi tin nhắn thành công');
                             setBroadcastConfig(null);
                             setBroadcastContent('');
                          } else {
                             toast.error(res.message || 'Lỗi khi gửi tin nhắn');
                          }
                        } catch (err) {
                           toast.error('Lỗi kết nối máy chủ');
                        } finally {
                           setIsBroadcasting(false);
                        }
                      }}
                      disabled={isBroadcasting || !broadcastContent.trim()}
                      className="flex-[2] py-4 px-6 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-xl hover:shadow-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                    >
                      {isBroadcasting ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang gửi...</>
                      ) : (
                        <><Send size={16} /> Gửi ngay bây giờ</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
