import React, { useState } from 'react';
import {
  Bot,
  ChevronDown,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Clock,
  Sparkles,
  Users,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  BookOpen,
  Award,
} from 'lucide-react';
import { TEACHER_WELCOME_CHIPS, STUDENT_WELCOME_CHIPS } from '../utils/aiSupport';
import { isFreePortalSelfRegistrationStudent } from '../utils/enrollments';

const TEACHER_FAQS = [
  {
    q: 'Làm sao để tạo hoặc đổi lịch dạy cho học viên?',
    a: 'Vào mục "Lịch dạy & điểm danh" trên thanh menu bên trái. Chọn một ca dạy trên lưới tuần để chỉnh sửa, hoặc nhấn nút "+ Thêm ca dạy" để xếp lịch mới. Chọn học viên, môn học và khung giờ, sau đó nhấn "Lưu lịch dạy".',
    icon: Calendar,
  },
  {
    q: 'Quy trình điểm danh bù và xác nhận ca dạy thế nào?',
    a: 'Nếu ca dạy chưa kịp điểm danh trong giờ hoặc học viên học bù, bấm vào ca học > chọn "Yêu cầu điểm danh bù" và ghi rõ lý do. Quản trị viên (Admin) sẽ kiểm tra và duyệt trong vòng 24 giờ làm việc.',
    icon: ShieldCheck,
  },
  {
    q: 'Cách xem bảng kê lương và đối soát tài chính?',
    a: 'Truy cập mục "Tài chính" trên thanh điều hướng. Tại đây bạn có thể theo dõi chi tiết số buổi đã dạy, thù lao theo từng buổi, trạng thái thanh toán và lịch sử chi trả theo từng tháng.',
    icon: Award,
  },
  {
    q: 'Cần làm gì khi học viên không vào được link học trực tuyến?',
    a: 'Kiểm tra link phòng Google Meet trong chi tiết ca dạy. Bạn có thể sao chép link phòng học gửi trực tiếp cho học viên qua mục "Hộp thư" hoặc liên hệ ngay với Chuyên viên hỗ trợ kỹ thuật.',
    icon: BookOpen,
  },
];

const STUDENT_FAQS = [
  {
    q: 'Làm thế nào khi link phòng học trực tuyến (Google Meet) bị lỗi?',
    a: 'Trước tiên hãy kiểm tra lại kết nối mạng và tài khoản Google cá nhân. Nếu vẫn không vào được phòng, hãy nhắn tin ngay cho Giảng viên phụ trách qua Hộp thư hoặc nhấn "Chat với nhân viên hỗ trợ" ở trên.',
    icon: Calendar,
  },
  {
    q: 'Cách nộp bài tập và xem kết quả chấm thi?',
    a: 'Vào mục "Khóa đào tạo" > "Bài tập & kiểm tra" > Chọn bài tập của buổi học tương ứng > Tải lên file bài làm (Word/Excel) và nhấn "Nộp bài". Kết quả chấm điểm và nhận xét của thầy cô sẽ hiển thị tại đây.',
    icon: BookOpen,
  },
  {
    q: 'Quy định xin nghỉ học và xếp lịch học bù?',
    a: 'Học viên cần thông báo xin nghỉ trước giờ học ít nhất 2 tiếng thông qua tin nhắn cho giảng viên hoặc nhân viên hỗ trợ. Giảng viên sẽ chủ động xếp lịch bù phù hợp trong tuần.',
    icon: ShieldCheck,
  },
  {
    q: 'Tôi muốn đổi mật khẩu hoặc đặt mã PIN bảo mật ở đâu?',
    a: 'Truy cập mục "Hồ sơ" (hoặc biểu tượng tài khoản góc trái dưới). Tại đây bạn có thể chọn "Thay đổi mật khẩu" hoặc "Khóa mã PIN" để bảo vệ thông tin học tập của mình.',
    icon: Award,
  },
];

export default function SupportEntryPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const isTeacher = (() => {
    try {
      if (typeof window !== 'undefined' && (
        window.location.pathname.startsWith('/teacher')
        || localStorage.getItem('teacher_token')
        || localStorage.getItem('teacher_user')
      )) return true;
    } catch {
      /* ignore */
    }
    return false;
  })();

  const isFreeStudent = (() => {
    try {
      if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student')) {
        return true;
      }
      const u = JSON.parse(localStorage.getItem('student_user') || 'null');
      return Boolean(u?.freePortal === true || isFreePortalSelfRegistrationStudent(u));
    } catch {
      return false;
    }
  })();

  const isGreenTheme = isTeacher || isFreeStudent;

  const chooseSupport = (mode, prompt = '') => {
    window.dispatchEvent(new CustomEvent('cms:open-support-choice', { detail: { mode, prompt } }));
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const welcomeChips = isTeacher ? TEACHER_WELCOME_CHIPS : STUDENT_WELCOME_CHIPS;
  const faqs = isTeacher ? TEACHER_FAQS : STUDENT_FAQS;

  return (
    <div className="mx-auto w-full max-w-5xl pt-4 pb-12 px-3 sm:px-6 space-y-6">
      {/* ─── Hero Header ─── */}
      <section className={`rounded-3xl border p-6 sm:p-8 relative overflow-hidden transition-all shadow-sm ${
        isGreenTheme
          ? 'bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white border-emerald-200/80'
          : 'bg-gradient-to-br from-red-50/90 via-rose-50/40 to-white border-red-200/80'
      }`}>
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center shadow-md ${
            isGreenTheme
              ? 'bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669] text-white'
              : 'bg-[#DC2626] border border-[#F87171] border-b-4 border-b-[#B91C1C] text-white'
          }`}>
            <Headphones size={32} strokeWidth={2.3} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-2 bg-white/90 border border-slate-200/80 text-slate-700 shadow-xs">
              <span className={`w-2 h-2 rounded-full animate-ping ${isGreenTheme ? 'bg-emerald-500' : 'bg-red-500'}`} />
              Trung tâm Chăm sóc & Hỗ trợ Tin học
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Trung tâm Hỗ trợ Thắng Tin Học
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl leading-relaxed">
              Bạn cần giúp đỡ về bài học, bài tập, lịch dạy hay gặp khó khăn kỹ thuật? Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7 qua trợ lý AI thông minh hoặc đội ngũ chuyên viên trực tiếp.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 2 Main Support Channels ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Trợ lý AI */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                  <Bot size={26} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Trợ lý AI Thắng Tin Học
                  </h2>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Trực tuyến 24/7 • Phản hồi ngay
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Giải đáp nhanh mọi kiến thức về Word, Excel, PowerPoint, chứng chỉ MOS, IC3, cách giải bài tập và hướng dẫn thao tác trên hệ thống.
            </p>

            {/* Quick Prompt Chips */}
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                Gợi ý câu hỏi nhanh:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {welcomeChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => chooseSupport('ai', chip.label)}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition cursor-pointer"
                  >
                    <span>{chip.label}</span>
                    <ArrowRight size={11} className="opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => chooseSupport('ai')}
            className={`w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition-all cursor-pointer shadow-xs active:translate-y-[2px] active:border-b-2 ${
              isGreenTheme
                ? 'bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669] hover:brightness-105'
                : 'bg-[#DC2626] border border-[#F87171] border-b-4 border-b-[#B91C1C] hover:brightness-105'
            }`}
          >
            <Bot size={18} strokeWidth={2.4} />
            <span>Hỏi Trợ lý AI ngay</span>
          </button>
        </div>

        {/* Card 2: Chuyên viên Hỗ trợ Trực tiếp */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                  <Users size={26} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Chuyên viên Hỗ trợ Trực tiếp
                  </h2>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Đội ngũ nhân sự • Giờ làm việc & ca tối
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Trò chuyện trực tiếp 1-1 với nhân viên trung tâm để xử lý các vấn đề tài khoản, học phí, lịch học, lỗi phòng học trực tuyến hoặc khiếu nại đào tạo.
            </p>

            <ul className="space-y-2 mb-5 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                <span>Hỗ trợ bảo lưu, chuyển lịch và mở khóa tài khoản</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                <span>Giải đáp thắc mắc về học phí và hóa đơn thanh toán</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                <span>Thời gian phản hồi thông thường: dưới 5 phút</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => chooseSupport('staff')}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold bg-white border border-slate-300 border-b-4 border-b-slate-400 text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-xs active:translate-y-[2px] active:border-b-2"
          >
            <MessageCircle size={18} strokeWidth={2.4} />
            <span>Trò chuyện với chuyên viên</span>
          </button>
        </div>
      </section>

      {/* ─── Hotline & Quick Contacts ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Phone size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Hotline / Zalo hỗ trợ</p>
            <a href="tel:0932783869" className="text-sm font-extrabold text-slate-800 hover:text-red-600 transition">
              0932 783 869
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Mail size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Email liên hệ</p>
            <a href="mailto:support@thangtinhoc.edu.vn" className="text-sm font-extrabold text-slate-800 hover:text-red-600 transition truncate block">
              support@thangtinhoc.edu.vn
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3.5 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">Thời gian làm việc</p>
            <p className="text-sm font-extrabold text-slate-800">
              08:00 – 21:30 hàng ngày
            </p>
          </div>
        </div>
      </section>

      {/* ─── Frequently Asked Questions (FAQ) ─── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
          <HelpCircle size={22} className={isTeacher ? 'text-emerald-600' : 'text-red-600'} />
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
            Câu hỏi thường gặp (FAQ)
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            const Icon = faq.icon;
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-slate-200 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </span>
                    <span className="text-sm sm:text-base font-bold text-slate-800">
                      {faq.q}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-slate-700' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
