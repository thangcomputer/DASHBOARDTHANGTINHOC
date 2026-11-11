import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { Card, SectionHeading } from './ui';
import { colors, spacing, typography, theme } from '../theme/tokens';
import {
  getCommunicationPreferences,
  updateCommunicationPreferences,
  type CommunicationPreferences,
} from '../services/communicationPreferencesApi';

const callPreference = {
  key: 'rejectCalls',
  title: 'Từ chối cuộc gọi',
  description: 'Khi bật, học viên và giảng viên khác không thể gọi cho bạn.',
} as const;
const messagePreferenceByRole = {
  student: {
    key: 'rejectMessagesFromTeachers',
    title: 'Từ chối tin nhắn từ giảng viên',
    description: 'Người gửi sẽ được báo rằng bạn từ chối tin nhắn.',
  },
  teacher: {
    key: 'rejectMessagesFromStudents',
    title: 'Từ chối tin nhắn từ học viên',
    description: 'Người gửi sẽ được báo rằng bạn từ chối tin nhắn.',
  },
} as const;

const defaultPreferences: CommunicationPreferences = {
  rejectCalls: false,
  rejectMessagesFromStudents: false,
  rejectMessagesFromTeachers: false,
};

export function CommunicationPreferencesCard({ role }: { role: 'student' | 'teacher' }) {
  const preferenceRows = [callPreference, messagePreferenceByRole[role]];
  const [preferences, setPreferences] = useState<CommunicationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof CommunicationPreferences | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCommunicationPreferences()
      .then((value) => {
        if (active) setPreferences(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải tùy chọn liên lạc.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const togglePreference = async (key: keyof CommunicationPreferences, value: boolean) => {
    setSavingKey(key);
    setError('');
    try {
      setPreferences(await updateCommunicationPreferences({ [key]: value }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu tùy chọn liên lạc.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <SectionHeading title="Quyền riêng tư liên lạc" />
      {loading ? <ActivityIndicator color={theme.brand} /> : null}
      {preferenceRows.map((row) => (
        <View
          key={row.key}
          style={{
            minHeight: 60,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: '#F1F5F9',
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: '#1E293B', fontSize: typography.small, fontWeight: '700' }}>{row.title}</Text>
            <Text style={{ color: '#64748B', fontSize: typography.micro }}>{row.description}</Text>
          </View>
          <Switch
            value={preferences[row.key]}
            onValueChange={(value) => { void togglePreference(row.key, value); }}
            disabled={savingKey !== null || loading}
            trackColor={{ false: '#CBD5E1', true: theme.brand }}
            accessibilityLabel={row.title}
          />
        </View>
      ))}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.red, fontSize: typography.micro }}>{error}</Text> : null}
    </Card>
  );
}
