/** Nhận diện nguồn video bài giảng — cùng quy tắc với web (client/src/utils/youtubeDuration.js). */
export function youtubeIdFromUrl(url: string) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return parsed.pathname.replace(/^\//, '').slice(0, 11);
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v) return v.slice(0, 11);
      return parsed.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] || '';
    }
    return '';
  } catch {
    return raw.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([\w-]{11})/)?.[1] || '';
  }
}

export function vimeoIdFromUrl(url: string) {
  return String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] || '';
}

export function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|m4v|mov)(?:$|[?#])/i.test(String(url || ''));
}

/** Link chuẩn để trình phát dùng; '' nếu không phát được ngay trong ứng dụng. */
export function playableVideoUrl(url: string) {
  const youtubeId = youtubeIdFromUrl(url);
  if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`;
  if (vimeoIdFromUrl(url) || isDirectVideoUrl(url)) return String(url).trim();
  return '';
}
