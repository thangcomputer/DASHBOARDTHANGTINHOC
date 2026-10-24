import type {
  AppNotification,
  Assignment,
  ChatMessage,
  Conversation,
  DemoStudent,
  DemoEvaluation,
  DemoFeedPost,
  DemoFinanceTransaction,
  DemoNewsItem,
  DemoQuiz,
  DemoSoftwareLink,
  DemoTrainingCourse,
  DemoUser,
  LearningCourse,
  LearningMaterial,
  ScheduleItem,
} from '../types';

export const mockStudent: DemoUser = {
  id: 'student-demo',
  name: 'Minh Anh',
  role: 'student',
  phone: '0901 234 567',
  code: 'HV-02481',
  course: 'TIN HỌC VĂN PHÒNG CB (1 KÈM 1)',
  teacherName: 'Thầy Phí Văn Thắng',
  teacherRating: 4.9,
  completedSessions: 8,
  totalSessions: 8,
  branch: 'Trung tâm Thắng Tin Học',
  avatarColor: '#DDF1EB',
};

export const mockTeacher: DemoUser = {
  id: 'teacher-demo',
  name: 'Nguyễn Hoàng Nam',
  role: 'teacher',
  phone: '0912 345 678',
  code: 'GV-00128',
  course: 'Tin học văn phòng',
  branch: 'Chi nhánh Bình Thạnh',
  avatarColor: '#E9E5FA',
};

export const mockSchedule: ScheduleItem[] = [
  {
    id: 'class-1',
    title: 'Word nâng cao · Buổi 8',
    subject: 'Microsoft Word',
    person: 'Cô Ngọc Hà',
    dateLabel: 'Hôm nay',
    time: '18:00 – 19:30',
    location: 'Phòng học 02 · Trực tiếp',
    status: 'upcoming',
    color: '#087F8C',
  },
  {
    id: 'class-2',
    title: 'Excel thực hành · Buổi 5',
    subject: 'Microsoft Excel',
    person: 'Thầy Hoàng Nam',
    dateLabel: 'Thứ Tư, 28/10',
    time: '17:30 – 19:00',
    location: 'Học trực tuyến',
    status: 'upcoming',
    color: '#18845B',
  },
  {
    id: 'class-3',
    title: 'PowerPoint · Buổi 3',
    subject: 'Microsoft PowerPoint',
    person: 'Cô Ngọc Hà',
    dateLabel: 'Thứ Sáu, 30/10',
    time: '18:00 – 19:30',
    location: 'Phòng học 01 · Trực tiếp',
    status: 'upcoming',
    color: '#7456B8',
  },
  {
    id: 'class-4',
    title: 'Excel cơ bản · Buổi 4',
    subject: 'Microsoft Excel',
    person: 'Thầy Hoàng Nam',
    dateLabel: 'Thứ Hai, 26/10',
    time: '17:30 – 19:00',
    location: 'Phòng học 03',
    status: 'completed',
    color: '#18845B',
  },
];

export const mockTeacherSchedule: ScheduleItem[] = [
  {
    id: 'teacher-class-1',
    title: 'Word nâng cao · Buổi 8',
    subject: 'Microsoft Word',
    person: 'Nguyễn Hoàng Nam',
    dateLabel: 'Hôm nay',
    date: '2026-10-24',
    studentId: 'pupil-1',
    studentName: 'Trần Minh Anh',
    time: '18:00 – 19:30',
    location: 'Phòng học 02 · Trực tiếp',
    status: 'upcoming',
    attendanceStatus: 'pending',
    color: '#087F8C',
  },
  {
    id: 'teacher-class-2',
    title: 'Excel cơ bản · Buổi 5',
    subject: 'Microsoft Excel',
    person: 'Nguyễn Hoàng Nam',
    dateLabel: 'Thứ Tư, 28/10',
    date: '2026-10-28',
    studentId: 'pupil-2',
    studentName: 'Lê Hoàng Phúc',
    time: '17:30 – 19:00',
    location: 'Học trực tuyến',
    status: 'upcoming',
    attendanceStatus: 'pending',
    color: '#18845B',
  },
  {
    id: 'teacher-class-3',
    title: 'PowerPoint · Buổi 3',
    subject: 'Microsoft PowerPoint',
    person: 'Nguyễn Hoàng Nam',
    dateLabel: 'Thứ Ba, 20/10',
    date: '2026-10-20',
    studentId: 'pupil-3',
    studentName: 'Phạm Khánh Linh',
    time: '17:30 – 19:00',
    location: 'Phòng học 03',
    status: 'completed',
    attendanceStatus: 'present',
    color: '#7456B8',
  },
];

export const mockAssignments: Assignment[] = [
  { id: 'task-1', title: 'Bảng tính chi tiêu gia đình', subject: 'Microsoft Excel', teacher: 'Thầy Hoàng Nam', deadline: 'Hạn nộp hôm nay, 22:00', status: 'Chưa làm', description: 'Thực hành theo nội dung được giao trong khóa học.' },
  { id: 'task-2', title: 'Định dạng báo cáo tháng', subject: 'Microsoft Word', teacher: 'Cô Ngọc Hà', deadline: 'Hạn nộp 29/10/2026', status: 'Đã nộp', description: 'Hoàn thiện định dạng báo cáo theo yêu cầu.' },
  { id: 'task-3', title: 'Thiết kế slide giới thiệu', subject: 'Microsoft PowerPoint', teacher: 'Cô Ngọc Hà', deadline: 'Quá hạn 1 ngày', status: 'Quá hạn', description: 'Tạo bài trình bày theo chủ đề được giao.' },
  { id: 'task-4', title: 'Hàm IF và VLOOKUP', subject: 'Microsoft Excel', teacher: 'Thầy Hoàng Nam', deadline: 'Hạn nộp 02/11/2026', status: 'Chưa làm', description: 'Bài thực hành hàm trong Microsoft Excel.' },
];

export const mockTeacherAssignments: Assignment[] = [
  { id: 'teacher-task-1', title: 'Bảng tính chi tiêu gia đình', subject: 'Microsoft Excel', teacher: 'Nguyễn Hoàng Nam', deadline: 'Hạn nộp hôm nay, 22:00', status: 'Cần chấm', description: 'Bài thực hành Excel được giao cho học viên.', submissions: [
    { id: 'submission-1', studentName: 'Trần Minh Anh', submittedAt: 'Hôm nay', status: 'submitted', submittedFileUrl: 'Bài làm demo.xlsx' },
    { id: 'submission-2', studentName: 'Phạm Khánh Linh', submittedAt: 'Hôm qua', status: 'graded', submittedFileUrl: 'Bài làm demo.xlsx', grade: 8.5, teacherFeedback: 'Bài làm tốt.' },
  ] },
  { id: 'teacher-task-2', title: 'Định dạng báo cáo tháng', subject: 'Microsoft Word', teacher: 'Nguyễn Hoàng Nam', deadline: 'Hạn nộp 29/10/2026', status: 'Đã nộp', description: 'Thực hành định dạng tài liệu.' },
];

export const mockMaterials: LearningMaterial[] = [
  { id: 'file-1', title: 'Giáo trình Word nâng cao', subject: 'Microsoft Word', type: 'PDF', date: '24/10/2026', size: '4.2 MB' },
  { id: 'file-2', title: 'Bài tập Excel tuần 4', subject: 'Microsoft Excel', type: 'EXCEL', date: '23/10/2026', size: '820 KB' },
  { id: 'file-3', title: 'Video: Tạo mục lục tự động', subject: 'Microsoft Word', type: 'VIDEO', date: '22/10/2026', size: '12 phút' },
  { id: 'file-4', title: 'Mẫu báo cáo thực hành', subject: 'Microsoft Word', type: 'WORD', date: '20/10/2026', size: '1.1 MB' },
  { id: 'file-5', title: 'Tài nguyên lớp học', subject: 'Tổng hợp', type: 'LINK', date: '18/10/2026', size: 'Liên kết' },
];

export const mockLearningCourses: LearningCourse[] = [
  {
    _id: 'course-office-advanced',
    title: 'Tin học văn phòng nâng cao',
    subject: 'Tin học văn phòng',
    description: 'Nội dung học theo khóa, gồm các phần bài học, tài liệu và bài tập được giao.',
    software: 'Microsoft Word, Microsoft Excel, Microsoft PowerPoint',
    progress: 58,
    enrolled: true,
    deliveryMode: 'instructor',
    totalSessions: 8,
    units: [
      {
        _id: 'unit-word',
        title: 'Microsoft Word',
        sections: [
          { _id: 'lesson-word-1', title: 'Định dạng văn bản nâng cao', duration: '18 phút', progress: 100, completed: true, locked: false },
          { _id: 'lesson-word-2', title: 'Tạo mục lục tự động', duration: '22 phút', progress: 40, completed: false, locked: false },
        ],
      },
      {
        _id: 'unit-excel',
        title: 'Microsoft Excel',
        sections: [
          { _id: 'lesson-excel-1', title: 'Hàm IF và VLOOKUP', duration: '25 phút', progress: 0, completed: false, locked: false },
          { _id: 'lesson-excel-2', title: 'Bảng tổng hợp dữ liệu', duration: '20 phút', progress: 0, completed: false, locked: true },
        ],
      },
    ],
  },
  {
    _id: 'course-office-video',
    title: 'Tin học văn phòng tự học qua video',
    subject: 'Tin học văn phòng',
    description: 'Khóa tự học theo video và tài liệu của khóa học.',
    software: 'Microsoft Word, Microsoft Excel',
    progress: 0,
    enrolled: false,
    deliveryMode: 'video',
    totalSessions: 0,
    price: 0,
    units: [],
  },
  {
    _id: 'course-excel-instructor',
    title: 'Microsoft Excel thực hành',
    subject: 'Microsoft Excel',
    description: 'Khóa học cùng giảng viên theo lịch được xếp.',
    software: 'Microsoft Excel',
    progress: 0,
    enrolled: false,
    deliveryMode: 'instructor',
    totalSessions: 8,
    price: 0,
    units: [],
  },
];

export const mockEvaluations: DemoEvaluation[] = [
  {
    id: 'evaluation-course-1',
    courseName: 'Tin học văn phòng nâng cao',
    teacherName: 'Nguyễn Hoàng Nam',
    milestone: 'manual_feedback',
    completed: false,
    public: false,
    criteria: ['Mức độ hài lòng với trung tâm', 'Giảng viên dạy dễ hiểu không'],
    completedSessions: 8,
    totalSessions: 12,
  },
  {
    id: 'evaluation-teacher-1',
    courseName: 'Tin học văn phòng nâng cao',
    teacherName: 'Nguyễn Hoàng Nam',
    milestone: 'course_end_teacher',
    completed: false,
    public: true,
    criteria: ['Kiến thức chuyên môn', 'Phương pháp giảng dạy', 'Thái độ giảng dạy'],
    completedSessions: 8,
    totalSessions: 12,
  },
];

export const mockFeedPosts: DemoFeedPost[] = [
  {
    id: 'feed-1',
    author: 'Trung tâm Thắng Tin Học',
    role: 'Thông báo lớp học',
    time: 'Hôm nay',
    content: 'Lịch học và bài tập của khóa học được cập nhật trong từng mục tương ứng.',
    audience: 'Học viên và giảng viên',
    comments: [{ id: 'comment-1', author: 'Minh Anh', text: 'Em đã xem thông tin.' }],
    reactionCount: 3,
  },
];

export const mockNews: DemoNewsItem[] = [
  {
    id: 'news-1',
    slug: 'cap-nhat-lich-hoc',
    title: 'Cập nhật lịch học và nội dung khóa học',
    topic: 'Thông báo',
    publishedAt: 'Hôm nay',
    excerpt: 'Học viên vui lòng kiểm tra lịch học, tài liệu và bài tập trong tài khoản.',
    content: 'Các thông tin về lịch học, tài liệu và bài tập được hiển thị trong các mục tương ứng của tài khoản học viên.',
    views: 24,
    attachments: [],
  },
];

export const mockSoftwareLinks: DemoSoftwareLink[] = [
  { id: 'software-word', name: 'Microsoft Word', description: 'Phần mềm sử dụng trong nội dung khóa học.', category: 'Tin học văn phòng', url: '' },
  { id: 'software-excel', name: 'Microsoft Excel', description: 'Phần mềm sử dụng trong nội dung khóa học.', category: 'Tin học văn phòng', url: '' },
];

export const mockQuizzes: DemoQuiz[] = [
  {
    id: 'quiz-1',
    title: 'Trắc nghiệm Microsoft Excel',
    courseName: 'Tin học văn phòng nâng cao',
    timeLimitMinutes: 20,
    deadline: 'Theo lịch buổi học',
    questions: 10,
    submissions: [
      { studentName: 'Minh Anh', score: 80, status: 'passed' },
      { studentName: 'Quốc Bảo', score: 65, status: 'submitted' },
    ],
  },
];

export const mockStudentQuizzes: DemoQuiz[] = [
  {
    id: 'student-quiz-1',
    title: 'Trắc nghiệm buổi học Microsoft Excel',
    courseName: 'TIN HỌC VĂN PHÒNG CB (1 KÈM 1)',
    timeLimitMinutes: 15,
    deadline: 'Theo lịch buổi học',
    questions: 5,
    submissions: [],
    sampleQuestions: [{ text: 'Phím tắt lưu một tệp trong Microsoft Excel là gì?', options: ['Ctrl + S', 'Ctrl + P', 'Ctrl + N', 'Ctrl + O'], correctOption: 0 }],
  },
];

export const mockTrainingCourses: DemoTrainingCourse[] = [
  {
    id: 'training-1',
    title: 'Đào tạo chuyên môn giảng viên',
    progress: 45,
    lessons: [
      { id: 'training-lesson-1', title: 'Quy trình giảng dạy', duration: '15 phút', completed: true },
      { id: 'training-lesson-2', title: 'Quản lý lớp học', duration: '20 phút', completed: false },
    ],
    files: ['Tài liệu hướng dẫn giảng dạy'],
    notices: ['Theo dõi các nội dung và tài liệu được giao trong khóa đào tạo.'],
  },
];

export const mockFinanceTransactions: DemoFinanceTransaction[] = [
  { id: 'finance-1', month: '10/2026', date: '31/10/2026', amount: 2400000, sessions: 12, status: 'Chưa nhận', note: 'Tổng hợp theo số buổi dạy.' },
  { id: 'finance-2', month: '09/2026', date: '30/09/2026', amount: 1800000, sessions: 9, status: 'Đã nhận', note: 'Đã xác nhận thanh toán.' },
];

export const mockNotifications: AppNotification[] = [
  { id: 'notice-1', title: 'Lịch học hôm nay', message: 'Bạn có lớp Word nâng cao lúc 18:00 tại phòng học 02.', time: '10 phút trước', category: 'Lịch học', unread: true },
  { id: 'notice-2', title: 'Bài tập mới được giao', message: 'Thầy Hoàng Nam đã giao bài “Bảng tính chi tiêu gia đình”.', time: '1 giờ trước', category: 'Bài tập', unread: true },
  { id: 'notice-3', title: 'Tài liệu học tập mới', message: 'Giáo trình Word nâng cao đã được thêm vào lớp của bạn.', time: 'Hôm qua', category: 'Trung tâm', unread: false },
  { id: 'notice-4', title: 'Tin nhắn từ cô Ngọc Hà', message: 'Cô đã phản hồi câu hỏi về bài thực hành tuần này.', time: 'Hôm qua', category: 'Tin nhắn', unread: false },
  { id: 'notice-5', title: 'Thông tin học phí', message: 'Đây là nội dung minh họa, không phát sinh giao dịch.', time: '20/10/2026', category: 'Học phí', unread: false },
];

export const mockTeacherNotifications: AppNotification[] = [
  { id: 'teacher-notice-1', title: 'Lịch dạy hôm nay', message: 'Bạn có buổi Word nâng cao lúc 18:00 tại phòng học 02.', time: '10 phút trước', category: 'Lịch học', unread: true },
  { id: 'teacher-notice-2', title: 'Bài tập cần chấm', message: 'Có bài nộp mới trong lớp Microsoft Excel.', time: '1 giờ trước', category: 'Bài tập', unread: true },
  { id: 'teacher-notice-3', title: 'Tin nhắn học viên', message: 'Lê Hoàng Phúc có tin nhắn mới.', time: 'Hôm qua', category: 'Tin nhắn', unread: false },
];

export const mockConversations: Conversation[] = [
  { id: 'chat-1', name: 'Cô Ngọc Hà', role: 'Giảng viên', category: 'teacher', online: true, lastMessage: 'Em nhớ xem lại phần định dạng trang nhé.', time: '10:42', unread: 2, color: '#F6E9D9' },
  { id: 'chat-2', name: 'Thầy Hoàng Nam', role: 'Giảng viên', category: 'teacher', online: false, lastMessage: 'Thầy đã gửi tài liệu Excel tuần này.', time: 'Hôm qua', unread: 0, color: '#E4EBFA' },
  { id: 'chat-3', name: 'Trung tâm Thắng Tin Học', role: 'Hỗ trợ học viên', category: 'support', lastMessage: 'Chào bạn, trung tâm có thể hỗ trợ gì?', time: 'Thứ Sáu', unread: 0, color: '#DDF1EB' },
];

export const mockTeacherConversations: Conversation[] = [
  { id: 'teacher-chat-1', name: 'Lê Hoàng Phúc', role: 'Học viên · Excel cơ bản', category: 'student', online: true, lastMessage: 'Em xin hỏi lại bài tập Excel ạ.', time: '10:42', unread: 2, color: '#F6E9D9' },
  { id: 'teacher-chat-2', name: 'Trần Minh Anh', role: 'Học viên · Word nâng cao', category: 'student', online: false, lastMessage: 'Em đã xem nhận xét bài tập.', time: 'Hôm qua', unread: 0, color: '#DDF1EB' },
  { id: 'teacher-chat-3', name: 'Trung tâm Thắng Tin Học', role: 'Hỗ trợ', category: 'support', lastMessage: 'Lịch dạy tuần này đã được cập nhật.', time: 'Thứ Sáu', unread: 1, color: '#E4EBFA' },
  { id: 'teacher-chat-4', name: 'Nhóm lớp Word nâng cao', role: 'Nhóm', category: 'group', lastMessage: 'Lịch học buổi tiếp theo: 18:00.', time: 'Thứ Năm', unread: 0, color: '#E9E5FA' },
  { id: 'teacher-chat-5', name: 'Admin Thắng Tin Học', role: 'Admin', category: 'admin', lastMessage: 'Thông tin hồ sơ giảng viên đã được cập nhật.', time: 'Thứ Năm', unread: 0, color: '#E4EBFA' },
  { id: 'teacher-chat-6', name: 'Bộ phận Tuyển sinh', role: 'Tuyển sinh', category: 'recruitment', lastMessage: 'Có thông tin học viên mới cần xác nhận.', time: 'Thứ Tư', unread: 0, color: '#F6E9D9' },
];

export const mockMessages: ChatMessage[] = [
  { id: 'msg-1', text: 'Chào em, cô đã xem bài thực hành tuần này rồi nhé.', time: '10:30', mine: false },
  { id: 'msg-2', text: 'Dạ cô ơi, phần đánh số trang em làm như vậy đã đúng chưa ạ?', time: '10:36', mine: true },
  { id: 'msg-3', text: 'Em nhớ xem lại phần định dạng trang nhé. Cô gửi em một mẫu để tham khảo.', time: '10:42', mine: false },
];

export const mockTeacherThreads: Record<string, ChatMessage[]> = {
  'teacher-chat-1': [
    { id: 'teacher-msg-1', text: 'Thầy ơi, em xin hỏi lại bài tập Excel ạ.', time: '10:30', mine: false },
    { id: 'teacher-msg-2', text: 'Em đang vướng ở bước nào? Gửi thầy tên hàm em đang dùng nhé.', time: '10:36', mine: true },
    { id: 'teacher-msg-3', text: 'Em chưa biết cách kết hợp hàm IF với VLOOKUP.', time: '10:42', mine: false },
  ],
  'teacher-chat-2': [
    { id: 'teacher-msg-4', text: 'Em đã xem nhận xét bài tập Word.', time: 'Hôm qua', mine: false },
    { id: 'teacher-msg-5', text: 'Tốt, em hãy chỉnh lại phần căn lề theo góp ý nhé.', time: 'Hôm qua', mine: true },
  ],
  'teacher-chat-3': [
    { id: 'teacher-msg-6', text: 'Lịch dạy tuần này đã được cập nhật.', time: 'Thứ Sáu', mine: false },
    { id: 'teacher-msg-7', text: 'Tôi đã nhận được thông tin, cảm ơn Trung tâm.', time: 'Thứ Sáu', mine: true },
  ],
  'teacher-chat-4': [
    { id: 'teacher-msg-8', text: 'Lịch học buổi tiếp theo: 18:00.', time: 'Thứ Năm', mine: false },
    { id: 'teacher-msg-9', text: 'Thầy đã xác nhận lịch buổi học.', time: 'Thứ Năm', mine: true },
  ],
};

export const mockTeacherStudents: DemoStudent[] = [
  { id: 'pupil-1', name: 'Trần Minh Anh', phone: '0900 000 101', course: 'Word nâng cao', progress: 68, lastClass: 'Học hôm nay, 18:00', status: 'Đang học', enrollmentStatus: 'active', color: '#DDF1EB', totalSessions: 12, completedSessions: 8, remainingSessions: 4, avgGrade: 8.2, notes: '', attendance: [{ date: '22/10', course: 'Word nâng cao', status: 'Có mặt' }] },
  { id: 'pupil-2', name: 'Lê Hoàng Phúc', phone: '0900 000 102', course: 'Excel cơ bản', progress: 42, lastClass: 'Vắng buổi 22/10', status: 'Cần hỗ trợ', enrollmentStatus: 'active', color: '#F6E9D9', totalSessions: 12, completedSessions: 5, remainingSessions: 7, avgGrade: 6.5, notes: 'Cần theo dõi chuyên cần.', attendance: [{ date: '22/10', course: 'Excel cơ bản', status: 'Vắng' }] },
  { id: 'pupil-3', name: 'Phạm Khánh Linh', phone: '0900 000 103', course: 'Tin học văn phòng', progress: 92, lastClass: 'Học ngày 23/10', status: 'Đang học', enrollmentStatus: 'active', color: '#E9E5FA', totalSessions: 12, completedSessions: 11, remainingSessions: 1, avgGrade: 9, notes: '', attendance: [{ date: '23/10', course: 'Tin học văn phòng', status: 'Có mặt' }] },
  { id: 'pupil-4', name: 'Nguyễn Gia Bảo', phone: '0900 000 104', course: 'PowerPoint', progress: 100, lastClass: 'Hoàn thành 20/10', status: 'Hoàn thành', enrollmentStatus: 'completed', color: '#E4EBFA', totalSessions: 10, completedSessions: 10, remainingSessions: 0, avgGrade: 8.8, notes: '', attendance: [{ date: '20/10', course: 'PowerPoint', status: 'Hoàn thành' }] },
  { id: 'pupil-5', name: 'Đỗ Thu Hà', phone: '0900 000 105', course: 'Word cơ bản', progress: 25, lastClass: 'Đã dừng học', status: 'Thôi học', enrollmentStatus: 'cancelled', color: '#F1E6E4', totalSessions: 10, completedSessions: 2, remainingSessions: 8, notes: 'Trạng thái enrollment đã kết thúc.' },
];
