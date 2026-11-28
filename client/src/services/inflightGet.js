/**
 * Gộp các GET giống nhau đang chạy cùng lúc.
 * Không giữ kết quả sau khi request kết thúc — dữ liệu realtime không bị cache.
 * Mỗi caller nhận một Response riêng để đọc body độc lập.
 */

const inflight = new Map();

export async function snapshotResponse(res) {
  const body = await res.arrayBuffer();
  const status = res.status;
  const statusText = res.statusText;
  const headers = new Headers(res.headers);
  return {
    toResponse() {
      return new Response(body.slice(0), {
        status,
        statusText,
        headers: new Headers(headers),
      });
    },
  };
}

export async function shareInflight(key, loader) {
  const existing = inflight.get(key);
  if (existing) {
    const snapshot = await existing;
    return snapshot.toResponse();
  }

  const pending = Promise.resolve()
    .then(loader)
    .then((res) => snapshotResponse(res));
  inflight.set(key, pending);
  try {
    const snapshot = await pending;
    return snapshot.toResponse();
  } finally {
    if (inflight.get(key) === pending) inflight.delete(key);
  }
}

export function inflightSize() {
  return inflight.size;
}
