import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  GraduationCap,
  Phone,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { LEGAL_DOCUMENTS, LEGAL_META, getLegalDocument } from '../../../shared/legal/termsAndPrivacy.mjs';

export default function LegalDocumentPage({ initialTab = 'terms' }) {
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = String(location.pathname || '').toLowerCase();
  const activeTab = pathname.includes('bao-mat') || pathname.includes('privacy')
    ? 'privacy'
    : pathname.includes('dieu-khoan') || pathname.includes('terms')
      ? 'terms'
      : initialTab === 'privacy'
        ? 'privacy'
        : 'terms';

  const doc = getLegalDocument(activeTab);

  useEffect(() => {
    document.title = `${doc.title} | ${LEGAL_META.brandName} · Thắng Tin Học`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [doc.title, activeTab]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Header cố định nhẹ, sạch sẽ */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800"
            >
              <ArrowLeft size={15} />
              <span>Quay lại</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#15803D] text-white">
                <GraduationCap size={16} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-[#0F172A]">{LEGAL_META.brandName}</p>
                <p className="text-[11px] font-medium text-slate-500">{LEGAL_META.operatorName}</p>
              </div>
            </div>
          </div>

          {/* Chuyển tab Điều khoản / Bảo mật */}
          <nav
            aria-label="Tài liệu pháp lý"
            className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1"
          >
            <Link
              to="/dieu-khoan"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'terms'
                  ? 'bg-white text-[#15803D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale size={14} />
              <span>Điều khoản sử dụng</span>
            </Link>
            <Link
              to="/bao-mat"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'privacy'
                  ? 'bg-white text-[#15803D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Chính sách bảo mật</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sidebar Mục lục */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mục lục tài liệu
                </p>
                <ul className="mt-3 space-y-1.5">
                  {doc.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="block rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-[#F0FDF4] hover:text-[#15803D]"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Thẻ liên hệ hỗ trợ nhanh */}
              <div className="rounded-2xl border border-emerald-200/80 bg-[#F0FDF4] p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#15803D]">
                  <Phone size={15} />
                  <span>Kênh tiếp nhận & Hỗ trợ</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Cần giải đáp về điều khoản học viên, quyền riêng tư hoặc yêu cầu xóa tài khoản? Liên hệ trực tiếp:
                </p>
                <div className="mt-3 space-y-1.5 text-xs font-semibold text-[#0F172A]">
                  <div>Kỹ thuật LMS / Mobile: {LEGAL_META.supportHotline}</div>
                  <div>Tư vấn lộ trình: {LEGAL_META.consultHotline}</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Nội dung chính */}
          <article className="lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-9">
              <div className="border-b border-slate-100 pb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-[#F0FDF4] px-3 py-1 text-xs font-semibold text-[#15803D]">
                  {activeTab === 'privacy' ? <ShieldCheck size={14} /> : <FileText size={14} />}
                  <span>Hiệu lực từ {doc.updatedAt} · Phiên bản {LEGAL_META.version}</span>
                </div>

                <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl">
                  {doc.title}
                </h1>
                <p className="mt-2 text-[15px] leading-relaxed text-[#475569]">
                  {doc.subtitle}
                </p>

                {/* Tóm tắt điểm chính */}
                <div className="mt-5 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Điểm cốt lõi cần biết
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {doc.summaryBullets.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[#0F172A]">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#15803D]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Các điều khoản chi tiết */}
              <div className="mt-7 space-y-8">
                {doc.sections.map((section) => (
                  <section key={section.id} id={section.id} className="scroll-mt-24">
                    <h2 className="text-lg font-bold tracking-tight text-[#0F172A] sm:text-xl">
                      {section.title}
                    </h2>
                    <div className="mt-3 space-y-3 text-[14.5px] leading-[1.7] text-[#475569]">
                      {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                    {Array.isArray(section.bullets) && section.bullets.length > 0 ? (
                      <ul className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        {section.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="flex items-start gap-2.5 text-[14px] leading-[1.65] text-slate-700"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#15803D]" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>

              {/* Lối tắt cuối trang */}
              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
                <div className="text-xs text-slate-500">
                  © 2026 {LEGAL_META.brandName} · {LEGAL_META.operatorName}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                  <Link
                    to={activeTab === 'terms' ? '/bao-mat' : '/dieu-khoan'}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition-colors hover:border-emerald-300 hover:text-[#15803D]"
                  >
                    Xem {activeTab === 'terms' ? LEGAL_DOCUMENTS.privacy.title : LEGAL_DOCUMENTS.terms.title}
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-lg bg-[#15803D] px-3.5 py-1.5 text-white transition-colors hover:bg-[#166534]"
                  >
                    Đăng nhập học tập
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
