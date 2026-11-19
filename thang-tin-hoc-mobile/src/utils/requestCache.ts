type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const values = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
let globalGeneration = 0;
const keyGenerations = new Map<string, number>();

function generationFor(key: string) {
  return keyGenerations.get(key) ?? 0;
}

/** Đọc đồng bộ giá trị cache còn hạn (tránh gọi API thừa khi chuyển tab/mở menu). */
export function peekCached<T>(key: string): T | undefined {
  const entry = values.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    values.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  if (ttlMs <= 0) return;
  values.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Gộp các request giống nhau đang chạy đồng thời và cache ngắn theo TTL. */
export async function coalesceCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (ttlMs > 0) {
    const cached = peekCached<T>(key);
    if (cached !== undefined) return cached;
  }
  const active = inFlight.get(key);
  if (active) return active as Promise<T>;

  const startGlobalGen = globalGeneration;
  const startKeyGen = generationFor(key);

  const pending = loader()
    .then((result) => {
      if (
        ttlMs > 0
        && globalGeneration === startGlobalGen
        && generationFor(key) === startKeyGen
      ) {
        values.set(key, { value: result, expiresAt: Date.now() + ttlMs });
      }
      return result;
    })
    .finally(() => {
      if (inFlight.get(key) === pending) {
        inFlight.delete(key);
      }
    });

  inFlight.set(key, pending);
  return pending;
}

/** Xóa cache khớp chính xác key hoặc bắt đầu bằng prefix. */
export function invalidateCache(prefixOrKey: string): void {
  for (const key of Array.from(values.keys())) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      values.delete(key);
      keyGenerations.set(key, generationFor(key) + 1);
    }
  }
  for (const key of Array.from(inFlight.keys())) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      inFlight.delete(key);
      keyGenerations.set(key, generationFor(key) + 1);
    }
  }
  keyGenerations.set(prefixOrKey, generationFor(prefixOrKey) + 1);
}

export function clearAllRequestCaches(): void {
  globalGeneration += 1;
  values.clear();
  inFlight.clear();
  keyGenerations.clear();
}
