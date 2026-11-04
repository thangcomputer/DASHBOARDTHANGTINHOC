import { mobileApiRequest } from './apiClient';

export type CallHistoryEntry = {
  callId: string;
  conversationId: string;
  direction: 'incoming' | 'outgoing';
  participantId: string;
  participantRole: 'student' | 'teacher';
  participantName: string;
  status: 'ringing' | 'active' | 'missed' | 'rejected' | 'completed' | 'busy' | 'cancelled' | 'failed';
  startedAt: string;
  durationSeconds: number;
  reason: string;
};

export async function getCallHistory(conversationId?: string) {
  const query = new URLSearchParams({ limit: '100' });
  if (conversationId) query.set('conversationId', conversationId);
  const response = await mobileApiRequest<{ data?: CallHistoryEntry[] }>(`/calls/history?${query.toString()}`);
  if (!Array.isArray(response.data)) throw new Error('Dữ liệu lịch sử cuộc gọi không hợp lệ.');
  return response.data;
}
