import React, { useEffect, useState } from 'react';
import {
  Sparkles, Loader2, RefreshCw, Copy, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { aiAPI } from '../services/api';
import { useToast } from '../utils/toast';

const TABS = [
  { id: 'quiz', label: 'Sinh câu hỏi' },
  { id: 'notification', label: 'Soạn thông báo' },
  { id: 'summarize', label: 'Tóm tắt' },
  { id: 'complete', label: 'Prompt tự do' },
];

export default function AiCenterPage() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('quiz');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // quiz
  const [topic, setTopic] = useState('Excel cơ bản');
  const [subject, setSubject] = useState('Tin học văn phòng');
  const [count, setCount] = useState(5);

  // notification
  const [purpose, setPurpose] = useState('Nhắc học viên đóng học phí tháng này');
  const [audience, setAudience] = useState('học viên');

  // summarize / complete
  const [text, setText] = useState('');
  const [prompt, setPrompt] = useState('');

  const loadStatus = async () => {
    try {
      const res = await aiAPI.status();
      if (res.success) setStatus(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadStatus(); }, []);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      let res;
      if (tab === 'quiz') {
        res = await aiAPI.quiz({ topic, subject, count: Number(count) || 5 });
      } else if (tab === 'notification') {
        res = await aiAPI.notificationDraft({ purpose, audience });
      } else if (tab === 'summarize') {
        res = await aiAPI.summarize({ text });
      } else {
        res = await aiAPI.complete({ prompt });
      }
      if (res.success) {
        setResult(res.data);
        if (res.data?.source === 'fallback') {
          toast.success('Kết quả mẫu (chưa cấu hình AI_API_KEY)');
        } else {
          toast.success('AI đã trả lời');
        }
      } else {
        toast.error(res.message || 'AI thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setBusy(false);
    }
  };

  const copyResult = async () => {
    const payload = JSON.stringify(result, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Da copy');
    } catch {
      toast.error('Khong copy duoc');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Sparkles className="text-fuchsia-600" size={22} /> AI Center
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Sinh câu hỏi, soạn thông báo, tóm tắt — OpenAI-compatible API
          </p>
        </div>
        <button type="button" onClick={loadStatus} className="p-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className={`rounded-xl border px-3 py-2 text-xs font-bold flex items-center gap-2 ${
        status?.configured
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        {status?.configured ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
        {status?.configured
          ? `Đã cấu hình · model ${status.model}`
          : 'Chưa cấu hình AI_API_KEY — vẫn chạy chế độ mẫu (fallback)'}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setResult(null); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border ${
              tab === t.id ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
        {tab === 'quiz' && (
          <>
            <label className="block text-xs font-bold text-gray-500">Mon / chu de</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" />
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Chu de chi tiet" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" />
          </>
        )}
        {tab === 'notification' && (
          <>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Doi tuong" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" />
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} placeholder="Muc dich thong bao" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </>
        )}
        {tab === 'summarize' && (
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Dan van ban can tom tat..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        )}
        {tab === 'complete' && (
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder="Nhap prompt..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        )}

        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-fuchsia-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Chạy AI
        </button>
      </div>

      {result && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-gray-500 uppercase">
              Ket qua · {result.source || 'llm'}
              {result.model ? ` · ${result.model}` : ''}
            </p>
            <button type="button" onClick={copyResult} className="p-2 rounded-lg text-gray-500 hover:bg-gray-50">
              <Copy size={14} />
            </button>
          </div>

          {tab === 'quiz' && Array.isArray(result.questions) && (
            <ul className="space-y-3">
              {result.questions.map((q, i) => (
                <li key={i} className="border border-gray-100 rounded-xl p-3 text-sm">
                  <p className="font-bold text-gray-900">{i + 1}. {q.question}</p>
                  <ol className="mt-2 space-y-1 text-xs text-gray-600 list-decimal list-inside">
                    {(q.options || []).map((o, j) => (
                      <li key={j} className={j === q.correct ? 'text-emerald-700 font-bold' : ''}>{o}</li>
                    ))}
                  </ol>
                  {q.explanation && <p className="text-[11px] text-gray-400 mt-2">{q.explanation}</p>}
                </li>
              ))}
            </ul>
          )}

          {tab === 'notification' && (
            <div className="space-y-2 text-sm">
              <p className="font-black text-gray-900">{result.title}</p>
              <p className="text-gray-700 whitespace-pre-wrap">{result.content}</p>
            </div>
          )}

          {tab === 'summarize' && (
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.summary}</p>
          )}

          {tab === 'complete' && (
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.content}</p>
          )}
        </div>
      )}
    </div>
  );
}