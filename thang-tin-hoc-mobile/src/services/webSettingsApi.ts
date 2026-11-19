import { Platform } from 'react-native';
import { getMobileApiBaseUrl, mobileApiRequest } from './apiClient';
import { coalesceCached, peekCached } from '../utils/requestCache';

const WEB_SETTINGS_CACHE_KEY = 'settings:web';
const WEB_SETTINGS_TTL_MS = 5 * 60 * 1000;

type WebSettings = {
  data?: {
    logoUrl?: string;
    studentBanners?: unknown;
    teacherBanners?: unknown;
    studentBannerSpeed?: number;
    teacherBannerSpeed?: number;
  };
};

async function fetchWebSettingsCached() {
  return coalesceCached(
    WEB_SETTINGS_CACHE_KEY,
    WEB_SETTINGS_TTL_MS,
    () => mobileApiRequest<WebSettings>('/settings/web', {}, false),
  );
}

function resolveWebLogoFromResponse(response: WebSettings | undefined): string {
  const logoUrl = response?.data?.logoUrl?.trim();
  if (!logoUrl) {
    const configuredWebBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').trim().replace(/\/+$/, '');
    const webBaseUrl = configuredWebBaseUrl || (__DEV__ && Platform.OS === 'web' ? 'http://localhost:5173' : '');
    return webBaseUrl ? `${webBaseUrl}/logo-thang-tin-hoc.svg` : '';
  }
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;

  return new URL(logoUrl, `${getMobileApiBaseUrl()}/`).toString();
}

export type DashboardBanner = {
  imageUrl: string;
  linkUrl: string;
};

export async function getDashboardBanners(role: 'student' | 'teacher') {
  const response = await fetchWebSettingsCached();
  const data = response.data || {};
  const key = role === 'teacher' ? 'teacherBanners' : 'studentBanners';
  const rawBanners = data[key];
  if (rawBanners == null) {
    return {
      banners: [] as DashboardBanner[],
      speedSeconds: 5,
    };
  }
  if (!Array.isArray(rawBanners)) {
    throw new Error('Danh sách banner trang tổng quan không hợp lệ.');
  }
  const banners = rawBanners.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Dữ liệu banner trang tổng quan không hợp lệ.');
    }
    const banner = entry as Record<string, unknown>;
    const imagePath = typeof banner.imageUrl === 'string' ? banner.imageUrl.trim() : '';
    if (!imagePath) throw new Error('Banner trang tổng quan thiếu hình ảnh.');
    return {
      imageUrl: resolveWebAssetUrl(imagePath),
      linkUrl: typeof banner.linkUrl === 'string' ? banner.linkUrl.trim() : '',
    };
  });
  const rawSpeed = role === 'teacher' ? data.teacherBannerSpeed : data.studentBannerSpeed;
  const speedSeconds = Number.isFinite(Number(rawSpeed)) && Number(rawSpeed) > 0
    ? Number(rawSpeed)
    : 5;
  return { banners, speedSeconds };
}

function resolveWebAssetUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, `${getMobileApiBaseUrl()}/`).toString();
}

export function peekCachedWebLogoUrl(): string {
  const cached = peekCached<WebSettings>(WEB_SETTINGS_CACHE_KEY);
  return cached ? resolveWebLogoFromResponse(cached) : '';
}

export async function getWebLogoUrl(): Promise<string> {
  const response = await fetchWebSettingsCached();
  return resolveWebLogoFromResponse(response);
}
