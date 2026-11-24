/**
 * Doi favicon + theme-color theo khu vuc URL + nhap nhay favicon/title/app-badge khi co tin nhan hoac thong bao chua doc.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api, { resolveMediaUrl } from '../services/api';
import {
  TAB_ATTENTION_EVENT,
  buildAttentionTitle,
  getCurrentTabAttention,
  renderBadgedFaviconDataUrl,
  syncNavigatorAppBadge,
} from '../utils/tabAttention';

const PUBLIC_ICON = '/favicon.svg';
const ADMIN_ICON = '/favicon-admin.svg';
const PUBLIC_THEME = '#0f172a';
const ADMIN_THEME = '#10B981';

function detectIconType(href) {
  const h = String(href || '').split('?')[0].toLowerCase();
  if (h.startsWith('data:image/png')) return 'image/png';
  if (h.endsWith('.svg')) return 'image/svg+xml';
  if (h.endsWith('.png')) return 'image/png';
  if (h.endsWith('.ico')) return 'image/x-icon';
  if (h.endsWith('.webp')) return 'image/webp';
  if (h.endsWith('.gif')) return 'image/gif';
  if (h.endsWith('.jpg') || h.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

function resolveHref(url, fallback) {
  const raw = String(url || '').trim();
  if (!raw) return fallback;
  return resolveMediaUrl(raw) || raw;
}

function setFavicon(href) {
  const existing = document.getElementById('app-favicon');
  document.querySelectorAll("link[rel*='icon']").forEach((el) => {
    if (el !== existing) el.parentNode?.removeChild(el);
  });
  if (existing) {
    existing.rel = 'icon';
    existing.type = detectIconType(href);
    existing.href = href;
    return;
  }
  const link = document.createElement('link');
  link.id = 'app-favicon';
  link.rel = 'icon';
  link.type = detectIconType(href);
  link.href = href;
  document.head.appendChild(link);
}

function setThemeColor(color) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

function stripLeadingCountPrefix(title) {
  return String(title || '').replace(/^(?:🔴|💬|🔔)?\s*\(\d+\+?\)\s*/u, '').trim();
}

export default function FaviconSwitcher() {
  const { pathname } = useLocation();
  const [icons, setIcons] = useState({ publicUrl: '', adminUrl: '', rev: 0 });
  const [attention, setAttention] = useState(() => getCurrentTabAttention());
  const baseTitleRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.settings.getWeb()
        .then((res) => {
          if (cancelled || !res?.success || !res.data) return;
          setIcons((prev) => ({
            publicUrl: res.data.faviconUrl || '',
            adminUrl: res.data.faviconAdminUrl || '',
            rev: prev.rev + 1,
          }));
        })
        .catch(() => {});
    };
    load();
    window.addEventListener('web-settings-changed', load);
    return () => {
      cancelled = true;
      window.removeEventListener('web-settings-changed', load);
    };
  }, []);

  useEffect(() => {
    const onAttention = (event) => {
      const detail = event?.detail;
      if (!detail || typeof detail !== 'object') return;
      setAttention({
        unreadMessages: Math.max(0, Math.floor(Number(detail.unreadMessages) || 0)),
        unreadNotifications: Math.max(0, Math.floor(Number(detail.unreadNotifications) || 0)),
      });
    };
    window.addEventListener(TAB_ATTENTION_EVENT, onAttention);
    return () => window.removeEventListener(TAB_ATTENTION_EVENT, onAttention);
  }, []);

  const { baseHref, themeColor } = useMemo(() => {
    const isAdminZone = pathname.startsWith('/admin');
    const isFreePortal = pathname === '/DANGNHAPMIENPHI' || pathname.startsWith('/DANGNHAPMIENPHI/') || (() => {
      try {
        const u = JSON.parse(localStorage.getItem('student_user') || '{}');
        return u?.freePortal === true;
      } catch {
        return false;
      }
    })();
    const custom = isAdminZone ? icons.adminUrl : isFreePortal ? '/brand/favicon.png' : icons.publicUrl;
    const fallback = isAdminZone ? ADMIN_ICON : isFreePortal ? '/brand/favicon.png' : PUBLIC_ICON;
    let href = resolveHref(custom, fallback);
    if (icons.rev > 0 && custom) {
      href += (href.includes('?') ? '&' : '?') + 'v=' + icons.rev;
    }
    return {
      baseHref: href,
      themeColor: isAdminZone ? ADMIN_THEME : isFreePortal ? '#059669' : PUBLIC_THEME,
    };
  }, [pathname, icons]);

  useEffect(() => {
    setThemeColor(themeColor);
  }, [themeColor]);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement?.dataset?.tabTitleBlinking !== '1') {
      const clean = stripLeadingCountPrefix(document.title);
      if (clean) baseTitleRef.current = clean;
    }
  }, [pathname]);

  useEffect(() => {
    const unreadMessages = Math.max(0, Math.floor(Number(attention.unreadMessages) || 0));
    const unreadNotifications = Math.max(0, Math.floor(Number(attention.unreadNotifications) || 0));
    const total = unreadMessages + unreadNotifications;

    syncNavigatorAppBadge(typeof navigator !== 'undefined' ? navigator : null, total);

    if (total <= 0) {
      if (document.documentElement?.dataset) {
        delete document.documentElement.dataset.tabTitleBlinking;
      }
      if (baseTitleRef.current && document.title !== baseTitleRef.current) {
        document.title = baseTitleRef.current;
      }
      setFavicon(baseHref);
      return undefined;
    }

    if (document.documentElement?.dataset?.tabTitleBlinking !== '1') {
      const clean = stripLeadingCountPrefix(document.title);
      baseTitleRef.current = clean || baseTitleRef.current || 'Thắng Tin Học';
    }
    if (document.documentElement?.dataset) {
      document.documentElement.dataset.tabTitleBlinking = '1';
    }

    let cancelled = false;
    let phase = 0;

    const applyTick = () => {
      if (cancelled) return;
      const lang = document.documentElement?.lang === 'en' ? 'en' : 'vi';
      document.title = buildAttentionTitle({
        baseTitle: baseTitleRef.current,
        unreadMessages,
        unreadNotifications,
        phase,
        lang,
      });
      void renderBadgedFaviconDataUrl(baseHref, total, phase).then((dataUrl) => {
        if (!cancelled && dataUrl) {
          setFavicon(dataUrl);
        }
      });
      phase = phase === 0 ? 1 : 0;
    };

    applyTick();
    const timer = window.setInterval(applyTick, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (document.documentElement?.dataset) {
        delete document.documentElement.dataset.tabTitleBlinking;
      }
    };
  }, [baseHref, attention.unreadMessages, attention.unreadNotifications, pathname]);

  return null;
}
