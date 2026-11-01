import { Platform } from 'react-native';
import { getMobileApiBaseUrl, mobileApiRequest } from './apiClient';

type WebSettings = {
  data?: {
    logoUrl?: string;
  };
};

export async function getWebLogoUrl(): Promise<string> {
  const response = await mobileApiRequest<WebSettings>('/settings/web', {}, false);
  const logoUrl = response.data?.logoUrl?.trim();
  if (!logoUrl) {
    const configuredWebBaseUrl = String(process.env.EXPO_PUBLIC_WEB_BASE_URL || '').trim().replace(/\/+$/, '');
    const webBaseUrl = configuredWebBaseUrl || (__DEV__ && Platform.OS === 'web' ? 'http://localhost:5173' : '');
    return webBaseUrl ? `${webBaseUrl}/logo-thang-tin-hoc.svg` : '';
  }
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;

  return new URL(logoUrl, `${getMobileApiBaseUrl()}/`).toString();
}
