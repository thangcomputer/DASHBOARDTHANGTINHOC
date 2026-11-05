import type { ImageSourcePropType } from 'react-native';
import stickerCatalog from '../../../shared/messaging/chatStickers.json';

export type ChatSticker = {
  id: string;
  name: string;
  category: string;
  src: string;
  keywords?: string[];
  visible?: boolean;
};

const catalog = stickerCatalog as ChatSticker[];

const stickerImages: Record<string, ImageSourcePropType> = {
  'xin-chao': require('../../assets/stickers/xin-chao.webp'),
  'chao-ban': require('../../assets/stickers/chao-ban.webp'),
  'da-vang': require('../../assets/stickers/da-vang.webp'),
  'tam-biet': require('../../assets/stickers/tam-biet.webp'),
  'hen-gap-lai': require('../../assets/stickers/hen-gap-lai.webp'),
  'cam-on': require('../../assets/stickers/cam-on.webp'),
  'yeu-qua': require('../../assets/stickers/yeu-qua.webp'),
  'de-thuong': require('../../assets/stickers/de-thuong.webp'),
  'de-thuong-2': require('../../assets/stickers/de-thuong-2.webp'),
  'tuyet-voi': require('../../assets/stickers/tuyet-voi.webp'),
  'cam-on-nhieu': require('../../assets/stickers/cam-on-nhieu.webp'),
  'cam-on-nhieu-2': require('../../assets/stickers/cam-on-nhieu-2.webp'),
  'thich-qua': require('../../assets/stickers/thich-qua.webp'),
  'ok-luon': require('../../assets/stickers/ok-luon.webp'),
  'duoc-a': require('../../assets/stickers/duoc-a.webp'),
  'chuan-roi': require('../../assets/stickers/chuan-roi.webp'),
  '10-diem': require('../../assets/stickers/10-diem.webp'),
  'dong-y': require('../../assets/stickers/dong-y.webp'),
  ok: require('../../assets/stickers/ok.webp'),
  'xin-loi': require('../../assets/stickers/xin-loi.webp'),
  'buon-qua': require('../../assets/stickers/buon-qua.webp'),
  'kho-qua': require('../../assets/stickers/kho-qua.webp'),
  'cuu-em': require('../../assets/stickers/cuu-em.webp'),
  'met-qua': require('../../assets/stickers/met-qua.webp'),
  'de-minh-xem': require('../../assets/stickers/de-minh-xem.webp'),
  'co-y-nay': require('../../assets/stickers/co-y-nay.webp'),
  'a-hieu-roi': require('../../assets/stickers/a-hieu-roi.webp'),
  haha: require('../../assets/stickers/haha.webp'),
  'qua-dinh': require('../../assets/stickers/qua-dinh.webp'),
  'ngau-qua': require('../../assets/stickers/ngau-qua.webp'),
  'vui-ve-nha': require('../../assets/stickers/vui-ve-nha.webp'),
  'dang-hoc': require('../../assets/stickers/dang-hoc.webp'),
  'lam-bai-nhe': require('../../assets/stickers/lam-bai-nhe.webp'),
  'co-len': require('../../assets/stickers/co-len.webp'),
  'hieu-roi': require('../../assets/stickers/hieu-roi.webp'),
  'lam-duoc-roi': require('../../assets/stickers/lam-duoc-roi.webp'),
  'co-gang-len': require('../../assets/stickers/co-gang-len.webp'),
  'thay-kiem-tra-nhe': require('../../assets/stickers/thay-kiem-tra-nhe.webp'),
  'lam-lai-nhe': require('../../assets/stickers/lam-lai-nhe.webp'),
  'chinh-xac': require('../../assets/stickers/chinh-xac.webp'),
  'sai-roi': require('../../assets/stickers/sai-roi.webp'),
  'thay-ho-tro-nhe': require('../../assets/stickers/thay-ho-tro-nhe.webp'),
  'sinh-nhat-vui-ve': require('../../assets/stickers/sinh-nhat-vui-ve.webp'),
  'viet-nam-vo-dich': require('../../assets/stickers/viet-nam-vo-dich.webp'),
  'chuc-tet': require('../../assets/stickers/chuc-tet.webp'),
  '8-3-vui-ve': require('../../assets/stickers/8-3-vui-ve.webp'),
  '20-11-tri-an': require('../../assets/stickers/20-11-tri-an.webp'),
  'chuc-mung': require('../../assets/stickers/chuc-mung.webp'),
  'nghi-chut-nhe': require('../../assets/stickers/nghi-chut-nhe.webp'),
  'hen-lich-nhe': require('../../assets/stickers/hen-lich-nhe.webp'),
  'da-nhan': require('../../assets/stickers/da-nhan.webp'),
  'goi-ngay': require('../../assets/stickers/goi-ngay.webp'),
  'dang-thuc-hien': require('../../assets/stickers/dang-thuc-hien.webp'),
  'hoan-thanh': require('../../assets/stickers/hoan-thanh.webp'),
  'tam-nghi': require('../../assets/stickers/tam-nghi.webp'),
};

export const CHAT_STICKERS = catalog.filter((sticker) => sticker.visible !== false);

export const STICKER_CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'greetings', label: 'Chào hỏi' },
  { id: 'thanks', label: 'Cảm ơn' },
  { id: 'confirm', label: 'Xác nhận' },
  { id: 'emotions', label: 'Cảm xúc' },
  { id: 'study', label: 'Học tập' },
  { id: 'teacher', label: 'Giáo viên' },
  { id: 'celebration', label: 'Chúc mừng' },
  { id: 'work', label: 'Công việc' },
] as const;

const stickersById = new Map(CHAT_STICKERS.map((sticker) => [sticker.id, sticker]));
const stickerTokenPattern = /^⟦sticker:([a-z0-9-]+)⟧$/;

export function getChatStickerById(id: string) {
  return stickersById.get(id);
}

export function getChatStickerImage(id: string) {
  return stickerImages[id];
}

export function getChatStickerIdFromToken(value: string) {
  const match = value.match(stickerTokenPattern);
  return match && stickersById.has(match[1]) ? match[1] : undefined;
}

export function buildChatStickerToken(id: string) {
  return stickersById.has(id) ? `⟦sticker:${id}⟧` : '';
}

export function matchesChatStickerSearch(sticker: ChatSticker, query: string) {
  const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) return true;
  return normalize([sticker.name, sticker.id, sticker.category, ...(sticker.keywords || [])].join(' '))
    .includes(normalizedQuery);
}
