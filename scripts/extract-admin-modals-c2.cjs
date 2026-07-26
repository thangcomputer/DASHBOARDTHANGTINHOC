/**
 * Extract remaining AdminDashboard modals into admin/shared/*.
 * Run: node scripts/extract-admin-modals-c2.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../client/src/components/AdminDashboard.jsx');
const OUT = path.join(__dirname, '../client/src/components/admin/shared');
fs.mkdirSync(OUT, { recursive: true });

let dash = fs.readFileSync(SRC, 'utf8');
const nl = dash.includes('\r\n') ? '\r\n' : '\n';
const lines = dash.split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

function write(name, content) {
  fs.writeFileSync(path.join(OUT, name), content.replace(/\r\n/g, '\n'), 'utf8');
  console.log('wrote', name);
}

function lineStart(idx) {
  if (idx <= 0) return 0;
  const p = dash.lastIndexOf('\n', idx - 1);
  return p < 0 ? 0 : p + 1;
}

function replaceRange(startIdx, endIdx, replacement) {
  dash = dash.slice(0, startIdx) + replacement + dash.slice(endIdx);
}

// 1) AddStudentModal
{
  let body = slice(62, 528)
    .replace(
      'const AddStudentModal = ({ onAdd, onClose, teachers }) => {',
      'export default function AddStudentModal({ onAdd, onClose, teachers }) {',
    )
    .replace(/\};\s*$/, '}');
  write(
    'AddStudentModal.jsx',
    `import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, CreditCard, AlertCircle, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';
import { useSocket } from '../../../context/SocketContext';

${body}
`,
  );
}

// 2) EditStudentModal
{
  let body = slice(530, 776)
    .replace(
      'const EditStudentModal = ({ student, onSave, onClose, teachers, onResetPassword }) => {',
      'export default function EditStudentModal({ student, onSave, onClose, teachers, onResetPassword }) {',
    )
    .replace(/\};\s*$/, '}');
  write(
    'EditStudentModal.jsx',
    `import React, { useState, useEffect } from 'react';
import { X, Save, KeyRound, MapPin, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import { useBranch } from '../../../context/BranchContext';

${body}
`,
  );
}

// 3) TeacherPayoutModal — inner return JSX (lines 1695-1934)
{
  const body = slice(1695, 1934);
  let file = `import React from 'react';
import { DollarSign, X, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { generateVietQRUrl } from '../../BankSelect';

export default function TeacherPayoutModal({ payoutModal, setPayoutModal, onGoToQR, onConfirm }) {
  if (!payoutModal) return null;
  const pm = payoutModal;
  const sessCount = Number(pm.sessionsCount) || 0;
  const salaryPS = pm.baseSalaryPerSession || 0;
  const autoAmt = sessCount * salaryPS;
  const qrUrl = generateVietQRUrl(
    pm.bankInfo?.bankCode || '',
    pm.bankInfo?.accountNumber || '',
    Number(pm.amount) || autoAmt,
    pm.note || \`Luong GV \${pm.teacherName}\`,
    pm.bankInfo?.accountHolder || pm.bankInfo?.accountName || pm.teacherName || '',
  );

  return (
${body}
  );
}
`;
  file = file.replace(/onClick=\{handleGoToQR\}/g, 'onClick={onGoToQR}');
  file = file.replace(/onClick=\{handlePayout\}/g, 'onClick={onConfirm}');
  write('TeacherPayoutModal.jsx', file);
}

// 4) AddTeacherModal — inner content lines 1954-2060
{
  let body = slice(1954, 2060);
  body = body
    .replace(/onClick=\{\(\) => setShowTeacherModal\(false\)\}/g, 'onClick={onClose}')
    .replace(
      /onClick=\{async \(\) => \{[\s\S]*?toast\.error\('Lỗi thêm giảng viên: ' \+ \(err\.message \|\| 'Không xác định'\)\);\s*\}\s*\}\} className="flex-1 py-3 bg-gradient-to-r from-blue-600/,
      'onClick={onSubmit} className="flex-1 py-3 bg-gradient-to-r from-blue-600',
    );
  write(
    'AddTeacherModal.jsx',
    `import React from 'react';
import { GraduationCap, X, MapPin } from 'lucide-react';

export default function AddTeacherModal({
  teacherForm, setTeacherForm, onClose, onSubmit, isSuperAdmin, safeBranches,
}) {
  return (
${body}
  );
}
`,
  );
}

// 5) EditTeacherModal — lines 2065-2283
{
  let body = slice(2065, 2283);
  body = body
    .replace(/onClick=\{\(\) => setEditTeacher\(null\)\}/g, 'onClick={onClose}')
    .replace(
      /handleOpenResetPw\(editTeacher\.id \|\| editTeacher\._id, editTeacher\.name, 'teacher'\)/g,
      "onResetPassword(editTeacher.id || editTeacher._id, editTeacher.name)",
    )
    .replace(
      /onClick=\{async \(\) => \{\s*try \{\s*await ctxUpdateTeacher\(editTeacher\.id, \{[\s\S]*?toast\.error\('Lỗi cập nhật giảng viên: ' \+ \(err\.message \|\| 'Không xác định'\)\);\s*\}\s*\}\} className="flex-\[2\] py-3\.5 bg-gradient-to-r from-blue-600/,
      'onClick={onSave} className="flex-[2] py-3.5 bg-gradient-to-r from-blue-600',
    );
  write(
    'EditTeacherModal.jsx',
    `import React from 'react';
import { Edit3, X, Save, KeyRound, CreditCard, MapPin } from 'lucide-react';
import { BankSelect } from '../../BankSelect';
import TeacherScheduleHistoryPanel from '../../TeacherScheduleHistoryPanel';

export default function EditTeacherModal({
  editTeacher, setEditTeacher, onClose, onSave, onResetPassword, isSuperAdmin, safeBranches,
}) {
  if (!editTeacher) return null;
  return (
${body}
  );
}
`,
  );
}

// 6) ResetPasswordOtpModal — self-contained
write(
  'ResetPasswordOtpModal.jsx',
  `import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Clock, RefreshCw, X } from 'lucide-react';
import { useToast } from '../../../utils/toast.jsx';
import api from '../../../services/api';

export default function ResetPasswordOtpModal({ modal, onClose }) {
  const toast = useToast();
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpTimerRef = useRef(null);

  const startCountdown = () => {
    setOtpCountdown(120);
    clearInterval(otpTimerRef.current);
    otpTimerRef.current = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(otpTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const generateOtp = async () => {
    if (!modal) return;
    setResetPwLoading(true);
    try {
      const res = await api.auth.adminGenerateOTP(modal.id, modal.role);
      if (res.success) {
        setOtpResult(res.data);
        startCountdown();
        toast.success('Đã sinh OTP thành công!');
      } else {
        toast.error(res.message || 'Lỗi sinh OTP');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    } finally {
      setResetPwLoading(false);
    }
  };

  useEffect(() => {
    generateOtp();
    return () => clearInterval(otpTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.id, modal?.role]);

  if (!modal) return null;

  const close = () => {
    clearInterval(otpTimerRef.current);
    onClose();
  };

  const otpMessage = otpResult
    ? \`[THẮNG TIN HỌC] Mã OTP đặt lại mật khẩu: \${otpResult.otp}\\n⏱ Hiệu lực 2 phút.\\nVào: dashboard.giasutinhoc24h.com → Quên mật khẩu → Nhập OTP.\`
    : '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4" onClick={close}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><KeyRound size={20} /></div>
            <div>
              <p className="font-black text-base">Cấp lại mật khẩu</p>
              <p className="text-white/80 text-xs">{modal.role === 'teacher' ? 'Giảng viên' : 'Học viên'}: <strong>{modal.name}</strong></p>
            </div>
          </div>
          <button type="button" onClick={close} className="hover:bg-white/20 rounded-lg p-1 transition"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {!otpResult ? (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-bold">Đang sinh mã OTP...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={\`flex items-center justify-center gap-2 py-2 px-4 rounded-full font-black text-lg mx-auto w-fit \${
                otpCountdown > 30 ? 'bg-emerald-50 text-emerald-600'
                  : otpCountdown > 0 ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-500'
              }\`}>
                <Clock size={18} />
                {otpCountdown > 0
                  ? \`\${Math.floor(otpCountdown / 60)}:\${String(otpCountdown % 60).padStart(2, '0')}\`
                  : 'Hết hạn'}
              </div>
              <div className="bg-gray-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Mã OTP</p>
                <p className="text-5xl font-black text-amber-600 tracking-[0.3em] font-mono">{otpResult.otp}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                <p className="font-bold text-blue-700 text-xs mb-1">Nội dung gửi cho {otpResult.name}:</p>
                <p className="font-mono text-xs bg-white rounded-lg p-2 border border-blue-200 whitespace-pre-wrap">{otpMessage}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(otpMessage);
                    toast.success('Đã copy nội dung tin nhắn!');
                  }}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
                >
                  Copy tin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const phone = (otpResult.zalo || otpResult.phone || '').replace(/[^0-9]/g, '');
                    window.open(\`https://zalo.me/\${phone}\`, '_blank');
                    navigator.clipboard.writeText(otpMessage);
                    toast.success('Mở Zalo! Nội dung đã được copy sẵn.');
                  }}
                  className="flex-[2] py-3 bg-[#0068ff] hover:bg-[#0055d4] text-white font-bold rounded-xl transition shadow-lg"
                >
                  Gửi Zalo
                </button>
              </div>
              {otpCountdown === 0 && (
                <button
                  type="button"
                  disabled={resetPwLoading}
                  onClick={generateOtp}
                  className="w-full py-2.5 border-2 border-amber-400 text-amber-600 font-bold rounded-xl hover:bg-amber-50 transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={15} /> Sinh lại OTP mới
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`,
);

// ── Patch AdminDashboard ──

// Remove inline AddStudentModal + EditStudentModal definitions
{
  const a = dash.indexOf('// ─── MODAL THÊM HỌC VIÊN');
  const b = dash.indexOf('// ─── MAIN COMPONENT');
  if (a < 0 || b < 0) throw new Error('modal defs markers');
  replaceRange(lineStart(a), lineStart(b), '');
}

// Imports
{
  const oldImp = [
    "import ConfirmDeleteTrainingModal from './admin/shared/ConfirmDeleteTrainingModal';",
    "import ConfirmDeleteEntityModal from './admin/shared/ConfirmDeleteEntityModal';",
    "import GrantAccessModal from './admin/shared/GrantAccessModal';",
  ].join(nl);
  const newImp = [
    "import ConfirmDeleteTrainingModal from './admin/shared/ConfirmDeleteTrainingModal';",
    "import ConfirmDeleteEntityModal from './admin/shared/ConfirmDeleteEntityModal';",
    "import GrantAccessModal from './admin/shared/GrantAccessModal';",
    "import AddStudentModal from './admin/shared/AddStudentModal';",
    "import EditStudentModal from './admin/shared/EditStudentModal';",
    "import TeacherPayoutModal from './admin/shared/TeacherPayoutModal';",
    "import AddTeacherModal from './admin/shared/AddTeacherModal';",
    "import EditTeacherModal from './admin/shared/EditTeacherModal';",
    "import ResetPasswordOtpModal from './admin/shared/ResetPasswordOtpModal';",
  ].join(nl);
  if (!dash.includes(oldImp)) throw new Error('import block missing');
  dash = dash.replace(oldImp, newImp);
}

dash = dash.replace("import { BankSelect, generateVietQRUrl } from './BankSelect';" + nl, '');
dash = dash.replace("import TeacherScheduleHistoryPanel from './TeacherScheduleHistoryPanel';" + nl, '');

// Simplify reset pw open handler
{
  const start = dash.indexOf('  const [resetPwModal, setResetPwModal] = useState(null);');
  const marker = "window.addEventListener('open-reset-pw'";
  const m = dash.indexOf(marker);
  if (start < 0 || m < 0) throw new Error('reset state markers');
  const ue = dash.lastIndexOf('  useEffect(() => {', m);
  replaceRange(
    start,
    ue,
    [
      "  const [resetPwModal, setResetPwModal] = useState(null); // { id, name, role }",
      "",
      "  const handleOpenResetPw = (id, name, role) => {",
      "    setResetPwModal({ id, name, role });",
      "  };",
      "",
      "",
    ].join(nl),
  );
}

// Payout modal
{
  const a = dash.indexOf('/* ===== MODAL THANH TOÁN LƯƠNG');
  const b = dash.indexOf('/* ===== INVOICE ẨN ĐỂ XUẤT PDF');
  if (a < 0 || b < 0) throw new Error('payout markers');
  replaceRange(
    lineStart(a),
    lineStart(b),
    [
      "      {payoutModal && (",
      "        <TeacherPayoutModal",
      "          payoutModal={payoutModal}",
      "          setPayoutModal={setPayoutModal}",
      "          onGoToQR={handleGoToQR}",
      "          onConfirm={handlePayout}",
      "        />",
      "      )}",
      "",
      "",
    ].join(nl),
  );
}

// Add teacher
{
  const a = dash.indexOf('/* ===== MODAL THÊM GIẢNG VIÊN ===== */');
  const b = dash.indexOf('/* ===== MODAL CHỈNH SỬA GIẢNG VIÊN ===== */');
  if (a < 0 || b < 0) throw new Error('add teacher markers');
  replaceRange(
    lineStart(a),
    lineStart(b),
    [
      "      {showTeacherModal && (",
      "        <AddTeacherModal",
      "          teacherForm={teacherForm}",
      "          setTeacherForm={setTeacherForm}",
      "          isSuperAdmin={isSuperAdmin}",
      "          safeBranches={safeBranches}",
      "          onClose={() => setShowTeacherModal(false)}",
      "          onSubmit={async () => {",
      "            try {",
      "              await addTeacher({",
      "                name: teacherForm.name,",
      "                phone: teacherForm.phone,",
      "                specialty: teacherForm.specialty,",
      "                startDate: teacherForm.startDate,",
      "                address: teacherForm.address,",
      "                status: 'inactive',",
      "                branchId: teacherForm.branchId || undefined,",
      "                branchCode: teacherForm.branchCode || undefined,",
      "              });",
      "              setTeacherForm({ name: '', phone: '', specialty: '', startDate: new Date().toISOString().split('T')[0], address: '', branchId: '', branchCode: '' });",
      "              setShowTeacherModal(false);",
      "              toast.success('Đã thêm giảng viên thành công!');",
      "              fetchTeachers();",
      "            } catch (err) {",
      "              toast.error('Lỗi thêm giảng viên: ' + (err.message || 'Không xác định'));",
      "            }",
      "          }}",
      "        />",
      "      )}",
      "",
      "",
    ].join(nl),
  );
}

// Edit teacher
{
  const a = dash.indexOf('/* ===== MODAL CHỈNH SỬA GIẢNG VIÊN ===== */');
  const b = dash.indexOf('{editStudent && (');
  if (a < 0 || b < 0) throw new Error('edit teacher markers');
  replaceRange(
    lineStart(a),
    lineStart(b),
    [
      "      {editTeacher && (",
      "        <EditTeacherModal",
      "          editTeacher={editTeacher}",
      "          setEditTeacher={setEditTeacher}",
      "          isSuperAdmin={isSuperAdmin}",
      "          safeBranches={safeBranches}",
      "          onClose={() => setEditTeacher(null)}",
      "          onResetPassword={(id, name) => handleOpenResetPw(id, name, 'teacher')}",
      "          onSave={async () => {",
      "            try {",
      "              await ctxUpdateTeacher(editTeacher.id, {",
      "                name: editTeacher.name,",
      "                phone: editTeacher.phone,",
      "                specialty: editTeacher.specialty,",
      "                startDate: editTeacher.startDate,",
      "                address: editTeacher.address,",
      "                status: editTeacher.status,",
      "                baseSalaryPerSession: editTeacher.baseSalaryPerSession,",
      "                bankAccount: editTeacher.bankAccount || {},",
      "                branchId: editTeacher.branchId,",
      "                branchCode: editTeacher.branchCode,",
      "              });",
      "              setEditTeacher(null);",
      "              toast.success('Đã cập nhật thông tin giảng viên!');",
      "              fetchTeachers();",
      "            } catch (err) {",
      "              toast.error('Lỗi cập nhật giảng viên: ' + (err.message || 'Không xác định'));",
      "            }",
      "          }}",
      "        />",
      "      )}",
      "",
      "",
    ].join(nl),
  );
}

// Reset password modal
{
  const a = dash.indexOf('/* ===== MODAL CẤP LẠI MẬT KHẨU (OTP) ===== */');
  const inline = dash.indexOf('{resetPwModal && (');
  const rs = a >= 0 ? lineStart(a) : (inline >= 0 ? lineStart(inline) : -1);
  // Component closes with: spaces + </div> then return close
  const endMatch = dash.slice(rs).search(/\r?\n    <\/div>\r?\n  \);\r?\n\};/);
  if (rs < 0 || endMatch < 0) throw new Error('reset modal markers rs=' + rs + ' end=' + endMatch);
  const end = rs + endMatch;
  replaceRange(
    rs,
    end,
    [
      "      {resetPwModal && (",
      "        <ResetPasswordOtpModal",
      "          modal={resetPwModal}",
      "          onClose={() => setResetPwModal(null)}",
      "        />",
      "      )}",
      "",
    ].join(nl),
  );
}

fs.writeFileSync(SRC, dash, 'utf8');
console.log('AdminDashboard lines=', dash.split(/\r?\n/).length);
