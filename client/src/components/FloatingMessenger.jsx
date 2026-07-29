/**
 * Floating messenger — Facebook-style:
 * - Panel "Hỗ trợ đang online" mặc định
 * - Nhiều cửa sổ chat (tab) góc dưới phải, tối đa 3
 * - Chat tại chỗ (không điều hướng Inbox) + gửi ảnh/file
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Headphones, MessageCircle, MessageSquare, Minus, Send, X, Circle, Maximize2,
  ImagePlus, Paperclip, FileText, Loader2,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useData } from '../context/DataContext';
import { useFloatingMessenger } from '../context/FloatingMessengerContext';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import { normalizeChatRole } from '../utils/chatConversationId';
import { messagesAPI, resolveMediaUrl } from '../services/api';
import { useToast } from '../utils/toast';

const ROLE_LABEL = { admin: 'Admin', staff: 'NV', teacher: 'GV', student: 'HV' };
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function isSupportPresence(u) {
  const role = normalizeChatRole(u?.role);
  return role === 'admin' || role === 'teacher' || String(u?.userId) === 'admin';
}

function isImageMessage(m) {
  if (!m || m.isRecalled) return false;
  if (m.messageType === 'image') return true;
  if (m.messageType === 'file' && m.fileUrl && IMAGE_EXT_RE.test(`${m.fileName || ''} ${m.fileUrl || ''}`)) {
    return true;
  }
  return false;
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
          <p className="mt-1.5 whitespace-pre-wrap break-words px-0.5">{m.content}</p>
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
          <FileText size={16} className="shrink-0" />
          <span className="truncate">{m.fileName || 'Tệp đính kèm'}</span>
        </a>
      </div>
    );
  }

  return (
    <div className={`cms-fm-bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
      <p className="whitespace-pre-wrap break-words">{m.content}</p>
    </div>
  );
}

function ChatWindow({
  tab, active, meId, meName, meRole, messages, onClose, onMinimize, onFocus, onSend, onSendFile,
}) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const imageRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!tab.minimized) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, tab.minimized, active]);

  useEffect(() => {
    if (!tab.minimized && active) inputRef.current?.focus();
  }, [tab.minimized, active, tab.id]);

  const submit = (e) => {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || uploading) return;
    onSend(tab, body);
    setText('');
  };

  const pickFile = async (e) => {
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

  if (tab.minimized) {
    return (
      <button
        type="button"
        onClick={() => onFocus(tab.id)}
        className="cms-fm-pill"
        title={tab.user.name}
      >
        <span className="relative shrink-0">
          <img
            src={resolveAvatarUrl({ avatar: tab.user.avatar, role: tab.user.role, name: tab.user.name })}
            alt=""
            className="w-9 h-9 rounded-full object-cover"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </span>
        <span className="text-xs font-bold text-slate-800 truncate max-w-[7rem]">{tab.user.name}</span>
        <Maximize2 size={12} className="text-slate-400 shrink-0" />
      </button>
    );
  }

  return (
    <div className={`cms-fm-window ${active ? 'is-active' : ''}`}>
      <div className="cms-fm-window__head" onClick={() => onFocus(tab.id)} role="presentation">
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
          <button type="button" className="cms-fm-icon-btn" onClick={(e) => { e.stopPropagation(); onMinimize(tab.id); }} aria-label="Thu nhỏ">
            <Minus size={14} />
          </button>
          <button type="button" className="cms-fm-icon-btn" onClick={(e) => { e.stopPropagation(); onClose(tab.id); }} aria-label="Đóng">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="cms-fm-window__body">
        {messages.length === 0 ? (
          <p className="text-center text-[12px] text-slate-400 py-8 px-3 font-medium">
            Bắt đầu trò chuyện với {tab.user.name}. Không cần kết bạn.
          </p>
        ) : (
          messages.map((m) => {
            const mine = String(m.senderId) === String(meId);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <MessageBubble m={m} mine={mine} />
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form className="cms-fm-window__foot" onSubmit={submit}>
        <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,image/*"
          className="hidden"
          onChange={pickFile}
        />
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
          onClick={() => fileRef.current?.click()}
          title="Gửi file"
          aria-label="Gửi file"
        >
          <Paperclip size={16} />
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={uploading ? 'Đang tải file…' : 'Nhập tin nhắn...'}
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
  const { onlineUsers } = useSocket() || {};
  const { sendMessage, getMessages } = useData();
  const {
    supportOpen, setSupportOpen, tabs, activeTabId,
    openChat, closeChat, toggleMinimize, focusChat,
  } = useFloatingMessenger();

  const meId = String(session?.id || session?._id || '');
  const meName = session?.name || 'Tôi';
  const meRole = normalizeChatRole(role || session?.role || 'student');

  const supportOnline = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const u of onlineUsers || []) {
      if (!isSupportPresence(u)) continue;
      const uid = String(u.userId || '');
      if (!uid || uid === meId) continue;
      const roleKey = normalizeChatRole(u.role);
      const key = `${roleKey}_${uid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: uid,
        name: u.name || (roleKey === 'admin' ? 'Admin' : 'Giảng viên'),
        role: roleKey,
      });
    }
    list.sort((a, b) => {
      const rank = (r) => (r === 'admin' ? 0 : 1);
      const d = rank(a.role) - rank(b.role);
      if (d !== 0) return d;
      return String(a.name).localeCompare(String(b.name), 'vi');
    });
    return list;
  }, [onlineUsers, meId]);

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

  const handleSendFile = async (tab, file) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File quá lớn (tối đa 5MB)');
      return;
    }
    try {
      const uploadRes = await messagesAPI.uploadMessageFile(file);
      if (!uploadRes?.success) throw new Error(uploadRes?.message || 'Upload thất bại');
      const isImage = file.type.startsWith('image/');
      await sendMessage({
        conversationId: tab.id,
        senderId: meId,
        senderName: meName,
        senderRole: meRole,
        receiverId: tab.user.id,
        receiverName: tab.user.name,
        receiverRole: tab.user.role,
        content: isImage ? '[Hình ảnh]' : `Đã gửi tệp: ${file.name}`,
        messageType: isImage ? 'image' : 'file',
        fileUrl: uploadRes.url,
        fileName: file.name,
        isGroup: false,
      });
    } catch (err) {
      toast.error(err.message || 'Gửi file thất bại');
    }
  };

  return (
    <div className="cms-fm-root" aria-live="polite">
      <div className="cms-fm-chats">
        {[...tabs].reverse().map((tab) => (
          <ChatWindow
            key={tab.id}
            tab={tab}
            active={activeTabId === tab.id}
            meId={meId}
            meName={meName}
            meRole={meRole}
            messages={getMessages(tab.id) || []}
            onClose={closeChat}
            onMinimize={toggleMinimize}
            onFocus={focusChat}
            onSend={handleSend}
            onSendFile={handleSendFile}
          />
        ))}
      </div>

      <div className="cms-fm-dock">
        {supportOpen ? (
          <div className="cms-fm-support">
            <div className="cms-fm-support__head">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Headphones size={15} className="text-emerald-600 shrink-0" />
                  Hỗ trợ đang online
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  Bấm để chat ngay — không cần kết bạn
                </p>
              </div>
              <button
                type="button"
                className="cms-fm-icon-btn"
                onClick={() => setSupportOpen(false)}
                aria-label="Thu gọn hỗ trợ"
              >
                <X size={14} />
              </button>
            </div>
            <div className="cms-fm-support__body">
              {supportOnline.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-slate-400 font-medium">
                  <Circle size={28} className="mx-auto mb-2 text-slate-200" />
                  Chưa có admin / giảng viên online
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {supportOnline.map((p) => (
                    <li key={`${p.role}_${p.id}`}>
                      <button
                        type="button"
                        onClick={() => openChat(p)}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors group"
                      >
                        <span className="relative shrink-0">
                          <img
                            src={resolveAvatarUrl({ role: p.role, name: p.name })}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover"
                          />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-slate-800 truncate group-hover:text-red-600">
                            {p.name}
                          </span>
                          <span className="block text-[11px] text-slate-500 font-medium">
                            {ROLE_LABEL[p.role] || p.role} · Đang hoạt động
                          </span>
                        </span>
                        <MessageCircle size={14} className="text-slate-300 group-hover:text-red-500 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {tabs.length > 0 && (
              <div className="cms-fm-support__tabs">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 px-1 mb-1">
                  Đang chat ({tabs.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => focusChat(t.id)}
                      className={`cms-fm-tab-chip ${activeTabId === t.id ? 'is-active' : ''}`}
                    >
                      {t.user.name.split(' ').slice(-1)[0] || t.user.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setSupportOpen((v) => !v)}
          className="cms-fm-fab"
          title={supportOpen ? 'Thu gọn hỗ trợ' : 'Mở hỗ trợ online'}
          aria-label={supportOpen ? 'Thu gọn hỗ trợ' : 'Mở hỗ trợ online'}
          aria-expanded={supportOpen}
        >
          {supportOpen ? <X size={22} /> : <MessageSquare size={22} />}
          {!supportOpen && supportOnline.length > 0 && (
            <span className="cms-fm-fab__badge">{supportOnline.length}</span>
          )}
        </button>
      </div>
    </div>
  );
}

/** Helper: mở chat từ bất kỳ đâu (không cần hook) */
export function openSiteChat(person) {
  window.dispatchEvent(new CustomEvent('cms:open-chat', { detail: person }));
}
