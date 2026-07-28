import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, AlertCircle, CheckCircle, Info, HelpCircle } from 'lucide-react';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const [modal, setModal] = useState(null);

  const showModal = useCallback(({ title, content, type = 'info', onConfirm, onCancel, confirmText = 'Đóng', cancelText = null, size = 'sm' }) => {
    setModal({ title, content, type, onConfirm, onCancel, confirmText, cancelText, size });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (modal?.onConfirm) modal.onConfirm();
    setModal(null);
  }, [modal]);

  const handleCancel = useCallback(() => {
    if (modal?.onCancel) modal.onCancel();
    setModal(null);
  }, [modal]);

  return (
    <ModalContext.Provider value={{ showModal, closeModal }}>
      {children}
      {modal && <ModalUI modal={modal} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </ModalContext.Provider>
  );
};

const ModalUI = ({ modal, onConfirm, onCancel }) => {
  const typeConfigs = {
    info:     { icon: Info,        tone: 'text-sky-600 bg-sky-50' },
    success:  { icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50' },
    warning:  { icon: AlertCircle, tone: 'text-amber-600 bg-amber-50' },
    error:    { icon: AlertCircle, tone: 'text-red-600 bg-red-50' },
    question: { icon: HelpCircle,  tone: 'text-sky-600 bg-sky-50' },
  };

  const config = typeConfigs[modal.type] || typeConfigs.info;
  const Icon = config.icon;

  return (
    <>
      <div className="cms-sheet-backdrop" onClick={onCancel} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={modal.title || 'Thông báo'}
        className="cms-sheet w-full"
      >
        <div className="cms-sheet-handle md:hidden" aria-hidden="true" />
        <div className="cms-sheet-header">
          <span className={`cms-sheet-header__side ${config.tone}`} aria-hidden="true">
            <Icon size={18} />
          </span>
          <h3 className="cms-sheet-header__title">{modal.title || 'Thông báo'}</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng"
            className="cms-sheet-header__side bg-slate-50 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cms-sheet-body">
          <div className="text-sm text-slate-600 leading-relaxed">
            {modal.content}
          </div>
        </div>

        <div className="cms-sheet-footer">
          {modal.cancelText ? (
            <button type="button" onClick={onCancel} className="cms-btn cms-btn-outline">
              {modal.cancelText}
            </button>
          ) : null}
          {modal.confirmText ? (
            <button type="button" onClick={onConfirm} className="cms-btn cms-btn-primary">
              {modal.confirmText}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
};

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be inside ModalProvider');
  return ctx;
};
