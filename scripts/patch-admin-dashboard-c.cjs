const fs = require('fs');
const SRC = 'client/src/components/AdminDashboard.jsx';
let s = fs.readFileSync(SRC, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function lineStart(idx) {
  if (idx <= 0) return 0;
  const p = s.lastIndexOf('\n', idx - 1);
  return p < 0 ? 0 : p + 1;
}

function replaceRange(startIdx, endIdx, replacement) {
  s = s.slice(0, startIdx) + replacement + s.slice(endIdx);
}

// Dashboard tab -> lazy overview
{
  const a = s.indexOf("/* ===== TAB: TỔNG QUAN (DASHBOARD) ===== */");
  const b = s.indexOf("{activeTab === 'students' && <AdminLazyStudentsTab />}");
  if (a < 0 || b < 0) throw new Error('dashboard markers');
  const overview = [
    "          {activeTab === 'dashboard' && (",
    "            <AdminLazyOverviewTab",
    "              statTotalStudents={statTotalStudents}",
    "              statPaidStudents={statPaidStudents}",
    "              statTotalTeachers={statTotalTeachers}",
    "              statActiveTeachers={statActiveTeachers}",
    "              statTotalRevenue={statTotalRevenue}",
    "              statPendingTeachers={statPendingTeachers}",
    "              filteredStudents={filteredStudents}",
    "              safeTeachers={safeTeachers}",
    "            />",
    "          )}",
    "",
    "",
  ].join(nl);
  replaceRange(lineStart(a), lineStart(b), overview);
}

// External tabs settings/staff/analytics/hr
{
  const a = s.indexOf("/* ===== TAB: CÀI ĐẶT HỆ THỐNG ===== */");
  const b = s.indexOf("        </div>" + nl + "        </AdminTabProvider>");
  if (a < 0 || b < 0) throw new Error('external tab markers');
  const ext = [
    "          {['settings', 'staff', 'analytics', 'hr'].includes(activeTab) && (",
    "            <AdminLazyExternalTab tab={activeTab} />",
    "          )}",
    "",
  ].join(nl);
  replaceRange(lineStart(a), b, ext);
}

// deleteConfirm training modal
{
  const a = s.indexOf("/* ===== MODAL XÁC NHẬN XOÁ ĐÀO TẠO ===== */");
  const b = s.indexOf("/* ===== MODAL THÊM HỌC VIÊN ===== */");
  if (a < 0 || b < 0) throw new Error('deleteConfirm markers');
  const block = [
    "      {deleteConfirm && (",
    "        <ConfirmDeleteTrainingModal",
    "          item={deleteConfirm}",
    "          onCancel={() => setDeleteConfirm(null)}",
    "          onConfirm={() => { removeTrainingItem(deleteConfirm.category, deleteConfirm.id); setDeleteConfirm(null); }}",
    "        />",
    "      )}",
    "",
    "",
  ].join(nl);
  replaceRange(lineStart(a), lineStart(b), block);
}

// grantModal
{
  const a = s.indexOf("/* ===== POPUP XÁC NHẬN XOÁ ===== */");
  const b = s.indexOf("{deleteModal && (");
  if (a < 0 || b < 0) throw new Error('grant markers');
  const block = [
    "      {grantModal && (",
    "        <GrantAccessModal",
    "          modal={grantModal}",
    "          onCancel={() => setGrantModal(null)}",
    "          onConfirm={async () => {",
    "            await grantPending(grantModal.id);",
    "            toast.success('Đã cấp lại quyền làm bài thi thành công!');",
    "            setGrantModal(null);",
    "          }}",
    "        />",
    "      )}",
    "",
    "",
  ].join(nl);
  replaceRange(lineStart(a), lineStart(b), block);
}

// deleteModal entity
{
  const a = s.indexOf("{deleteModal && (");
  const b = s.indexOf("{showStudentDetailId && (");
  if (a < 0 || b < 0) throw new Error('deleteModal markers');
  const block = [
    "      {deleteModal && (",
    "        <ConfirmDeleteEntityModal",
    "          modal={deleteModal}",
    "          onCancel={() => setDeleteModal(null)}",
    "          onConfirm={confirmDelete}",
    "        />",
    "      )}",
    "",
    "",
  ].join(nl);
  replaceRange(lineStart(a), lineStart(b), block);
}

fs.writeFileSync(SRC, s, 'utf8');
console.log('patched ok, lines=', s.split(/\r?\n/).length);
