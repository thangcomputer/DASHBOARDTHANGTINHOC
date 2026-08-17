import React from 'react';

/** Deep-link token embedded in chat text: ⟦chat:student:ID|Display Name⟧ */
export const CHAT_DEEP_LINK_RE = /⟦chat:(student|teacher|admin|staff):([^|⟧]+)\|([^⟧]+)⟧/g;
const URL_RE = /(https?:\/\/[^\s<]+[^.,;:!?\s<])/gi;

export function buildChatDeepLinkToken({ role = 'student', id, name } = {}) {
  const rid = String(id || '').trim();
  if (!rid) return String(name || 'Học viên');
  const safeName = String(name || 'Học viên').replace(/[|⟦⟧]/g, ' ').trim() || 'Học viên';
  const safeRole = ['student', 'teacher', 'admin', 'staff'].includes(role) ? role : 'student';
  return `⟦chat:${safeRole}:${rid}|${safeName}⟧`;
}

function openChatFromToken(person) {
  window.dispatchEvent(new CustomEvent('cms:open-chat', { detail: person }));
}

function linkClass(mine) {
  return mine
    ? 'cms-fm-link is-mine underline font-bold'
    : 'cms-fm-link underline font-bold text-blue-700 hover:text-blue-900';
}

/**
 * Render message text with http(s) links + chat deep-link tokens (open FloatingMessenger).
 */
export function MessageRichText({ text, mine = false }) {
  const raw = String(text || '');
  if (!raw) return null;

  const segments = [];
  const chatRe = new RegExp(CHAT_DEEP_LINK_RE.source, 'g');
  let last = 0;
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = chatRe.exec(raw)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: raw.slice(last, match.index) });
    }
    segments.push({
      type: 'chat',
      role: match[1],
      id: match[2],
      name: match[3],
      key: `chat-${match.index}`,
    });
    last = match.index + match[0].length;
  }
  if (last < raw.length) segments.push({ type: 'text', value: raw.slice(last) });

  const nodes = [];
  segments.forEach((seg, segIdx) => {
    if (seg.type === 'chat') {
      nodes.push(
        <button
          key={seg.key}
          type="button"
          className={`${linkClass(mine)} bg-transparent border-0 p-0 cursor-pointer inline`}
          title={`Nhắn tin với ${seg.name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openChatFromToken({
              id: String(seg.id),
              name: seg.name,
              role: seg.role,
            });
          }}
        >
          {seg.name}
        </button>,
      );
      return;
    }

    const chunk = seg.value;
    let tLast = 0;
    let tMatch;
    const urlRe = new RegExp(URL_RE.source, 'gi');
    // eslint-disable-next-line no-cond-assign
    while ((tMatch = urlRe.exec(chunk)) !== null) {
      if (tMatch.index > tLast) {
        nodes.push(chunk.slice(tLast, tMatch.index));
      }
      const url = tMatch[0];
      nodes.push(
        <a
          key={`url-${segIdx}-${tMatch.index}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className={mine ? 'cms-fm-link is-mine' : 'cms-fm-link'}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>,
      );
      tLast = tMatch.index + url.length;
    }
    if (tLast < chunk.length) nodes.push(chunk.slice(tLast));
  });

  return <>{nodes.length ? nodes : raw}</>;
}
