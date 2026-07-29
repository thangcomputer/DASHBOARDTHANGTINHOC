import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { buildConversationId, normalizeChatRole } from '../utils/chatConversationId';

const FloatingMessengerContext = createContext(null);

const MAX_OPEN_CHATS = 3;
const STORAGE_KEY = 'cms_floating_messenger_v1';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { supportOpen: true, tabs: [] };
    const parsed = JSON.parse(raw);
    return {
      supportOpen: parsed.supportOpen !== false,
      tabs: Array.isArray(parsed.tabs) ? parsed.tabs.slice(0, MAX_OPEN_CHATS) : [],
    };
  } catch {
    return { supportOpen: true, tabs: [] };
  }
}

export function FloatingMessengerProvider({ children, currentUserId, currentUserRole }) {
  const initial = loadPersisted();
  const [supportOpen, setSupportOpen] = useState(initial.supportOpen);
  const [tabs, setTabs] = useState(initial.tabs);
  const [activeTabId, setActiveTabId] = useState(initial.tabs[0]?.id || null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        supportOpen,
        tabs: tabs.map((t) => ({
          id: t.id,
          user: t.user,
          minimized: !!t.minimized,
        })),
      }));
    } catch { /* ignore */ }
  }, [supportOpen, tabs]);

  const openChat = useCallback((person) => {
    if (!person?.id || !currentUserId) return null;
    const role = normalizeChatRole(person.role || 'admin');
    const myRole = normalizeChatRole(currentUserRole || 'student');
    const convId = buildConversationId(myRole, currentUserId, role, person.id);
    const user = {
      id: String(person.id),
      name: person.name || (role === 'admin' ? 'Admin' : 'Giảng viên'),
      role,
      avatar: person.avatar || '',
    };

    setTabs((prev) => {
      const existing = prev.find((t) => t.id === convId);
      if (existing) {
        return prev.map((t) => (t.id === convId ? { ...t, minimized: false, user } : t));
      }
      const next = [{ id: convId, user, minimized: false }, ...prev];
      // Facebook-style: giữ tối đa MAX_OPEN_CHATS cửa sổ
      return next.slice(0, MAX_OPEN_CHATS);
    });
    setActiveTabId(convId);
    setSupportOpen(true);
    return convId;
  }, [currentUserId, currentUserRole]);

  const closeChat = useCallback((convId) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== convId);
      setActiveTabId((cur) => (cur === convId ? (next[0]?.id || null) : cur));
      return next;
    });
  }, []);

  const toggleMinimize = useCallback((convId) => {
    setTabs((prev) => prev.map((t) => (
      t.id === convId ? { ...t, minimized: !t.minimized } : t
    )));
  }, []);

  const focusChat = useCallback((convId) => {
    setActiveTabId(convId);
    setTabs((prev) => prev.map((t) => (
      t.id === convId ? { ...t, minimized: false } : t
    )));
  }, []);

  // Event toàn site: window.dispatchEvent(new CustomEvent('cms:open-chat', { detail: { id, name, role } }))
  useEffect(() => {
    const onOpen = (e) => {
      const d = e?.detail;
      if (d?.id) openChat(d);
    };
    window.addEventListener('cms:open-chat', onOpen);
    return () => window.removeEventListener('cms:open-chat', onOpen);
  }, [openChat]);

  const value = useMemo(() => ({
    supportOpen,
    setSupportOpen,
    tabs,
    activeTabId,
    openChat,
    closeChat,
    toggleMinimize,
    focusChat,
  }), [supportOpen, tabs, activeTabId, openChat, closeChat, toggleMinimize, focusChat]);

  return (
    <FloatingMessengerContext.Provider value={value}>
      {children}
    </FloatingMessengerContext.Provider>
  );
}

export function useFloatingMessenger() {
  const ctx = useContext(FloatingMessengerContext);
  if (!ctx) {
    return {
      supportOpen: false,
      setSupportOpen: () => {},
      tabs: [],
      activeTabId: null,
      openChat: () => null,
      closeChat: () => {},
      toggleMinimize: () => {},
      focusChat: () => {},
    };
  }
  return ctx;
}
