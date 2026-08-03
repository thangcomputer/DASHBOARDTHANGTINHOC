/**
 * Chat nổi kiểu Messenger:
 * - Panel "Hỗ trợ online" (danh bạ) tách khỏi cửa sổ chat
 * - Mỗi người = 1 chat-head tròn; bấm head → mở cửa sổ, người trước thu thành head
 * - Gửi text / link / ảnh (không thay Inbox)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Headphones, MessageCircle, MessageSquare, Minus, Send, X, Circle,
  ImagePlus, Link2, Loader2, MoreVertical, RotateCcw,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useData } from '../context/DataContext';
import { useFloatingMessenger } from '../context/FloatingMessengerContext';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import { normalizeChatRole } from '../utils/chatConversationId';
import { messagesAPI, resolveMediaUrl } from '../services/api';
import { useToast } from '../utils/toast';
import {
  isSuperAdminViewer,
  buildSupportDirectory,
} from '../utils/supportPresence';

const ROLE_LABEL = {
  admin: 'Hỗ trợ viên',
  staff: 'Hỗ trợ viên',
  teacher: 'GV',
  student: 'HV',
};
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i;
const URL_RE = /(https?:\/\/[^\s<]+[^.,;:!?\s<])/gi;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function isImageMessage(m) {
  if (!m || m.isRecalled) return false;
  if (m.messageType === 'image') return true;
  if (m.messageType === 'file' && m.fileUrl && IMAGE_EXT_RE.test(`${m.fileName || ''} ${m.fileUrl || ''}`)) {
    return true;
  }
  return false;
}

function TextWithLinks({ text, mine }) {
  const raw = String(text || '');
  const nodes = [];
  let last = 0;
  let match;
  const re = new RegExp(URL_RE.source, 'gi');
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(raw)) !== null) {
    if (match.index > last) nodes.push(raw.slice(last, match.index));
    const url = match[0];
    nodes.push(
      <a
        key={`${match.index}-${url}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className={mine ? 'cms-fm-link is-mine' : 'cms-fm-link'}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    last = match.index + url.length;
  }
  if (last < raw.length) nodes.push(raw.slice(last));
  return <>{nodes.length ? nodes : raw}</>;
}

function MessageBubble({ m, mine }) {
  if (m.isRecalled) {
    return (
      <div className={`cms-fm-bubble ${mine ? 'is-mine' : 'is-theirs'} opacity-70 italic`}>
        Tin nhắn đã thu hồi
      </div>
    );
  }

  if (isImageMessage(m) && m.fileUrl) {
    return (
      <div className={`cms-fm-bubble cms-fm-bubble--media ${mine ? 'is-mine' : 'is-theirs'}`}>
        <a href={resolveMediaUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="block">
          <img
            src={resolveMediaUrl(m.fileUrl)}
            alt={m.fileName || 'Hình ảnh'}
            className="cms-fm-img"
          />
        </a>
        {m.content && m.content !== '[Hình ảnh]' && (
          <p className="mt-1.5 whitespace-pre-wrap break-words px-0.5">
            <TextWithLinks text={m.content} mine={mine} />
          </p>
        )}
      </div>
    );
  }

  if (m.messageType === 'file' && m.fileUrl) {
    return (
      <div className={`cms-fm-bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
        <a
          href={resolveMediaUrl(m.fileUrl)}
          target="_blank"
          rel="noreferrer"
          className={`cms-fm-file ${mine ? 'is-mine' : ''}`}
        >
          <span className="truncate">{m.fileName || 'Tệp đính kèm'}</span>
        </a>
      </div>
    );
  }

  return (
    <div className={`cms-fm-bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
      <p className="whitespace-pre-wrap break-words">
        <TextWithLinks text={m.content} mine={mine} />
      </p>
    </div>
  );
}

function ChatHead({ tab, unread = 0, onOpen, onClose }) {
  return (
    <div className="cms-fm-head-wrap">
      <button
        type="button"
        onClick={() => onOpen(tab.id)}
        className="cms-fm-head"
        title={tab.user.name}
        aria-label={`Mở chat với ${tab.user.name}`}
      >
        <img
          src={resolveAvatarUrl({ avatar: tab.user.avatar, role: tab.user.role, name: tab.user.name })}
          alt=""
          className="cms-fm-head__avatar"
        />
        {unread > 0 ? (
          <span className="cms-fm-head__badge">{unread > 99 ? '99+' : unread}</span>
        ) : (
          <span className="cms-fm-head__online" />
        )}
      </button>
      <button
        type="button"
        className="cms-fm-head__close"
        onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
        aria-label={`Đóng chat ${tab.user.name}`}
        title="Đóng"
      >
        <X size={10} />
      </button>
    </div>
  );
}

function ChatWindow({
  tab, meId, messages, onClose, onMinimize, onSend, onSendFile, onSendLink, onRecall,
}) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeMsgOptions, setActiveMsgOptions] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, tab.id]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [tab.id]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMsgOptions(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleRecallMessage = async (msgId) => {
    try {
      if (onRecall) {
        await onRecall(msgId);
        toast.success('Đã thu hồi tin nhắn');
      }
    } catch {
      toast.error('Không thể thu hồi tin nhắn');
    }
  };

  const submit = (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || uploading) return;
    onSend(tab, body);
    setText('');
  };

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    setUploading(true);
    try {
      await onSendFile(tab, file);
    } finally {
      setUploading(false);
    }
  };

  const insertLink = () => {
    const url = window.prompt('Dán link (https://…)');
    if (!url?.trim()) return;
    let link = url.trim();
    if (!/^https?:\/\//i.test(link)) link = `https://${link}`;
    onSendLink(tab, link);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let imageFile = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        imageFile = items[i].getAsFile();
        break;
      }
    }
    if (!imageFile || uploading) return;
    e.preventDefault();
    setUploading(true);
    try {
      await onSendFile(tab, imageFile);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="cms-fm-window is-active">
      <div className="cms-fm-window__head">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="relative shrink-0">
            <img
              src={resolveAvatarUrl({ avatar: tab.user.avatar, role: tab.user.role, name: tab.user.name })}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-slate-900 truncate leading-tight">{tab.user.name}</p>
            <p className="text-[10px] text-emerald-600 font-semibold">
              {ROLE_LABEL[tab.user.role] || tab.user.role} · Đang hoạt động
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button type="button" className="cms-fm-icon-btn" onClick={() => onMinimize(tab.id)} aria-label="Thu nhỏ thành biểu tượng">
            <Minus size={14} />
          </button>
          <button type="button" className="cms-fm-icon-btn" onClick={() => onClose(tab.id)} aria-label="Đóng chat">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="cms-fm-window__body">
        {messages.length === 0 ? (
          <p className="text-center text-[12px] text-slate-400 py-8 px-3 font-medium">
            Chat với {tab.user.name}. Có thể gửi ảnh, dán ảnh màn hình hoặc dán link.
          </p>
        ) : (
          messages.map((m, idx) => {
            const mine = String(m.senderId) === String(meId);
            const msgId = m.id || m._id;
            const showOptions = activeMsgOptions === msgId;
            const isNearTop = idx < 3 || idx < messages.length / 2;

            return (
              <div key={msgId} className={`group relative flex items-center gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                {mine && !m.isRecalled && (
                  <div className="relative shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleRecallMessage(msgId)}
                      className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Thu hồi tin nhắn ngay"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMsgOptions(showOptions ? null : msgId);
                        }}
                        className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                        title="Tùy chọn tin nhắn"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {showOptions && (
                        <div
                          className={`absolute ${isNearTop ? 'top-full mt-1' : 'bottom-full mb-1'} left-0 z-[200] bg-white border border-slate-200 rounded-xl shadow-2xl p-1.5 w-36 text-xs font-semibold animate-in fade-in zoom-in-95 duration-150 shadow-slate-900/20`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMsgOptions(null);
                              handleRecallMessage(msgId);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-left transition font-bold"
                          >
                            <RotateCcw size={14} className="shrink-0 text-red-600" />
                            <span className="whitespace-nowrap">Thu hồi tin nhắn</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <MessageBubble m={m} mine={mine} />
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form className="cms-fm-window__foot" onSubmit={submit}>
        <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
        <button
          type="button"
          className="cms-fm-attach"
          disabled={uploading}
          onClick={() => imageRef.current?.click()}
          title="Gửi ảnh"
          aria-label="Gửi ảnh"
        >
          <ImagePlus size={16} />
        </button>
        <button
          type="button"
          className="cms-fm-attach"
          disabled={uploading}
          onClick={insertLink}
          title="Gửi link"
          aria-label="Gửi link"
        >
          <Link2 size={16} />
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(e);
            }
          }}
          onPaste={handlePaste}
          placeholder={uploading ? 'Đang gửi ảnh…' : 'Aa (Dán ảnh Ctrl+V)'}
          disabled={uploading}
          className="cms-fm-input"
        />
        <button type="submit" disabled={!text.trim() || uploading} className="cms-fm-send" aria-label="Gửi">
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
}

export default function FloatingMessenger({ session, role }) {
  const location = useLocation();
  const isInbox = location.pathname.includes('/inbox');
  const toast = useToast();
  const { onlineUsers, onMessageReceive } = useSocket() || {};
  const { sendMessage, getMessages, getConversations, markMessagesRead, recallMessage } = useData();
  const {
    supportOpen, setSupportOpen, tabs, activeTabId,
    openChat, closeChat, minimizeChat, focusChat,
  } = useFloatingMessenger();

  const meId = String(session?.id || session?._id || '');
  const meName = session?.name || 'Tôi';
  const meRole = normalizeChatRole(role || session?.role || 'student');
  const isSuper = isSuperAdminViewer(session);

  const conversations = useMemo(
    () => (meId ? (getConversations(meId) || []) : []),
    [getConversations, meId],
  );

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (Number(c.unread) || 0), 0),
    [conversations],
  );

  const unreadByPeer = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      if (!c?.user?.id || !(c.unread > 0) || c.isGroup) continue;
      map.set(`${normalizeChatRole(c.user.role)}_${c.user.id}`, Number(c.unread) || 0);
    }
    return map;
  }, [conversations]);

  const directory = useMemo(
    () => buildSupportDirectory({ session, onlineUsers, meId }),
    [session, onlineUsers, meId],
  );

  const unreadConversations = useMemo(() => {
    const list = conversations.filter((c) => (c.unread || 0) > 0 && !c.isGroup);
    if (isSuper) return list.slice(0, 8);
    // Non-super: chỉ tin từ Admin Super
    return list.filter((c) => String(c.user?.id) === 'admin').slice(0, 8);
  }, [conversations, isSuper]);

  const openWindow = tabs.find((t) => !t.minimized) || null;
  const heads = tabs.filter((t) => t.minimized);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // Tin đến → chat-head + badge (không cướp cửa sổ đang mở); tách khỏi Inbox
  useEffect(() => {
    if (!onMessageReceive || !meId || isInbox) return undefined;
    return onMessageReceive((data) => {
      if (!data) return;
      if (String(data.senderId) === meId) return;
      const forMe = String(data.receiverId) === meId
        || (meRole === 'admin' && String(data.receiverId) === 'admin');
      if (!forMe && !data.isGroup) return;

      const peer = {
        id: String(data.senderId),
        name: data.senderName || 'Người dùng',
        role: normalizeChatRole(data.senderRole || 'student'),
        avatar: data.senderAvatar || '',
      };

      const current = tabsRef.current;
      const alreadyThis = current.some((t) => (
        !t.minimized
        && t.user.id === peer.id
        && normalizeChatRole(t.user.role) === peer.role
      ));
      // Đang xem đúng người → giữ cửa sổ; ngược lại chỉ hiện head tròn
      openChat(peer, { expand: alreadyThis });

      const preview = data.messageType === 'image'
        ? 'Đã gửi một hình ảnh'
        : data.messageType === 'file'
          ? `File: ${data.fileName || 'đính kèm'}`
          : String(data.content || '').slice(0, 80);
      toast.info(`${peer.name}: ${preview || 'Tin nhắn mới'}`);
    });
  }, [onMessageReceive, meId, meRole, isInbox, openChat, toast]);

  useEffect(() => {
    if (!meId || !activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.minimized) return;
    const unread = conversations.find((c) => c.id === activeTabId)?.unread || 0;
    if (unread > 0) markMessagesRead?.(activeTabId, meId);
  }, [activeTabId, tabs, conversations, meId, markMessagesRead]);

  if (isInbox || !meId) return null;

  const handleSend = async (tab, content) => {
    await sendMessage({
      conversationId: tab.id,
      senderId: meId,
      senderName: meName,
      senderRole: meRole,
      receiverId: tab.user.id,
      receiverName: tab.user.name,
      receiverRole: tab.user.role,
      content,
      messageType: 'text',
      isGroup: false,
    });
  };

  const handleSendLink = async (tab, link) => {
    await handleSend(tab, link);
  };

  const handleSendFile = async (tab, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ gửi ảnh tại chat nổi. File khác dùng Inbox.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Ảnh quá lớn (tối đa 5MB)');
      return;
    }
    try {
      const uploadRes = await messagesAPI.uploadMessageFile(file);
      if (!uploadRes?.success) throw new Error(uploadRes?.message || 'Upload thất bại');
      await sendMessage({
        conversationId: tab.id,
        senderId: meId,
        senderName: meName,
        senderRole: meRole,
        receiverId: tab.user.id,
        receiverName: tab.user.name,
        receiverRole: tab.user.role,
        content: '[Hình ảnh]',
        messageType: 'image',
        fileUrl: uploadRes.url,
        fileName: file.name,
        isGroup: false,
      });
    } catch (err) {
      toast.error(err.message || 'Gửi ảnh thất bại');
    }
  };

  const handleFocus = (convId) => {
    focusChat(convId);
    if (meId) markMessagesRead?.(convId, meId);
  };

  const isFeedPage = location.pathname.includes('/feed');
  const badgeCount = unreadTotal > 0 ? unreadTotal : 0;
  const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);

  return (
    <div className="cms-fm-root" aria-live="polite">
      {/* Cửa sổ chat đang mở (tối đa 1) */}
      {openWindow && (
        <div className="cms-fm-stage">
          <ChatWindow
            key={openWindow.id}
            tab={openWindow}
            meId={meId}
            messages={getMessages(openWindow.id) || []}
            onClose={closeChat}
            onMinimize={minimizeChat}
            onSend={handleSend}
            onSendFile={handleSendFile}
            onSendLink={handleSendLink}
            onRecall={recallMessage}
          />
        </div>
      )}

      <div className="cms-fm-dock">
        {/* Panel danh bạ nhắn tin — ẩn trên Bảng tin */}
        {supportOpen && !isFeedPage ? (
          <div className="cms-fm-support">
            <div className="cms-fm-support__head">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Headphones size={15} className="text-emerald-600 shrink-0" />
                  {isSuper ? 'Đang hoạt động' : 'Hỗ trợ viên'}
                  {unreadTotal > 0 && (
                    <span className="cms-fm-unread-pill">{badgeLabel} mới</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  {isSuper
                    ? 'Học viên, giảng viên, admin chi nhánh đang online'
                    : 'Gửi tin nhắn trực tiếp tới bộ phận Hỗ trợ viên'}
                </p>
              </div>
              <button
                type="button"
                className="cms-fm-icon-btn"
                onClick={() => setSupportOpen(false)}
                aria-label="Đóng danh bạ hỗ trợ"
              >
                <X size={14} />
              </button>
            </div>
            <div className="cms-fm-support__body">
              {unreadConversations.length > 0 && (
                <div className="px-2 pb-2 mb-1 border-b border-slate-50">
                  <p className="text-[10px] font-black uppercase tracking-wide text-red-500 px-1 mb-1">
                    Tin chưa đọc
                  </p>
                  <ul className="space-y-0.5">
                    {unreadConversations.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            openChat(c.user, { expand: true });
                            markMessagesRead?.(c.id, meId);
                          }}
                          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-red-50 text-left transition-colors"
                        >
                          <span className="relative shrink-0">
                            <img
                              src={resolveAvatarUrl({ role: c.user.role, name: c.user.name })}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover"
                            />
                            <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-red-600 text-[9px] font-black text-white flex items-center justify-center ring-2 ring-white">
                              {c.unread > 99 ? '99+' : c.unread}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold text-slate-800 truncate">{c.user.name}</span>
                            <span className="block text-[11px] text-slate-500 truncate">{c.lastMessage}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {directory.groups.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-slate-400 font-medium">
                  <Circle size={28} className="mx-auto mb-2 text-slate-200" />
                  Chưa có ai đang online
                </div>
              ) : (
                directory.groups.map((group) => (
                  <div key={group.key} className="px-1 pb-2 mb-1">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 px-1.5 mb-1">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.people.map((p) => {
                        const peerUnread = unreadByPeer.get(`${normalizeChatRole(p.role)}_${p.id}`) || 0;
                        const online = p.online !== false;
                        return (
                          <li key={`${p.role}_${p.id}`}>
                            <button
                              type="button"
                              onClick={() => openChat(p, { expand: true })}
                              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors group"
                            >
                              <span className="relative shrink-0">
                                <img
                                  src={resolveAvatarUrl({ role: p.displayRole || p.role, name: p.name })}
                                  alt=""
                                  className="w-9 h-9 rounded-full object-cover"
                                />
                                <span
                                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-bold text-slate-800 truncate group-hover:text-red-600">
                                  {p.name}
                                </span>
                                <span className="block text-[11px] text-slate-500 font-medium">
                                  {ROLE_LABEL[p.displayRole] || ROLE_LABEL[p.role] || p.role}
                                  {' · '}
                                  {online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                                </span>
                              </span>
                              {peerUnread > 0 ? (
                                <span className="min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-red-600 text-[10px] font-black text-white flex items-center justify-center">
                                  {peerUnread > 99 ? '99+' : peerUnread}
                                </span>
                              ) : (
                                <MessageCircle size={14} className="text-slate-300 group-hover:text-red-500 shrink-0" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {/* Chat-heads: mỗi người 1 vòng tròn */}
        {heads.length > 0 && (
          <div className="cms-fm-heads">
            {heads.map((tab) => {
              const peerKey = `${normalizeChatRole(tab.user.role)}_${tab.user.id}`;
              return (
                <ChatHead
                  key={tab.id}
                  tab={tab}
                  unread={unreadByPeer.get(peerKey) || 0}
                  onOpen={handleFocus}
                  onClose={closeChat}
                />
              );
            })}
          </div>
        )}

        {/* FAB tin nhắn — các trang khác; Bảng tin dùng Hỗ trợ nhanh riêng */}
        {!isFeedPage && (
          <button
            type="button"
            onClick={() => setSupportOpen((v) => !v)}
            className="cms-fm-fab"
            title={supportOpen ? 'Đóng danh bạ nhắn tin' : (unreadTotal > 0 ? `${unreadTotal} tin chưa đọc` : 'Nhắn tin')}
            aria-label={supportOpen ? 'Đóng danh bạ nhắn tin' : 'Mở nhắn tin'}
            aria-expanded={supportOpen}
          >
            {supportOpen ? <X size={22} /> : <MessageSquare size={22} />}
            {!supportOpen && unreadTotal > 0 && (
              <span className="cms-fm-fab__badge is-unread">{badgeLabel}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/** Helper: mở chat từ bất kỳ đâu (không cần hook) */
export function openSiteChat(person) {
  window.dispatchEvent(new CustomEvent('cms:open-chat', { detail: person }));
}
