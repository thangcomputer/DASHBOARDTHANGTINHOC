import stickerCatalog from '../../../shared/messaging/chatStickers.json';
import { matchesChatStickerSearch } from './chatStickerSearch';

export const CHAT_STICKERS = stickerCatalog.filter((sticker) => sticker.visible !== false);
export const ALL_CHAT_STICKERS = stickerCatalog;
export { matchesChatStickerSearch };

const stickerById = new Map(ALL_CHAT_STICKERS.map((sticker) => [sticker.id, sticker]));
const STICKER_TOKEN_RE = /^⟦sticker:([a-z0-9-]+)⟧$/;

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
