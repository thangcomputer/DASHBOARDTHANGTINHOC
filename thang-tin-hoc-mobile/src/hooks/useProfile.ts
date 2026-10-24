import { useCallback, useEffect, useMemo, useState } from 'react';
import { isMobileAuthPocEnabled, useAuth } from '../app/AuthContext';
import { isMobileProfileApiEnabled } from '../services/mobileProfileConfig';
import { createApiClient } from '../services/apiClient';
import { profileService } from '../services/profileService';
import type { ProfileUpdate, ProfileViewModel } from '../services/profileTypes';
import { MobileAuthApiError } from '../services/mobileAuthApi';

function messageFor(error: unknown): string {
  const status = error instanceof MobileAuthApiError ? error.status : 0;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền xem hoặc sửa hồ sơ này.';
  if (status === 404) return 'Không tìm thấy hồ sơ tài khoản.';
  if (status >= 500) return 'Máy chủ hồ sơ đang gặp sự cố. Vui lòng thử lại.';
  if (error instanceof Error && error.message) return error.message;
  return 'Không thể kết nối để tải hồ sơ. Vui lòng thử lại.';
}

export function useProfile() {
  const { user, apiRequest } = useAuth();
  const client = useMemo(() => createApiClient(apiRequest), [apiRequest]);
  const [profile, setProfile] = useState<ProfileViewModel | null>(null);
  const [loading, setLoading] = useState(isMobileProfileApiEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isMobileProfileApiEnabled || !user || (user.role !== 'student' && user.role !== 'teacher')) {
      setProfile(null);
      setLoading(false);
      return;
    }
    if (!isMobileAuthPocEnabled) {
      setProfile(null);
      setError('Hồ sơ API yêu cầu bật Mobile Auth thật; không có dữ liệu demo thay thế.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await profileService.getProfile(client, user.role, user.id);
      setProfile(result);
    } catch (loadError) {
      setError(messageFor(loadError));
    } finally {
      setLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(async (payload: ProfileUpdate) => {
    if (!isMobileProfileApiEnabled || !isMobileAuthPocEnabled || !user || (user.role !== 'student' && user.role !== 'teacher')) {
      throw new Error('Không thể cập nhật hồ sơ khi chưa đăng nhập bằng Mobile Auth.');
    }
    setSaving(true);
    setError('');
    try {
      let result: ProfileViewModel;
      if (user.role === 'student') {
        if ('bio' in payload) throw new Error('Dữ liệu cập nhật không thuộc hồ sơ học viên.');
        result = await profileService.updateProfile(client, 'student', user.id, payload);
      } else {
        if (!('bio' in payload)) throw new Error('Dữ liệu cập nhật không thuộc hồ sơ giáo viên.');
        result = await profileService.updateProfile(client, 'teacher', user.id, payload);
      }
      setProfile(result);
      return result;
    } catch (updateError) {
      const message = messageFor(updateError);
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, [client, user]);

  return { profile, loading, saving, error, refresh: load, update };
}
