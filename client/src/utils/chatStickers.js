export const CHAT_STICKERS = [
  { id: 'hello', name: 'Xin chào', category: 'greeting', src: '/stickers/hello.svg?v=3' },
  { id: 'thanks', name: 'Cảm ơn nhé', category: 'emotion', src: '/stickers/thanks.svg?v=3' },
  { id: 'love', name: 'Yêu thương', category: 'emotion', src: '/stickers/love.svg?v=3' },
  { id: 'ok', name: 'OK luôn', category: 'work', src: '/stickers/ok.svg?v=3' },
  { id: 'sad', name: 'Buồn quá', category: 'emotion', src: '/stickers/sad.svg' },
  { id: 'cheer', name: 'Tuyệt vời', category: 'emotion', src: '/stickers/cheer.svg?v=3' },
  { id: 'cute', name: 'Dễ thương', category: 'emotion', src: '/stickers/cute.svg' },
  { id: 'haha', name: 'Haha', category: 'emotion', src: '/stickers/haha.svg' },
  { id: 'thinking', name: 'Đang nghĩ', category: 'work', src: '/stickers/thinking.svg' },
  { id: 'congrats', name: 'Chúc mừng', category: 'thang-tin-hoc', src: '/stickers/congrats.svg' },
  { id: 'like', name: 'Thích quá', category: 'emotion', src: '/stickers/like.svg' },
  { id: 'thank-you', name: 'Cảm ơn', category: 'emotion', src: '/stickers/thanks.svg?v=3' },
];

const LEGACY_CHAT_STICKERS = [
  { id: 'sorry', name: 'Xin lỗi nha', category: 'emotion', src: '/stickers/sorry.svg?v=3' },
  { id: 'wave', name: 'Chào bạn', category: 'greeting', src: '/stickers/wave.svg?v=3' },
  { id: 'celebrate', name: 'Tuyệt vời!', category: 'emotion', src: '/stickers/celebrate.svg?v=3' },
];

const stickerById = new Map(
  [...CHAT_STICKERS, ...LEGACY_CHAT_STICKERS].map((sticker) => [sticker.id, sticker]),
);
const STICKER_TOKEN_RE = /^⟦sticker:([a-z-]+)⟧$/;

export function getChatStickerById(id) {
  return stickerById.get(String(id || '')) || null;
}

export function buildChatStickerToken(id) {
  return stickerById.has(id) ? `⟦sticker:${id}⟧` : '';
}

export function getChatStickerFromToken(value) {
  const match = String(value || '').match(STICKER_TOKEN_RE);
  return match ? stickerById.get(match[1]) || null : null;
}

export function getChatStickerFromMessage(message) {
  if (message?.payload?.type === 'sticker') {
    const sticker = getChatStickerById(message.payload.sticker_id);
    if (sticker) return sticker;
  }
  return getChatStickerFromToken(message?.content);
}

export function stickerLabelFromToken(value) {
  return getChatStickerFromToken(value)?.name || '';
}
