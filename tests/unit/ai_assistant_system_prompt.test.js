'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ASSISTANT_CORE_PROMPT_VI,
  OUT_OF_SCOPE_REPLY_VI,
  IMAGE_GEN_REFUSE_VI,
  buildAssistantSystemPrompt,
} = require('../../services/ai/assistantSystemPrompt');
const {
  classifyItDomainScope,
  buildRagPromptContext,
} = require('../../services/ai/knowledgeSearchService');
const aiSupportService = require('../../services/aiSupportService');

test('assistantSystemPrompt: tích hợp đủ 5 nhóm CNTT, ưu tiên [DỮ LIỆU NỘI BỘ], cấm tạo ảnh & 5 ví dụ mẫu', () => {
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('# VAI TRÒ & BẢN SẮC'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('# PHẠM VI KIẾN THỨC DUY NHẤT'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Tin học văn phòng'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Công nghệ thông tin'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Tin học cho trẻ em / học sinh'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Tin học cho người đi làm'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Tin học cho giảng viên'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('[DỮ LIỆU NỘI BỘ]'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('KHÔNG tạo hình ảnh'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Draw.io'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('PowerPoint'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Bóc tách câu hỏi pha trộn'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('Freeze Panes'));
  assert.ok(ASSISTANT_CORE_PROMPT_VI.includes('DDoS'));

  assert.match(OUT_OF_SCOPE_REPLY_VI, /DewSkill AI/);
  assert.match(OUT_OF_SCOPE_REPLY_VI, /nằm ngoài phạm vi/i);
  assert.match(IMAGE_GEN_REFUSE_VI, /PowerPoint|Draw\.io/);

  const quickPrompt = aiSupportService.buildQuickAskSystemPrompt('student', 'An', 'vi', {
    ragContext: '[DỮ LIỆU NỘI BỘ]\n<knowledge_context>Sample</knowledge_context>',
    ragAttempted: true,
    ragHitsCount: 1,
  });
  assert.ok(quickPrompt.includes('[DỮ LIỆU NỘI BỘ]'));
  assert.ok(quickPrompt.includes('# VAI TRÒ & BẢN SẮC'));

  const supportPrompt = aiSupportService.buildSupportSystemPrompt('student', 'Minh', { ongoing: true, lang: 'vi' });
  assert.ok(supportPrompt.includes('[GỢI Ý:'));
  assert.ok(supportPrompt.includes('KHÔNG chào lại') || supportPrompt.includes('Không chào lại'));

  const lessonPrompt = buildAssistantSystemPrompt({
    channel: 'lesson',
    lang: 'vi',
    lessonContext: { courseTitle: 'Excel Thực chiến', unitTitle: 'Chặng 1', lessonTitle: 'Hàm SUMIFS' },
  });
  assert.ok(lessonPrompt.includes('Hàm SUMIFS'));
  assert.ok(lessonPrompt.includes('[DỮ LIỆU NỘI BỘ — NGỮ CẢNH BÀI HỌC HIỆN TẠI]'));

  const ragBlock = buildRagPromptContext([
    {
      docTitle: 'Giáo trình Excel Cơ bản',
      sourceOrigin: 'internal_thangtinhoc',
      officeVersion: '365',
      location: { sectionTitle: 'Hàm XLOOKUP' },
      text: 'Cú pháp hàm =XLOOKUP(lookup_value, lookup_array, return_array)',
      score: 18.5,
    },
  ], 'vi');
  assert.ok(ragBlock.startsWith('[DỮ LIỆU NỘI BỘ]'));
  assert.ok(ragBlock.includes('<knowledge_context role="reference_data_only">'));
});

test('classifyItDomainScope: giữ mạch ngữ cảnh, hỗ trợ trẻ em/giảng viên và bóc tách câu pha trộn', () => {
  const excelHistory = [
    { role: 'user', text: 'Làm sao để cố định dòng tiêu đề trong Excel khi cuộn trang?' },
    { role: 'assistant', text: 'Bạn vào thẻ View > Freeze Panes > Freeze Top Row.' },
  ];

  for (const followUp of [
    'Thế muốn bỏ nó đi thì sao?',
    'Cách này lỗi rồi',
    'Giải thích lại bước 2',
    'Còn phím tắt nào nhanh hơn không?',
  ]) {
    const res = classifyItDomainScope(followUp, excelHistory);
    assert.equal(res.decision, 'IN_SCOPE', `Follow-up "${followUp}" phải giữ IN_SCOPE`);
  }

  // Câu pha trộn (vẫn chứa IT framing -> để LLM áp dụng cấu trúc từ chối 2 vế)
  const mixed = classifyItDomainScope(
    'Giúp tôi viết một bức thư tình thật cảm động gửi người yêu bằng Word, tiện thể chỉ tôi cách căn lề chuẩn luôn.',
  );
  assert.equal(mixed.decision, 'IN_SCOPE');

  // Trẻ em / giảng viên / công cụ vẽ
  assert.equal(classifyItDomainScope('Cách làm trò chơi kéo thả bằng Scratch cho học sinh tiểu học').decision, 'IN_SCOPE');
  assert.equal(classifyItDomainScope('Hướng dẫn tự vẽ sơ đồ mạng LAN bằng Draw.io').decision, 'IN_SCOPE');

  // Thuần ngoài phạm vi / tiêu cực
  const negative = classifyItDomainScope('Hôm nay chán quá, chửi thằng bạn cùng lớp giúp tôi với, chỉ tôi cách tán gái đi.');
  assert.equal(negative.decision, 'OUT_OF_SCOPE');
});
