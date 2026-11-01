import { mobileApiRequest } from './apiClient';

export type CommunicationPreferences = {
  rejectCalls: boolean;
  rejectMessagesFromStudents: boolean;
  rejectMessagesFromTeachers: boolean;
};

export async function getCommunicationPreferences() {
  const response = await mobileApiRequest<{ data?: CommunicationPreferences }>('/communication-preferences');
  if (!response.data || typeof response.data.rejectCalls !== 'boolean'
      || typeof response.data.rejectMessagesFromStudents !== 'boolean'
      || typeof response.data.rejectMessagesFromTeachers !== 'boolean') {
    throw new Error('Dữ liệu tùy chọn liên lạc không hợp lệ.');
  }
  return response.data;
}

export async function updateCommunicationPreferences(updates: Partial<CommunicationPreferences>) {
  const response = await mobileApiRequest<{ data?: CommunicationPreferences }>('/communication-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.data || typeof response.data.rejectCalls !== 'boolean'
      || typeof response.data.rejectMessagesFromStudents !== 'boolean'
      || typeof response.data.rejectMessagesFromTeachers !== 'boolean') {
    throw new Error('Phản hồi lưu tùy chọn liên lạc không hợp lệ.');
  }
  return response.data;
}
