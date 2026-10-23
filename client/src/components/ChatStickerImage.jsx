import React, { useState } from 'react';

export default function ChatStickerImage({
  sticker,
  className = '',
  decorative = false,
  allowFallback = false,
  onMissing,
}) {
  const [failedSrc, setFailedSrc] = useState('');
  const src = failedSrc === sticker.src && allowFallback ? sticker.fallbackSrc : sticker.src;

  if (failedSrc === 'failed') return null;

  return (
    <img
      src={src}
      alt={decorative ? '' : sticker.name}
      loading="lazy"
      draggable={false}
      className={className}
      onError={(event) => {
        if (allowFallback && sticker.fallbackSrc && event.currentTarget.getAttribute('src') === sticker.src) {
          setFailedSrc(sticker.src);
          return;
        }
        setFailedSrc('failed');
        onMissing?.(sticker.src);
      }}
    />
  );
}
