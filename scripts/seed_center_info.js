/**
 * Seed mẫu «Thông tin trung tâm» — Thắng Tin Học (tin học văn phòng).
 * Dữ liệu ghi vào MongoDB → sửa/xóa được trên /admin/center-info/manage (không hardcode UI).
 *
 *   node scripts/seed_center_info.js
 *   node scripts/seed_center_info.js --keep   # chỉ thêm khi section trống, không xóa mục cũ
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CenterOverview = require('../models/CenterOverview');
const CenterInfoItem = require('../models/CenterInfoItem');

const KEEP = process.argv.includes('--keep');

const FIRST = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
];
const MIDDLE = ['Văn', 'Thị', 'Minh', 'Hoàng', 'Thanh', 'Quốc', 'Anh', 'Hữu', 'Ngọc', 'Tuấn'];
const LAST = [
  'An', 'Bình', 'Cường', 'Dũng', 'Đức', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hiếu',
  'Hoa', 'Hùng', 'Hương', 'Khánh', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Nga',
  'Phong', 'Phúc', 'Quân', 'Quỳnh', 'Sơn', 'Tâm', 'Thảo', 'Thắng', 'Trang', 'Trung',
  'Tú', 'Tùng', 'Uyên', 'Vân', 'Việt', 'Yến', 'Đạt', 'Kiên', 'My', 'Nhung',
];

const STAFF_ROLES = [
  { department: 'Ban Giám đốc', subtitle: 'Giám đốc', expertise: 'Quản trị đào tạo', n: 2 },
  { department: 'Phòng Đào tạo', subtitle: 'Giảng viên Word – Excel', expertise: 'Microsoft Office', n: 18 },
  { department: 'Phòng Đào tạo', subtitle: 'Giảng viên PowerPoint – Canva', expertise: 'Thiết kế bài thuyết trình', n: 8 },
  { department: 'Phòng Đào tạo', subtitle: 'Giảng viên tin học cơ bản', expertise: 'Windows, Internet, gõ mười ngón', n: 6 },
  { department: 'Tư vấn tuyển sinh', subtitle: 'Tư vấn viên', expertise: 'Tư vấn khóa học & lịch học', n: 8 },
  { department: 'Chăm sóc học viên', subtitle: 'CSKH', expertise: 'Hỗ trợ học viên sau ghi danh', n: 4 },
  { department: 'Kế toán', subtitle: 'Kế toán viên', expertise: 'Thu học phí, hóa đơn', n: 2 },
  { department: 'Hành chính', subtitle: 'Nhân viên hành chính', expertise: 'Vận hành chi nhánh', n: 2 },
];

function pickName(i) {
  const f = FIRST[i % FIRST.length];
  const m = MIDDLE[i % MIDDLE.length];
  const l = LAST[(i * 7) % LAST.length];
  return `${f} ${m} ${l}`;
}

function phoneOf(i) {
  return `09${String(30000000 + i * 17).slice(0, 8)}`;
}

function buildStaff() {
  const rows = [];
  let idx = 0;
  for (const role of STAFF_ROLES) {
    for (let k = 0; k < role.n; k += 1) {
      idx += 1;
      const name = pickName(idx);
      const branchHint = idx % 3 === 0 ? 'Đà Nẵng' : idx % 3 === 1 ? 'Lâm Đồng' : 'TP.HCM';
      rows.push({
        section: 'staff',
        status: 'published',
        isActive: true,
        sortOrder: idx,
        title: name,
        subtitle: role.subtitle,
        department: role.department,
        expertise: role.expertise,
        experience: `${3 + (idx % 12)} năm`,
        description: `Phụ trách tại chi nhánh ${branchHint}. Đồng hành cùng học viên khóa tin học văn phòng Thắng Tin Học.`,
        email: `nv${String(idx).padStart(2, '0')}@thangtinhoc.vn`,
        phone: phoneOf(idx),
        showEmail: idx <= 6,
      });
    }
  }
  // Đảm bảo đúng 50
  while (rows.length < 50) {
    idx += 1;
    rows.push({
      section: 'staff',
      status: 'published',
      isActive: true,
      sortOrder: idx,
      title: pickName(idx + 40),
      subtitle: 'Giảng viên',
      department: 'Phòng Đào tạo',
      expertise: 'Tin học văn phòng',
      experience: `${2 + (idx % 8)} năm`,
      description: 'Giảng dạy các khóa Word, Excel, PowerPoint theo lộ trình chuẩn MOS.',
      email: `nv${String(idx).padStart(2, '0')}@thangtinhoc.vn`,
      phone: phoneOf(idx),
      showEmail: false,
    });
  }
  return rows.slice(0, 50);
}

function buildBranches() {
  return [
    {
      section: 'branch',
      status: 'published',
      isActive: true,
      sortOrder: 1,
      title: 'Thắng Tin Học – TP. Hồ Chí Minh',
      subtitle: 'Trụ sở chính',
      code: 'CN-HCM',
      city: 'TP. Hồ Chí Minh',
      address: '123 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh',
      phone: '028 3838 9999',
      email: 'hcm@thangtinhoc.vn',
      managerName: 'Nguyễn Minh Thắng',
      hours: 'Thứ 2 – Chủ nhật: 8:00 – 21:00',
      scheduleInfo: 'Thứ 2 – Chủ nhật: 8:00 – 21:00',
      mapsUrl: 'https://maps.google.com/?q=Nguyen+Van+Cu+Quan+5+Ho+Chi+Minh',
      description: 'Trụ sở chính, phòng lab đầy đủ máy tính cấu hình cao, hỗ trợ thi chứng chỉ MOS / IC3.',
      detailHtml: '<p>Chi nhánh TP.HCM là trung tâm điều phối đào tạo toàn hệ thống, có phòng thi chứng chỉ và đội ngũ giảng viên chuyên Word – Excel – PowerPoint.</p>',
    },
    {
      section: 'branch',
      status: 'published',
      isActive: true,
      sortOrder: 2,
      title: 'Thắng Tin Học – Lâm Đồng',
      subtitle: 'Chi nhánh Tây Nguyên',
      code: 'CN-LD',
      city: 'Lâm Đồng',
      address: '45 Trần Phú, Phường 3, Đà Lạt, Lâm Đồng',
      phone: '0263 3822 888',
      email: 'lamdong@thangtinhoc.vn',
      managerName: 'Trần Thị Hương',
      hours: 'Thứ 2 – Thứ 7: 8:00 – 20:00; Chủ nhật: 8:00 – 17:00',
      scheduleInfo: 'Thứ 2 – Thứ 7: 8:00 – 20:00; Chủ nhật: 8:00 – 17:00',
      mapsUrl: 'https://maps.google.com/?q=Tran+Phu+Da+Lat+Lam+Dong',
      description: 'Đào tạo tin học văn phòng cho học sinh, sinh viên và người đi làm tại Đà Lạt – Lâm Đồng.',
      detailHtml: '<p>Chi nhánh Lâm Đồng tập trung khóa học văn phòng thực chiến, lớp tối và cuối tuần linh hoạt theo lịch học viên.</p>',
    },
    {
      section: 'branch',
      status: 'published',
      isActive: true,
      sortOrder: 3,
      title: 'Thắng Tin Học – Đà Nẵng',
      subtitle: 'Chi nhánh miền Trung',
      code: 'CN-DN',
      city: 'Đà Nẵng',
      address: '88 Lê Duẩn, Hải Châu, Đà Nẵng',
      phone: '0236 3655 777',
      email: 'danang@thangtinhoc.vn',
      managerName: 'Lê Quốc Dũng',
      hours: 'Thứ 2 – Chủ nhật: 8:00 – 21:00',
      scheduleInfo: 'Thứ 2 – Chủ nhật: 8:00 – 21:00',
      mapsUrl: 'https://maps.google.com/?q=Le+Duan+Hai+Chau+Da+Nang',
      description: 'Phục vụ học viên Đà Nẵng và các tỉnh lân cận; có lớp online kèm lab tại chỗ.',
      detailHtml: '<p>Chi nhánh Đà Nẵng hỗ trợ lộ trình từ tin học cơ bản đến luyện thi chứng chỉ quốc tế.</p>',
    },
  ];
}

function buildSocial() {
  return [
    {
      section: 'social', status: 'published', isActive: true, sortOrder: 1,
      title: 'Facebook', subtitle: 'Fanpage chính thức', icon: '📘',
      url: 'https://facebook.com/thangtinhoc',
      description: 'Tin khóa học, lịch khai giảng, tip Word – Excel hàng tuần.',
    },
    {
      section: 'social', status: 'published', isActive: true, sortOrder: 2,
      title: 'Zalo OA', subtitle: 'Tư vấn nhanh', icon: '💬',
      url: 'https://zalo.me/thangtinhoc',
      description: 'Nhắn Zalo để được tư vấn lịch học và học phí.',
    },
    {
      section: 'social', status: 'published', isActive: true, sortOrder: 3,
      title: 'YouTube', subtitle: 'Video bài giảng mẫu', icon: '▶️',
      url: 'https://youtube.com/@thangtinhoc',
      description: 'Clip hướng dẫn Excel, Word, PowerPoint miễn phí.',
    },
    {
      section: 'social', status: 'published', isActive: true, sortOrder: 4,
      title: 'TikTok', subtitle: 'Tip tin học ngắn', icon: '🎵',
      url: 'https://tiktok.com/@thangtinhoc',
      description: 'Mẹo văn phòng 15–60 giây mỗi ngày.',
    },
  ];
}

function buildServices() {
  return [
    {
      section: 'service', status: 'published', isActive: true, sortOrder: 1,
      title: 'Tin học văn phòng cơ bản',
      subtitle: 'Windows · Internet · Gõ mười ngón',
      audience: 'Người mới bắt đầu, học sinh, người lớn tuổi',
      curriculum: 'Windows, trình duyệt, email, gõ phím, lưu trữ file',
      duration: '24 buổi (≈ 2 tháng)',
      learningMode: 'Tại trung tâm / Online',
      priceInfo: 'Liên hệ tư vấn theo chi nhánh',
      description: 'Nắm vững thao tác máy tính cơ bản trước khi học Word – Excel.',
    },
    {
      section: 'service', status: 'published', isActive: true, sortOrder: 2,
      title: 'Microsoft Word thực chiến',
      subtitle: 'Soạn thảo văn bản chuyên nghiệp',
      audience: 'Sinh viên, văn phòng, giáo viên',
      curriculum: 'Định dạng, mục lục, thư mục, mail merge, bảo mật tài liệu',
      duration: '16 buổi',
      learningMode: 'Tại trung tâm / Hybrid',
      priceInfo: 'Liên hệ tư vấn',
      description: 'Làm chủ Word cho báo cáo, hợp đồng, luận văn.',
    },
    {
      section: 'service', status: 'published', isActive: true, sortOrder: 3,
      title: 'Microsoft Excel từ cơ bản đến nâng cao',
      subtitle: 'Công thức · Pivot · Dashboard',
      audience: 'Kế toán, kinh doanh, hành chính',
      curriculum: 'Hàm, bảng tính, PivotTable, biểu đồ, Power Query cơ bản',
      duration: '24–32 buổi',
      learningMode: 'Tại trung tâm / Online',
      priceInfo: 'Liên hệ tư vấn',
      description: 'Xử lý số liệu nhanh, báo cáo quản trị rõ ràng.',
    },
    {
      section: 'service', status: 'published', isActive: true, sortOrder: 4,
      title: 'PowerPoint & Canva thuyết trình',
      subtitle: 'Thiết kế slide ấn tượng',
      audience: 'Nhân viên sale, marketing, giáo viên',
      curriculum: 'Bố cục, animation, template, Canva phối hợp',
      duration: '12 buổi',
      learningMode: 'Tại trung tâm',
      priceInfo: 'Liên hệ tư vấn',
      description: 'Tạo bài thuyết trình chuyên nghiệp trong thời gian ngắn.',
    },
    {
      section: 'service', status: 'published', isActive: true, sortOrder: 5,
      title: 'Luyện thi chứng chỉ MOS',
      subtitle: 'Word / Excel / PowerPoint',
      audience: 'Học viên cần chứng chỉ quốc tế',
      curriculum: 'Đề thi thử, kỹ năng thời gian, mẹo đạt điểm cao',
      duration: '8–16 buổi tùy môn',
      learningMode: 'Tại trung tâm (có phòng thi)',
      priceInfo: 'Theo từng môn thi',
      description: 'Ôn luyện sát đề, hỗ trợ đăng ký lịch thi tại trung tâm.',
    },
    {
      section: 'service', status: 'published', isActive: true, sortOrder: 6,
      title: 'Gói doanh nghiệp – đào tạo nội bộ',
      subtitle: 'In-house / Offline theo yêu cầu',
      audience: 'Doanh nghiệp, trường học, cơ quan',
      curriculum: 'Thiết kế lộ trình theo nhu cầu phòng ban',
      duration: 'Linh hoạt',
      learningMode: 'Tại DN hoặc chi nhánh Thắng Tin Học',
      priceInfo: 'Báo giá theo số học viên',
      description: 'Đào tạo Word – Excel cho đội ngũ nhân sự theo ca làm việc.',
    },
  ];
}

function buildExamVenues() {
  return [
    {
      section: 'exam_venue', status: 'published', isActive: true, sortOrder: 1,
      title: 'Phòng thi MOS – TP.HCM',
      code: 'THI-HCM-01',
      city: 'TP. Hồ Chí Minh',
      address: '123 Nguyễn Văn Cừ, Quận 5, TP.HCM (tầng 2)',
      examType: 'MOS Word / Excel / PowerPoint',
      capacity: '24 máy',
      scheduleInfo: 'Thứ 7 & Chủ nhật hàng tuần (đăng ký trước)',
      hours: '7:30 – 17:00 ngày thi',
      phone: '028 3838 9999',
      managerName: 'Phòng Khảo thí HCM',
      description: 'Phòng thi chuẩn, máy cấu hình ổn định, giám sát theo quy chế.',
    },
    {
      section: 'exam_venue', status: 'published', isActive: true, sortOrder: 2,
      title: 'Phòng thi chứng chỉ – Đà Lạt',
      code: 'THI-LD-01',
      city: 'Lâm Đồng',
      address: '45 Trần Phú, Phường 3, Đà Lạt',
      examType: 'MOS / IC3',
      capacity: '16 máy',
      scheduleInfo: '2 tuần/lần hoặc theo lịch đăng ký đủ số lượng',
      hours: '8:00 – 16:30 ngày thi',
      phone: '0263 3822 888',
      managerName: 'Phòng Khảo thí Lâm Đồng',
      description: 'Phục vụ thí sinh khu vực Tây Nguyên.',
    },
    {
      section: 'exam_venue', status: 'published', isActive: true, sortOrder: 3,
      title: 'Phòng thi MOS – Đà Nẵng',
      code: 'THI-DN-01',
      city: 'Đà Nẵng',
      address: '88 Lê Duẩn, Hải Châu, Đà Nẵng',
      examType: 'MOS Word / Excel / PowerPoint',
      capacity: '20 máy',
      scheduleInfo: 'Cuối tuần; có thể mở thêm buổi tối khi đủ thí sinh',
      hours: '7:30 – 17:00 ngày thi',
      phone: '0236 3655 777',
      managerName: 'Phòng Khảo thí Đà Nẵng',
      description: 'Địa điểm thi cho học viên miền Trung.',
    },
  ];
}

function buildCertificates() {
  return [
    {
      section: 'certificate', status: 'published', isActive: true, sortOrder: 1,
      title: 'Chứng chỉ hoàn thành khóa Tin học văn phòng',
      subtitle: 'Cấp bởi Thắng Tin Học',
      issuer: 'Trung tâm Thắng Tin Học',
      requirements: 'Hoàn thành ≥ 80% buổi học và bài kiểm tra cuối khóa',
      relatedExam: 'Kiểm tra nội bộ',
      validity: 'Không thời hạn (ghi nhận hoàn thành khóa)',
      verifyInfo: 'Mã chứng chỉ trên phiếu / tra cứu tại trung tâm',
      verifyUrl: 'https://thangtinhoc.vn/xac-minh',
      description: 'Chứng nhận đã hoàn thành lộ trình Word – Excel – PowerPoint cơ bản.',
    },
    {
      section: 'certificate', status: 'published', isActive: true, sortOrder: 2,
      title: 'Microsoft Office Specialist (MOS)',
      subtitle: 'Chứng chỉ quốc tế Microsoft',
      issuer: 'Microsoft (qua đối tác khảo thí)',
      requirements: 'Đạt điểm chuẩn theo từng môn Word / Excel / PowerPoint',
      relatedExam: 'MOS',
      validity: 'Theo quy định Microsoft',
      verifyInfo: 'Tra cứu trên cổng Certiport / Microsoft',
      verifyUrl: 'https://www.certiport.com',
      description: 'Thắng Tin Học hỗ trợ ôn luyện và tổ chức thi MOS tại các chi nhánh.',
    },
    {
      section: 'certificate', status: 'published', isActive: true, sortOrder: 3,
      title: 'IC3 Digital Literacy',
      subtitle: 'Tin học quốc tế cơ bản',
      issuer: 'Certiport',
      requirements: 'Hoàn thành các module Computing / Key Applications / Living Online',
      relatedExam: 'IC3',
      validity: 'Theo quy định đơn vị cấp',
      verifyInfo: 'Mã xác minh trên hệ thống Certiport',
      description: 'Phù hợp học viên cần chứng chỉ tin học quốc tế nền tảng.',
    },
  ];
}

const OVERVIEW = {
  status: 'published',
  name: 'Trung tâm Thắng Tin Học',
  intro:
    'Thắng Tin Học chuyên đào tạo tin học văn phòng (Word, Excel, PowerPoint, Canva) cho học sinh, sinh viên và người đi làm. Hệ thống 3 chi nhánh tại TP.HCM, Lâm Đồng và Đà Nẵng.',
  mission:
    'Giúp mọi học viên sử dụng thành thạo tin học văn phòng để học tập và làm việc hiệu quả hơn.',
  vision:
    'Trở thành trung tâm đào tạo tin học văn phòng tin cậy tại các tỉnh thành trọng điểm miền Nam – Trung – Tây Nguyên.',
  coreValues:
    'Thực chiến – Đồng hành – Minh bạch – Tôn trọng thời gian học viên.',
  foundedYear: '2012',
  contactEmail: 'lienhe@thangtinhoc.vn',
  contactPhone: '028 3838 9999',
  website: 'https://thangtinhoc.vn',
  headquartersAddress: '123 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh',
  detailHtml: `
<p><strong>Thắng Tin Học</strong> đồng hành cùng hàng nghìn học viên mỗi năm trên lộ trình tin học văn phòng từ cơ bản đến luyện thi chứng chỉ MOS.</p>
<ul>
  <li>Giảng viên kinh nghiệm, giáo trình cập nhật theo nhu cầu công việc thực tế</li>
  <li>Lịch học linh hoạt: sáng / chiều / tối / cuối tuần</li>
  <li>Hỗ trợ luyện đề và thi chứng chỉ tại trung tâm</li>
  <li>3 chi nhánh: TP.HCM · Lâm Đồng · Đà Nẵng</li>
</ul>
<p>Nội dung trang này là <em>dữ liệu mẫu</em> — bạn có thể chỉnh sửa toàn bộ trên trang Quản trị Thông tin trung tâm.</p>
`.trim(),
  introVideoUrl: '',
  galleryUrls: [],
  logoUrl: '',
  bannerUrl: '',
};

async function seedSection(section, items) {
  if (KEEP) {
    const count = await CenterInfoItem.countDocuments({ section });
    if (count > 0) {
      console.log(`  ↷ ${section}: giữ ${count} mục cũ (--keep)`);
      return { section, inserted: 0, kept: count };
    }
  } else {
    const del = await CenterInfoItem.deleteMany({ section });
    if (del.deletedCount) console.log(`  ✂ ${section}: xóa ${del.deletedCount} mục cũ`);
  }
  if (!items.length) return { section, inserted: 0 };
  await CenterInfoItem.insertMany(items);
  console.log(`  ✓ ${section}: thêm ${items.length} mục`);
  return { section, inserted: items.length };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Thiếu MONGODB_URI trong .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
  console.log(KEEP ? 'Chế độ --keep: không xóa mục đã có' : 'Chế độ mặc định: thay mẫu từng section');

  let overview = await CenterOverview.findOne({ _key: 'main' });
  if (!overview) {
    overview = await CenterOverview.create({ _key: 'main', ...OVERVIEW });
    console.log('✓ Tạo overview mới (published)');
  } else {
    Object.assign(overview, OVERVIEW);
    await overview.save();
    console.log('✓ Cập nhật overview (published) — có thể sửa lại trên UI');
  }

  const results = [];
  results.push(await seedSection('staff', buildStaff()));
  results.push(await seedSection('branch', buildBranches()));
  results.push(await seedSection('social', buildSocial()));
  results.push(await seedSection('service', buildServices()));
  results.push(await seedSection('exam_venue', buildExamVenues()));
  results.push(await seedSection('certificate', buildCertificates()));

  const total = await CenterInfoItem.countDocuments();
  console.log('\nHoàn tất. Tổng mục CenterInfoItem:', total);
  console.log('Mở /admin/center-info/manage để xem và chỉnh sửa.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
