/**
 * Doi favicon + theme-color theo khu vuc URL.
 * /admin* -> favicon admin (tuy chinh hoac mac dinh); con lai -> favicon public.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api, { resolveMediaUrl } from '../services/api';

const PUBLIC_ICON = '/favicon.svg';
const ADMIN_ICON = '/favicon-admin.svg';
const PUBLIC_THEME = '#0f172a';
const ADMIN_THEME = '#991b1b';

function detectIconType(href) {
  const h = String(href || '').split('?')[0].toLowerCase();
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
  document.querySelectorAll("link[rel*='icon']").forEach((el) => el.parentNode?.removeChild(el));
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

export default function FaviconSwitcher() {
  const { pathname } = useLocation();
  const [icons, setIcons] = useState({ publicUrl: '', adminUrl: '', rev: 0 });

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
    const isAdminZone = pathname.startsWith('/admin');
    const custom = isAdminZone ? icons.adminUrl : icons.publicUrl;
    const fallback = isAdminZone ? ADMIN_ICON : PUBLIC_ICON;
    let href = resolveHref(custom, fallback);
    if (icons.rev > 0 && custom) {
      href += (href.includes('?') ? '&' : '?') + 'v=' + icons.rev;
    }
    setFavicon(href);
    setThemeColor(isAdminZone ? ADMIN_THEME : PUBLIC_THEME);
  }, [pathname, icons]);

  return null;
}
