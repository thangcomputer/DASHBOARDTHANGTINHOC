function normalizeStickerSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function matchesChatStickerSearch(sticker, query) {
  const normalizedQuery = normalizeStickerSearchText(query.trim());
  if (!normalizedQuery) return true;

  const searchableText = normalizeStickerSearchText([
    sticker.name,
    sticker.id,
    sticker.category,
    ...(sticker.keywords || []),
  ].join(' '));
  return searchableText.includes(normalizedQuery);
}
