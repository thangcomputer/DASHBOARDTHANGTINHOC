export type ApiRequestOptions = {
  method?: 'GET' | 'PUT';
  body?: unknown;
};

export type ApiRequest = <T>(path: string, options?: ApiRequestOptions) => Promise<T>;

export type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  put: <T>(path: string, body: unknown) => Promise<T>;
};

export function createApiClient(authenticatedRequest: ApiRequest): ApiClient {
  return {
    get: <T,>(path: string) => authenticatedRequest<T>(path),
    put: <T,>(path: string, body: unknown) => authenticatedRequest<T>(path, { method: 'PUT', body }),
  };
}
