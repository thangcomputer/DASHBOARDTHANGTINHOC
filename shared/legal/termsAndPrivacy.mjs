/**
 * Nguồn dữ liệu pháp lý dùng chung cho Hệ thống Thắng Tin Học / Nền tảng DewSkill
 * (Web App LMS, Ứng dụng di động iOS/Android & Website giới thiệu DewSkill).
 */

export const LEGAL_META = {
  brandName: 'DewSkill',
  operatorName: 'Hệ thống giáo dục Thắng Tin Học',
  appName: 'Thắng Tin Học / DewSkill',
  bundleId: 'vn.thangcomputer.thangtinhoc.mobile',
  websiteUrl: 'https://dewskill.com',
  lmsPortalUrl: 'https://thangtinhoc.vn',
  supportHotline: '093 5758 462',
  consultHotline: '0984 623 486',
  zaloPhone: '0935758462',
  effectiveDate: '25/11/2026',
  version: '1.0',
};

export const LEGAL_DOCUMENTS = {
  terms: {
    id: 'terms',
    slug: 'dieu-khoan',
    title: 'Điều khoản sử dụng',
    shortTitle: 'Điều khoản',
    subtitle: 'Quy định sử dụng nền tảng học & luyện thi Tin học trên Web App LMS và Mobile App DewSkill / Thắng Tin Học.',
    updatedAt: LEGAL_META.effectiveDate,
    summaryBullets: [
      'Áp dụng cho Web App LMS, Website DewSkill và Ứng dụng di động Thắng Tin Học (iOS & Android).',
      'Quy định rõ về tài khoản dùng thử miễn phí, tài khoản khóa học, giới hạn thiết bị tin cậy và bảo vệ bản quyền bài giảng.',
      'Minh bạch về thanh toán học phí (VietQR / App Store / Google Play), chính sách hỗ trợ và quyền chấm dứt/xóa tài khoản.',
    ],
    sections: [
      {
        id: 'terms-scope',
        title: '1. Giới thiệu & Chấp nhận điều khoản',
        paragraphs: [
          'Chào mừng bạn đến với nền tảng học và luyện thi Tin học DewSkill do Hệ thống giáo dục Thắng Tin Học vận hành trên cả trình duyệt web (Website giới thiệu, Web App LMS) và ứng dụng di động (iOS & Android).',
          'Khi bạn tạo tài khoản dùng thử, đăng nhập vào hệ thống học tập, đăng ký khóa học hoặc sử dụng bất kỳ tính năng nào trên DewSkill / Thắng Tin Học, bạn xác nhận đã đọc, hiểu rõ và đồng ý tuân thủ các Điều khoản sử dụng này cùng Chính sách bảo mật đi kèm.',
          'Nếu bạn là học sinh dưới 16 tuổi (chẳng hạn theo học Tin học Lớp 1–12 chuẩn SGK Kết nối tri thức), vui lòng sử dụng nền tảng dưới sự hướng dẫn và đồng ý của Phụ huynh hoặc Người giám hộ hợp pháp trước khi đăng ký khóa học có thu phí hoặc cung cấp thông tin liên hệ.',
        ],
      },
      {
        id: 'terms-account',
        title: '2. Tài khoản, Phân quyền & Bảo mật truy cập',
        paragraphs: [
          'Hệ thống cung cấp các nhóm tài khoản chính bao gồm: Tài khoản Dùng thử / Miễn phí (Free Portal), Tài khoản Học viên chính thức (học theo khóa hoặc gói tự học/Meet) và Tài khoản Giảng viên.',
        ],
        bullets: [
          'Thông tin trung thực: Bạn cam kết cung cấp họ tên, số điện thoại / Zalo hoặc email chính xác để phục vụ xác thực OTP, mở khóa bài học và hỗ trợ kỹ thuật khi cần.',
          'Bảo mật cá nhân: Bạn tự chịu trách nhiệm giữ kín mật khẩu, mã PIN khóa ứng dụng và mã OTP đăng nhập. Mọi hoạt động phát sinh từ phiên đăng nhập hợp lệ được xem là thao tác của chủ tài khoản.',
          'Không chia sẻ tài khoản: Mỗi tài khoản phục vụ duy nhất một người học để đảm bảo tính chính xác của tiến độ, chuỗi ngày học (Streak), điểm XP và chứng chỉ số. Hệ thống áp dụng cơ chế xác thực thiết bị tin cậy và có thể từ chối đăng nhập hoặc tạm khóa nếu phát hiện dùng chung, mua bán hoặc cho thuê tài khoản trái phép.',
        ],
      },
      {
        id: 'terms-ip',
        title: '3. Quyền sở hữu trí tuệ & Bản quyền học liệu',
        paragraphs: [
          'Toàn bộ nội dung trên Web App và Mobile App thuộc quyền sở hữu hợp pháp của Thắng Tin Học / DewSkill hoặc đối tác cấp phép, bao gồm nhưng không giới hạn ở: video bài giảng, giáo trình Tin học Lớp 1–12, ngân hàng đề thi mô phỏng MOS / IC3 / CNTT Thông tư 03, bài thực hành tương tác, giao diện, mã nguồn, tài liệu PDF và bộ nhận diện linh vật DewSkill.',
        ],
        bullets: [
          'Bạn được cấp quyền sử dụng phi thương mại, chỉ phục vụ mục đích tự học hoặc giảng dạy theo phạm vi tài khoản đã kích hoạt.',
          'Nghiêm cấm hành vi quay phim/chụp màn hình phát tán công khai, giải mã hoặc trích xuất video bài giảng đã tải offline trên Mobile App, sao chép bộ đề, bán lại tài liệu hoặc nhúng nội dung của DewSkill sang nền tảng khác khi chưa có văn bản chấp thuận.',
        ],
      },
      {
        id: 'terms-conduct-ai',
        title: '4. Quy tắc ứng xử & Sử dụng Trợ lý AI học tập',
        paragraphs: [
          'Khi tham gia Bảng tin, Tin nhắn trao đổi, Lớp học trực tuyến (Meet/Call) hoặc gửi bài tập về nhà, người dùng cần duy trì thái độ lịch sự, tôn trọng giảng viên và học viên khác.',
        ],
        bullets: [
          'Không đăng tải nội dung vi phạm pháp luật, phản cảm, quảng cáo rác (spam), mã độc hoặc cố ý gây gián đoạn hạ tầng máy chủ.',
          'Không gian lận kết quả luyện tập XP, bài kiểm tra hoặc dùng công cụ tự động (bot/script) can thiệp vào hệ thống chấm điểm.',
          'Trợ lý AI & Gợi ý học tập: Các phản hồi từ Trợ lý AI trong mục Hỗ trợ và Luyện tập nhằm giúp bạn tra cứu nhanh hàm Excel, thao tác Word/PowerPoint, Python hoặc cách dùng LMS. Kết quả AI mang tính tham khảo học tập; đối với quy chế thi, điểm số chính thức hoặc tư vấn học phí, vui lòng xác nhận lại với Giảng viên hoặc Bộ phận Hỗ trợ.',
        ],
      },
      {
        id: 'terms-payment',
        title: '5. Học thử miễn phí, Học phí & Chính sách hoàn/bảo lưu',
        paragraphs: [
          'DewSkill minh bạch toàn bộ quyền lợi miễn phí và có phí trước khi học viên xác nhận thanh toán:',
        ],
        bullets: [
          'Chế độ Dùng thử miễn phí (Free Portal): Cho phép trải nghiệm các bài luyện tập và học thử được mở khóa sẵn mà không yêu cầu khai báo thẻ ngân hàng. Một số chuyên mục nâng cao (lớp Meet trực tuyến, giáo trình theo khóa chuyên sâu) sẽ hiển thị trạng thái khóa cho đến khi bạn nâng cấp.',
          'Thanh toán khóa học: Học viên có thể đăng ký trực tiếp qua chuyển khoản VietQR tại cổng đăng ký hoặc đăng ký gói nâng cấp thông qua Apple App Store / Google Play (In-App Purchase) trên thiết bị di động.',
          'Hoàn phí & Bảo lưu: Mọi yêu cầu bảo lưu, chuyển khóa hoặc hoàn học phí phát sinh từ giao dịch chuyển khoản trực tiếp được tiếp nhận và xử lý theo quy chế đào tạo của Thắng Tin Học tại thời điểm đăng ký. Đối với các gói thanh toán qua Apple App Store hoặc Google Play, việc gia hạn, hủy gói và yêu cầu hoàn tiền tuân theo quy trình chính thức của Apple / Google.',
        ],
      },
      {
        id: 'terms-termination',
        title: '6. Tạm ngừng dịch vụ & Xóa tài khoản',
        paragraphs: [
          'Bạn có thể ngừng sử dụng dịch vụ bất cứ lúc nào hoặc chủ động thực hiện xóa tài khoản vĩnh viễn ngay trong ứng dụng Mobile (Hồ sơ -> Xóa tài khoản vĩnh viễn) hay liên hệ bộ phận hỗ trợ.',
          'Thắng Tin Học có quyền tạm đình chỉ hoặc chấm dứt quyền truy cập đối với tài khoản vi phạm nghiêm trọng bản quyền nội dung, chia sẻ tài khoản thương mại hoặc tấn công kỹ thuật vào hệ thống.',
        ],
      },
      {
        id: 'terms-liability',
        title: '7. Giới hạn trách nhiệm & Cập nhật điều khoản',
        paragraphs: [
          'Chúng tôi nỗ lực đảm bảo Web App LMS và Mobile App vận hành ổn định 24/7 và đồng bộ tiến độ liền mạch. Tuy nhiên, dịch vụ có thể tạm gián đoạn ngắn để nâng cấp hệ thống hoặc do sự cố đường truyền Internet/nhà mạng nằm ngoài tầm kiểm soát hợp lý.',
          'Điều khoản sử dụng này có thể được cập nhật theo từng giai đoạn phát triển sản phẩm hoặc thay đổi quy định pháp luật. Phiên bản mới nhất luôn được công bố công khai trên website, Web App và trong ứng dụng di động kèm ngày hiệu lực.',
        ],
      },
      {
        id: 'terms-contact',
        title: '8. Liên hệ hỗ trợ & Giải quyết thắc mắc',
        paragraphs: [
          'Mọi câu hỏi về Điều khoản sử dụng, khiếu nại bản quyền hoặc yêu cầu hỗ trợ tài khoản, vui lòng liên hệ:',
        ],
        bullets: [
          'Hỗ trợ kỹ thuật LMS & Tài khoản: Hotline / Zalo 093 5758 462',
          'Tư vấn lộ trình & Khóa học: Hotline / Zalo 0984 623 486',
          'Website & Cổng học tập: https://dewskill.com — https://thangtinhoc.vn',
        ],
      },
    ],
  },

  privacy: {
    id: 'privacy',
    slug: 'bao-mat',
    title: 'Chính sách bảo mật',
    shortTitle: 'Bảo mật',
    subtitle: 'Cam kết minh bạch cách DewSkill / Thắng Tin Học thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu trên Web & Mobile.',
    updatedAt: LEGAL_META.effectiveDate,
    summaryBullets: [
      'Chỉ thu thập dữ liệu cần thiết để tạo tài khoản, đồng bộ tiến độ học Web – Mobile và hỗ trợ học viên.',
      'Giải thích rõ mục đích từng quyền trên Mobile App: Micro, Camera/Ảnh, Face ID / Vân tay, Thông báo và Mã thiết bị.',
      'Không bán dữ liệu cá nhân cho bên thứ ba; cho phép chỉnh sửa hồ sơ và xóa tài khoản vĩnh viễn ngay trong ứng dụng.',
    ],
    sections: [
      {
        id: 'privacy-overview',
        title: '1. Phạm vi áp dụng & Nguyên tắc chung',
        paragraphs: [
          'Chính sách bảo mật này giải thích cách Hệ thống giáo dục Thắng Tin Học / Nền tảng DewSkill thu thập, sử dụng, bảo vệ và cho phép bạn kiểm soát thông tin cá nhân khi sử dụng Website, Web App LMS và Ứng dụng di động Thắng Tin Học (iOS & Android).',
          'Chúng tôi cam kết tôn trọng quyền riêng tư của học viên, phụ huynh và giảng viên; tuyệt đối không bán, cho thuê hay trao đổi dữ liệu cá nhân của bạn cho các đơn vị quảng cáo bên thứ ba.',
        ],
      },
      {
        id: 'privacy-collected',
        title: '2. Các loại dữ liệu chúng tôi thu thập',
        paragraphs: [
          'Tùy theo vai trò và tính năng bạn sử dụng trên Web App và Mobile App, hệ thống có thể xử lý các nhóm dữ liệu sau:',
        ],
        bullets: [
          'Thông tin tài khoản & Liên hệ: Họ và tên, số điện thoại / Zalo, địa chỉ email, độ tuổi (để gợi ý lộ trình Lớp 1–12 / Sinh viên / Người đi làm), giới tính (tùy chọn đặt ảnh đại diện mặc định), chi nhánh đăng ký và ảnh đại diện bạn tải lên.',
          'Dữ liệu học tập & Tương tác: Tiến độ bài học, thời lượng xem video, kết quả bài tập/bài thi MOS–IC3–Tin học, điểm XP, chuỗi ngày học (Streak), chứng chỉ số, tin nhắn trao đổi với Giảng viên/Hỗ trợ và nội dung bạn gửi tới Trợ lý AI.',
          'Dữ liệu thiết bị & Bảo mật phiên: Mã định danh thiết bị (dùng cho tính năng Thiết bị tin cậy), loại thiết bị, phiên bản hệ điều hành, phiên bản ứng dụng và địa chỉ IP để phòng chống đăng nhập trái phép và bảo vệ video học offline.',
          'Thông tin giao dịch học phí: Mã đơn thanh toán VietQR, số tiền, tên khóa học, thời điểm xác nhận hoặc mã biên nhận từ App Store / Google Play. DewSkill không thu thập hoặc lưu trữ số thẻ tín dụng, mã PIN hay mật khẩu ngân hàng của bạn.',
        ],
      },
      {
        id: 'privacy-mobile-permissions',
        title: '3. Quyền truy cập trên Ứng dụng di động (iOS & Android)',
        paragraphs: [
          'Ứng dụng Thắng Tin Học / DewSkill chỉ yêu cầu quyền thiết bị khi bạn chủ động sử dụng tính năng tương ứng và bạn có thể thu hồi bất kỳ lúc nào trong phần Cài đặt của điện thoại:',
        ],
        bullets: [
          'Micro (Microphone / RECORD_AUDIO): Chỉ dùng khi bạn thực hiện cuộc gọi thoại/video với Giảng viên hoặc gửi ghi âm trao đổi bài học; không tự động ghi âm nền.',
          'Camera & Thư viện ảnh: Chỉ dùng khi bạn chọn đổi ảnh đại diện, chụp bài làm nộp Giảng viên hoặc gửi ảnh minh họa khi cần hỗ trợ.',
          'Face ID / Vân tay (Sinh trắc học): Tính năng tùy chọn giúp mở khóa đăng nhập nhanh. Quá trình xác thực sinh trắc học diễn ra hoàn toàn cục bộ trên phần cứng bảo mật của Apple/Android; ứng dụng chỉ lưu token xác thực được mã hóa trong SecureStore / Keychain và không bao giờ truy cập hay lưu trữ dữ liệu khuôn mặt/vân tay thô.',
          'Thông báo đẩy (Notifications): Chỉ gửi nhắc lịch học (24 giờ, 60 phút, 15 phút trước giờ học), tin nhắn mới hoặc thông báo học phí. Bạn có thể bật/tắt chi tiết từng loại thông báo ngay trong mục Hồ sơ -> Cài đặt và hỗ trợ.',
        ],
      },
      {
        id: 'privacy-purpose',
        title: '4. Mục đích sử dụng & Đồng bộ dữ liệu',
        paragraphs: [
          'Thông tin thu thập được sử dụng đúng mục đích giáo dục và vận hành nền tảng:',
        ],
        bullets: [
          'Khởi tạo tài khoản, xác thực đăng nhập qua OTP/mật khẩu và đồng bộ liền mạch tiến độ học tập giữa Web App và Mobile App.',
          'Cá nhân hóa lộ trình tự học Tin học Lớp 1–12, luyện thi chứng chỉ, cấp và xác thực chứng chỉ số.',
          'Hỗ trợ giải đáp bài tập qua Giảng viên, bộ phận CSKH hoặc Trợ lý AI học tập.',
          'Phát hiện bất thường, bảo vệ bản quyền học liệu video mã hóa offline và chống spam/gian lận.',
        ],
      },
      {
        id: 'privacy-sharing',
        title: '5. Lưu trữ, Bảo mật & Chia sẻ với bên thứ ba',
        paragraphs: [
          'Dữ liệu truyền tải giữa trình duyệt/ứng dụng di động và máy chủ được mã hóa qua giao thức HTTPS/TLS. Thông tin nhạy cảm như mật khẩu và phiên đăng nhập được băm/mã hóa an toàn trước khi lưu trữ.',
          'Chúng tôi chỉ chia sẻ phạm vi dữ liệu tối thiểu cần thiết cho các đối tác hạ tầng kỹ thuật giúp dịch vụ hoạt động (như máy chủ lưu trữ đám mây, cổng gửi thông báo đẩy Expo/APNs/FCM, cổng thanh toán ngân hàng VietQR hoặc Apple/Google Store, và nhà cung cấp mô hình AI xử lý câu hỏi học tập của bạn). Các bên này không được phép dùng dữ liệu của bạn cho mục đích tiếp thị riêng.',
        ],
      },
      {
        id: 'privacy-rights',
        title: '6. Quyền của người dùng & Yêu cầu Xóa tài khoản',
        paragraphs: [
          'Bạn luôn nắm quyền kiểm soát dữ liệu cá nhân của mình trên DewSkill:',
        ],
        bullets: [
          'Xem & Chỉnh sửa: Cập nhật họ tên, thông tin liên hệ, ảnh đại diện, mục tiêu học tập và tùy chọn thông báo trực tiếp trong mục Hồ sơ.',
          'Xóa tài khoản vĩnh viễn: Học viên sử dụng Mobile App có thể thực hiện ngay tại Hồ sơ -> Xóa tài khoản vĩnh viễn. Người dùng Web App hoặc không còn truy cập ứng dụng có thể yêu cầu xóa qua trang Xóa tài khoản hoặc liên hệ Hotline/Zalo 093 5758 462.',
          'Thời hạn xử lý: Sau khi xác nhận yêu cầu xóa hợp lệ, dữ liệu hồ sơ cá nhân và khóa truy cập sẽ bị xóa hoặc ẩn danh khỏi hệ thống vận hành, trừ các chứng từ giao dịch tài chính cần lưu trữ theo quy định kế toán hiện hành.',
        ],
      },
      {
        id: 'privacy-children',
        title: '7. Quyền riêng tư đối với Học sinh dưới 16 tuổi',
        paragraphs: [
          'Do nền tảng có chương trình Tin học Tiểu học – THCS – THPT (Lớp 1–12), chúng tôi đặc biệt thận trọng với dữ liệu của người học nhỏ tuổi. Hệ thống không chạy quảng cáo theo hành vi nhắm tới học sinh.',
          'Phụ huynh có thể liên hệ Hotline hỗ trợ kỹ thuật 093 5758 462 hoặc Tư vấn 0984 623 486 bất kỳ lúc nào để kiểm tra, cập nhật hoặc yêu cầu xóa tài khoản của con em mình.',
        ],
      },
      {
        id: 'privacy-contact',
        title: '8. Thông tin liên hệ về Quyền riêng tư',
        paragraphs: [
          'Nếu bạn có bất kỳ thắc mắc hoặc yêu cầu nào liên quan đến Chính sách bảo mật và bảo vệ dữ liệu cá nhân, vui lòng liên hệ đội ngũ vận hành DewSkill / Thắng Tin Học:',
        ],
        bullets: [
          'Hotline / Zalo Hỗ trợ kỹ thuật & Dữ liệu: 093 5758 462',
          'Hotline Tư vấn phụ huynh & Học viên: 0984 623 486',
          'Trang thông tin chính thức: https://dewskill.com và https://thangtinhoc.vn',
        ],
      },
    ],
  },
};

export function getLegalDocument(type = 'terms') {
  return type === 'privacy' ? LEGAL_DOCUMENTS.privacy : LEGAL_DOCUMENTS.terms;
}
