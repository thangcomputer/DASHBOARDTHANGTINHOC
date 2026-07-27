import React, { useState } from 'react';
import { PlayCircle, FileText, BookOpen, HelpCircle, Download, Lock, Search, ChevronRight, Video, ClipboardList, Calendar, Clock, FileUp } from 'lucide-react';
import { htmlToPlainText } from '../../utils/htmlContent';

export const MaterialsView = ({ trainingData, courseName, studentQuestions, onSelectAssignment }) => {
  const [activeTab, setActiveTab] = useState('videos');
  const [searchQuery, setSearchQuery] = useState('');

  const formatVNDateTime = (input) => {
    if (!input) return '';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return String(input);
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const tabs = [
    { key: 'videos', label: 'Video học', icon: Video, color: 'text-purple-600', bgActive: 'bg-purple-100 text-purple-700' },
    { key: 'files', label: 'Tài liệu', icon: FileText, color: 'text-blue-600', bgActive: 'bg-blue-100 text-blue-700' },
    { key: 'guides', label: 'Bài tập', icon: ClipboardList, color: 'text-orange-600', bgActive: 'bg-orange-100 text-orange-700' },
    { key: 'questions', label: 'Ôn tập', icon: HelpCircle, color: 'text-green-600', bgActive: 'bg-green-100 text-green-700' },
  ];

  const currentList = trainingData?.[activeTab] || [];
  const filtered = currentList.filter((m) => {
    const q = searchQuery.toLowerCase();
    const descPlain = htmlToPlainText(m.desc || '').toLowerCase();
    return m.title?.toLowerCase().includes(q) || descPlain.includes(q);
  });

  const typeColors = {
    VIDEO: 'bg-purple-500', PDF: 'bg-red-500', XLSX: 'bg-green-500', PPTX: 'bg-orange-500', DOCX: 'bg-blue-500',
  };

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Tổng số */}
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="text-purple-600" size={24} /> Tài liệu khóa học
        </h2>
        <span className="text-sm font-medium text-slate-400">
          {filtered.length} tài liệu
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Tab bar */}
        <div className="cms-table-wrap rounded-[20px] p-2 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 flex-1 w-full relative z-10">
          <div className="flex gap-2 min-w-max w-full">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-bold transition-all border-2 ${
                    isActive ? `border-black bg-purple-50 ${tab.color} shadow-sm` : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}>
                  <Icon size={16} className={isActive ? tab.color : 'text-slate-400'} />
                  {tab.label}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-black ml-1 ${
                    isActive ? 'bg-white ' + tab.color : 'bg-slate-100 text-slate-400'
                  }`}>{
                    tab.key === 'questions'
                      ? (studentQuestions?.length || 0)
                      : (trainingData?.[tab.key]?.length || 0)
                  }</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Search */}
        <div className="md:w-72 w-full relative z-10">
           <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
             <Search size={18} />
           </div>
           <input 
             type="text" 
             value={searchQuery}
             onChange={e => setSearchQuery(e.target.value)}
             placeholder={`Tìm ${tabs.find(t => t.key === activeTab)?.label.toLowerCase()}...`}
             className="w-full h-full min-h-[60px] pl-12 pr-4 bg-white border border-slate-100 rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 font-medium text-[13px] transition-all"
            />
        </div>
      </div>
      {/* Content */}
      {/* Content */}
      {activeTab === 'videos' && (
        <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 overflow-hidden">
          <div className="divide-y divide-gray-100/50">
            {filtered.map(m => {
              const isLocked = !!m.isLocked;
              return (
              <div key={m.id} className={`px-4 md:px-6 py-5 flex flex-col md:flex-row md:items-center justify-between group transition-colors gap-4 ${isLocked ? 'bg-slate-50 opacity-70' : 'hover:bg-purple-50/30 cursor-pointer'}`} onClick={() => {
                if (isLocked) alert('Video này hiện đang bị khóa bởi Quản trị viên!');
                else window.open(m.url, '_blank');
              }}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform ${isLocked ? 'bg-slate-200 text-slate-500' : 'bg-purple-100 text-purple-600 group-hover:scale-110'}`}>
                    {isLocked ? <Lock size={20} /> : <PlayCircle size={24} />}
                  </div>
                  <div className="min-w-0">
                     <h4 className="font-extrabold text-[15px] text-slate-800 truncate flex items-center gap-2 mb-1">
                       {m.title}
                       {isLocked && <span className="bg-slate-200 text-slate-600 px-2 py-0.5 text-xs cms-min-text-xs uppercase font-bold tracking-wider rounded border border-slate-300">Khóa</span>}
                     </h4>
                     <p className="text-xs text-slate-500 line-clamp-1">{htmlToPlainText(m.desc) || ''}</p>
                     <p className="text-xs font-medium text-slate-400 mt-2 flex items-center gap-4">
                       <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatVNDateTime(m.createdAt)}</span>
                       <span className="flex items-center gap-1.5"><Clock size={12} /> {m.duration || '00:00'}</span>
                     </p>
                  </div>
                </div>
                <div className="flex-shrink-0 pt-2 md:pt-0">
                  <button className={`w-full md:w-auto px-5 py-2.5 rounded-[12px] text-xs font-bold transition flex items-center justify-center gap-2 ${isLocked ? 'bg-slate-100 text-slate-500' : 'bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white'}`}>
                    {isLocked ? <Lock size={14} /> : <PlayCircle size={15} />}
                    {isLocked ? 'Đã khóa' : 'Học ngay'}
                  </button>
                </div>
              </div>
            )})}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                   <Video size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium">Chưa có video bài giảng nào.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtered.map((m) => (
              <div key={m.id} className="px-4 md:px-6 py-4 flex items-center justify-between hover:bg-blue-50/30 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl ${typeColors[m.fileType] || 'bg-gray-400'} flex items-center justify-center text-white text-xs font-black flex-shrink-0`}>
                    {m.fileType || 'FILE'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400 line-clamp-2">
                      {htmlToPlainText(m.desc) || '—'} {m.fileSize ? `• ${m.fileSize}` : ''}
                    </p>
                  </div>
                </div>
                {m.fileUrl ? (
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition flex-shrink-0 group-hover:bg-blue-100"
                    title="Tải về"
                  >
                    <Download size={16} />
                  </a>
                ) : (
                  <span className="p-2 rounded-lg bg-gray-100 text-gray-400 flex-shrink-0 cursor-not-allowed" title="Chưa có file">
                    <Download size={16} />
                  </span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chưa có tài liệu nào.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'guides' && (
        <div className="space-y-4">
          {filtered.map(m => {
            return (
              <div key={m.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all hover:shadow-md border-slate-100`}>
                <div className="px-4 md:px-6 py-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600 text-2xl`}>
                        {m.icon || '📝'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                           <h4 className="font-bold text-base text-slate-800">{m.title}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">
                          {htmlToPlainText(m.desc) || ''}
                        </p>
                        
                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                          <span className="text-xs font-bold text-slate-400 flex items-center gap-1">📅 Ngày tạo: {formatVNDateTime(m.createdAt)}</span>
                          {m.isDynamicAssignment && m.rawAssignment?.deadline && (
                            <span className="text-xs font-bold text-orange-500 flex items-center gap-1">⏰ Hạn nộp: {new Date(m.rawAssignment.deadline).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'})}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 mt-2 md:mt-0">
                      {m.url && m.url.trim() ? (
                        <a href={m.url.startsWith('http') ? m.url : `https://${m.url}`} target="_blank" rel="noreferrer" className="flex-1 justify-center text-xs font-bold text-slate-600 bg-slate-100 px-4 py-2 rounded-xl hover:bg-slate-200 transition flex items-center gap-2">
                          <Download size={14} /> Tải đề bài
                        </a>
                      ) : (
                        <button type="button" onClick={() => alert("Giảng viên chưa đính kèm file đề bài cho bài tập này.")} className="flex-1 justify-center text-xs font-bold text-gray-400 bg-gray-50 px-4 py-2 rounded-xl hover:bg-gray-100 transition flex items-center gap-2">
                          <Download size={14} /> Tải đề bài
                        </button>
                      )}
                      
                      {m.isDynamicAssignment ? (
                        <button 
                          onClick={() => onSelectAssignment && onSelectAssignment(m.rawAssignment)}
                          className={`flex-1 justify-center text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm ${m.rawAssignment.mySubmission ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                          <FileUp size={14} /> {m.rawAssignment.mySubmission ? 'Nộp lại bài' : 'Nộp bài'}
                        </button>
                      ) : (
                        <button className={`flex-1 justify-center text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-sm bg-blue-50 text-blue-600 hover:bg-blue-100`}>
                          <FileUp size={14} /> Nộp bài
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Chưa có bài tập nào.</p>
            </div>
          )}
        </div>
      )}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {(studentQuestions || []).filter(q => !searchQuery || q.q.toLowerCase().includes(searchQuery.toLowerCase())).map((q, idx) => (
            <div key={q.id || idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 group hover:border-green-300 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-xs font-black text-green-600 flex-shrink-0">{idx + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs cms-min-text-xs font-black px-2 py-0.5 rounded bg-green-100 text-green-700 uppercase">{q.section || 'Tổng hợp'}</span>
                    <span className="text-xs cms-min-text-xs font-black px-2 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{q.type === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 leading-relaxed mb-3">{q.q}</h4>
                  
                  {q.type === 'multiple' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(q.options || []).map((opt, i) => (
                        <div key={i} className={`px-4 py-2.5 rounded-xl border text-xs flex items-center gap-3 ${q.correct === i ? 'border-green-200 bg-green-50/50 font-bold text-green-700' : 'border-slate-50 text-slate-500'}`}>
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-black ${q.correct === i ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{['A', 'B', 'C', 'D'][i]}</span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {q.sampleAnswer && (
                        <div className="bg-slate-50 p-4 rounded-xl">
                          <p className="text-xs font-black text-slate-400 uppercase mb-1">Gợi ý trả lời:</p>
                          <p className="text-xs text-slate-600 italic leading-relaxed">{q.sampleAnswer}</p>
                        </div>
                      )}
                      {q.attachedFile && (
                        <button className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-green-100 transition">
                          <Download size={14} /> Tải file đính kèm: {q.attachedFile}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!studentQuestions || studentQuestions.length === 0) && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-slate-200">
              <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ngân hàng câu hỏi đang được cập nhật...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Evaluation Section ─────────────────────────────────────────────────────


export default MaterialsView;
