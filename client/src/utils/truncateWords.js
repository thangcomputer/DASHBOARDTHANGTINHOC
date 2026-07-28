/**
 * Rut gon nhan tab: toi da `maxWords` tu, phan con lai thanh …
 * Vi du: "Ngan hang cau hoi" → "Ngan hang…"
 */
export function truncateWords(label, maxWords = 2) {
  const words = String(label || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}
