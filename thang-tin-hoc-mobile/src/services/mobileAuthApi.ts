type ApiErrorBody = {
  code?: string;
  message?: string;
  success?: boolean;
};

export class MobileAuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'MobileAuthApiError';
  }
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  csrf?: boolean;
};

export class MobileAuthApi {
  private csrfToken: string | null = null;
  private readonly baseUrl: string;

  constructor(
    baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || '',
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new MobileAuthApiError('Chưa cấu hình địa chỉ API cho Mobile Auth.', 0, 'API_BASE_URL_MISSING');
    }

    const method = options.method || 'GET';
    const requiresCsrf = options.csrf ?? (method !== 'GET');
    let csrf = requiresCsrf ? await this.getCsrfToken() : null;
    let response = await this.send(path, method, options, csrf);
    let payload = await this.readPayload(response);
    const firstErrorBody = payload as ApiErrorBody | null;

    if (
      response.status === 403
      && firstErrorBody?.code === 'CSRF_INVALID'
      && requiresCsrf
    ) {
      this.csrfToken = null;
      csrf = await this.getCsrfToken();
      response = await this.send(path, method, options, csrf);
      payload = await this.readPayload(response);
    }

    if (!response.ok) {
      const body = payload as ApiErrorBody | null;
      throw new MobileAuthApiError(
        body?.message || 'Yêu cầu xác thực không thành công.',
        response.status,
        body?.code,
      );
    }
    return payload as T;
  }

  invalidateCsrfToken() {
    this.csrfToken = null;
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const response = await this.send('/api/auth/csrf-token', 'GET', {}, null);
    const payload = await this.readPayload(response) as { csrfToken?: unknown } | null;
    if (!response.ok || typeof payload?.csrfToken !== 'string' || !payload.csrfToken) {
      const body = payload as ApiErrorBody | null;
      throw new MobileAuthApiError(
        body?.message || 'Không thể lấy mã bảo vệ CSRF.',
        response.status,
        body?.code || 'CSRF_TOKEN_UNAVAILABLE',
      );
    }
    this.csrfToken = payload.csrfToken;
    return this.csrfToken;
  }

  private async send(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    options: ApiRequestOptions,
    csrfToken: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    try {
      return await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers,
        credentials: 'include',
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Lỗi kết nối không xác định.';
      throw new MobileAuthApiError(
        `Không thể kết nối máy chủ xác thực. ${detail}`,
        0,
        'NETWORK_ERROR',
      );
    }
  }

  private async readPayload(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new MobileAuthApiError('Máy chủ trả về phản hồi không hợp lệ.', response.status, 'INVALID_RESPONSE');
    }
  }
}

export const mobileAuthApi = new MobileAuthApi();
