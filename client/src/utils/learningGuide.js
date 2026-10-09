export const DEFAULT_LEARNING_GUIDE_HTML = `
  <h2>Bắt đầu học</h2>
  <ol>
    <li><strong>Chọn khóa học phù hợp:</strong> Xem các môn, số bài học và học phí trên thẻ khóa. Dùng bộ lọc để tìm khóa trọn gói, khóa lẻ hoặc các môn bạn đã đăng ký.</li>
    <li><strong>Xem nội dung khóa:</strong> Chọn <em>Xem thêm</em> để xem các môn và nội dung có trong khóa trước khi đăng ký.</li>
    <li><strong>Đăng ký và mở khóa học:</strong> Chọn <em>Đăng ký học</em> ở khóa mong muốn và hoàn tất thanh toán. Khóa đã có quyền học sẽ xuất hiện trong phần khóa đã đăng ký.</li>
  </ol>
  <h2>Cách học từng buổi</h2>
  <ol>
    <li>Chọn <em>Môn đã đăng ký</em> hoặc mở khóa đã đăng ký, sau đó chọn môn muốn học.</li>
    <li>Chọn buổi đang mở trong danh sách. Các buổi được mở theo lộ trình; hãy hoàn thành buổi trước để mở buổi tiếp theo.</li>
    <li>Học lần lượt video, nội dung bài học và phần thực hành trong buổi. Với video, cần xem ít nhất 70% thời lượng và không tua để hệ thống ghi nhận hoàn thành.</li>
    <li>Sau khi hoàn thành các nội dung yêu cầu, kiểm tra trạng thái buổi học trong danh sách rồi tiếp tục buổi kế tiếp.</li>
  </ol>
  <h2>Mẹo học hiệu quả</h2>
  <ul>
    <li>Chuẩn bị máy tính và mở phần mềm cần thiết để thực hành song song với bài học.</li>
    <li>Tạm dừng video khi cần ghi chú hoặc làm theo hướng dẫn; không tua nếu muốn hệ thống ghi nhận thời lượng xem.</li>
    <li>Nếu nội dung chưa mở, kiểm tra quyền đăng ký khóa học và trạng thái hoàn thành của buổi trước.</li>
  </ul>
`;

export function getLearningGuideVideoEmbedUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let url;
  try {
    url = new URL(raw);
  } catch {
    return '';
  }

  if (url.protocol !== 'https:') return '';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    videoId = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || '';
  } else if (host === 'vimeo.com') {
    videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    if (!/^\d+$/.test(videoId)) return '';
    return `https://player.vimeo.com/video/${videoId}`;
  } else if (host === 'player.vimeo.com') {
    videoId = url.pathname.match(/^\/video\/(\d+)/)?.[1] || '';
    if (!videoId) return '';
    return `https://player.vimeo.com/video/${videoId}`;
  }

  if (!/^[\w-]{6,}$/.test(videoId)) return '';
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
