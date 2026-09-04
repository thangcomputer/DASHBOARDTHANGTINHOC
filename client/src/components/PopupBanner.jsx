/**
 * PopupBanner.jsx
 *
 * Popup thông báo/quảng cáo hiện sau khi đăng nhập.
 * - Gọi API /api/settings/popup để lấy config
 * - Kiểm tra role match
 * - Dùng sessionStorage để chỉ hiện 1 lần/ngày
 * - Đợi các overlay ưu tiên hơn (đổi MK, chào mừng, học phí…) đóng xong mới hiện
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import api from '../services/api';
import {
  setLoginOverlay,
  hasBlockingLoginOverlay,
  subscribeLoginOverlays,
} from '../utils/loginOverlayGate';

const SESSION_KEY = 'cms_popup_seen_';

export default function PopupBanner({ role }) {
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);
  const ownId = `popup-banner-${role}`;
  const pendingId = `${ownId}-pending`;
  const closedRef = useRef(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `${SESSION_KEY}${role}_${today}`;

    if (sessionStorage.getItem(storageKey)) return undefined;

    let cancelled = false;
    api.settings.getPopup()
      .then((res) => {
        if (cancelled || !res.success) return;
        const { isActive, targetRole, title, content, imageUrl } = res.data || {};

        if (!isActive) return;
        if (targetRole !== 'all' && targetRole !== role) return;
        if (!title && !content && !imageUrl) return;

        setPopup({ title, content, imageUrl });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [role]);

  // Giữ chỗ trong hàng đợi khi đã có nội dung nhưng chưa được phép hiện
  useEffect(() => {
    const hold = Boolean(popup) && !visible && !closedRef.current;
    setLoginOverlay(pendingId, hold);
    return () => setLoginOverlay(pendingId, false);
  }, [popup, visible, pendingId]);

  // Chỉ hiện khi không còn overlay ưu tiên hơn
  useEffect(() => {
    if (!popup || closedRef.current || visible) return undefined;

    const tryShow = () => {
      if (closedRef.current || visible) return;
      if (hasBlockingLoginOverlay([ownId, pendingId])) return;
      setVisible(true);
    };

    tryShow();
    return subscribeLoginOverlays(tryShow);
  }, [popup, visible, ownId, pendingId]);

  const handleClose = () => {
    closedRef.current = true;
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `${SESSION_KEY}${role}_${today}`;
    sessionStorage.setItem(storageKey, '1');
    setVisible(false);
    setLoginOverlay(pendingId, false);
  };

  useEffect(() => {
    setLoginOverlay(ownId, visible);
    return () => setLoginOverlay(ownId, false);
  }, [visible, ownId]);

  if (!visible || !popup) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="presentation"
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-label={popup.title || 'Thông báo'}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition shadow-lg"
          title="Đóng thông báo"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {popup.imageUrl && (
          <div className="w-full flex-shrink-0">
            <img
              src={popup.imageUrl.startsWith('http') ? popup.imageUrl : `${import.meta.env.VITE_API_URL || ''}${popup.imageUrl}`}
              alt="Thông báo"
              className="w-full object-cover"
              style={{ maxHeight: '280px' }}
            />
          </div>
        )}

        {(popup.title || popup.content) && (
          <div className="p-6 flex-1 overflow-y-auto">
            {popup.title && (
              <h2 className="text-xl font-black text-gray-900 mb-3 leading-tight">
                {popup.title}
              </h2>
            )}
            {popup.content && (
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                {popup.content}
              </p>
            )}
          </div>
        )}

        <div className="px-6 pb-5 pt-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 bg-gradient-to-r from-red-600 to-red-600 text-white font-bold rounded-2xl hover:from-red-700 transition shadow-lg shadow-red-100"
          >
            Đã hiểu, đóng thông báo ✓
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
