import React, { useState } from 'react';

export function StudentNoteModal({ schedule, onClose, onSubmit }) {
  const [note, setNote] = useState(schedule?.studentNote || '');
  const hasExistingNote = Boolean(String(schedule?.studentNote || '').trim());
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-red-600 to-red-600 px-6 py-6 text-center text-white relative">
           <h3 className="text-xl font-black uppercase tracking-tight">Ghi Chú & Phản Hồi</h3>
           <p className="text-red-100 text-xs mt-1 font-medium">Gửi trực tiếp cho Giảng viên trên lịch này</p>
        </div>
        <div className="p-6">
           <textarea
             autoFocus
             value={note}
             onChange={e => setNote(e.target.value)}
             className="w-full min-h-[120px] p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:border-red-500 transition-colors"
             placeholder="Nhập nội dung ghi chú (VD: Em xin học bù vào thứ 7, Xin đến trễ 10p, ...)"
           />
           <div className="flex gap-3 mt-6">
             <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 transition-colors">Hủy</button>
             <button type="button" onClick={() => onSubmit(note)} disabled={!note.trim()} className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors shadow-lg shadow-red-600/30">
               {hasExistingNote ? 'Cập nhật' : 'Gửi Ghi Chú'}
             </button>
           </div>
           {hasExistingNote ? (
             <button
               type="button"
               onClick={() => onSubmit('')}
               className="w-full mt-3 py-2.5 text-sm font-bold rounded-xl bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 transition-colors"
             >
               Xóa ghi chú
             </button>
           ) : null}
        </div>
      </div>
    </div>
  );
}
