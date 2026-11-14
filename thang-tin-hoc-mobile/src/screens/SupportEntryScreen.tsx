import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bot, ChevronRight, Headphones, Users, X } from 'lucide-react-native';
import { AppScreen, Card } from '../components/ui';
import { DuoButton } from '../components/duo/DuoButton';
import { useAuth } from '../app/AuthContext';
import { colors, spacing, typography, theme } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import { openAiSupportConversation } from '../services/aiSupportApi';
import { messageService } from '../services/mockService';
import type { Conversation } from '../types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function SupportEntryScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const [choiceVisible, setChoiceVisible] = useState(false);
  const [opening, setOpening] = useState<'ai' | 'staff' | null>(null);
  const [choiceError, setChoiceError] = useState('');

  const openAiSupport = async () => {
    if (!user || opening) return;
    setOpening('ai');
    setChoiceError('');
    try {
      const support = await openAiSupportConversation();
      setChoiceVisible(false);
      navigation.navigate('Conversation', {
        conversationId: support.conversationId,
        conversationName: 'Trợ lý AI',
        participantId: 'ai_support',
        participantRole: 'system',
        participantOnline: true,
        supportStatus: support.status,
      });
    } catch (error) {
      setChoiceError(error instanceof Error ? error.message : 'Không thể mở hỗ trợ. Vui lòng thử lại.');
    } finally {
      setOpening(null);
    }
  };

  const loadSupportContacts = async () => {
    if (!user || opening) return;
    setOpening('staff');
    setChoiceError('');
    try {
      const contacts = await messageService.conversations(user.role, user);
      const supportContacts = contacts.filter((contact) => (
        contact.category === 'support'
        || String(contact.adminRole || '').toUpperCase() === 'SUPPORT'
      )).sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)));
      const contact = supportContacts[0];
      if (!contact) {
        setChoiceError('Hiện chưa có nhân viên hỗ trợ trong danh bạ.');
        return;
      }
      openStaffConversation(contact);
    } catch (error) {
      setChoiceError(error instanceof Error ? error.message : 'Không thể tải danh sách hỗ trợ. Vui lòng thử lại.');
    } finally {
      setOpening(null);
    }
  };

  const openStaffConversation = (contact: Conversation) => {
    if (!contact.participantId) {
      setChoiceError('Tài khoản hỗ trợ chưa có thông tin nhận cuộc trò chuyện.');
      return;
    }
    setChoiceVisible(false);
    navigation.navigate('Conversation', {
      conversationId: contact.id,
      conversationName: contact.name,
      participantId: contact.participantId,
      participantRole: contact.participantRole || 'staff',
      participantAdminRole: contact.adminRole,
      participantOnline: Boolean(contact.online),
      ...(contact.avatarUri ? { participantAvatarUri: contact.avatarUri } : {}),
    });
  };

  return (
    <AppScreen>
      <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
        <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: theme.brandSoft }}>
          <Headphones size={27} color={theme.brand} />
        </View>
        <Text style={{ color: colors.ink, fontSize: typography.heading, fontWeight: '800', textAlign: 'center' }}>
          Hỗ trợ Thắng Tin Học
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.small, lineHeight: 21, textAlign: 'center' }}>
          Hỏi trợ lý AI về tin học và LMS, hoặc trò chuyện trực tiếp với nhân viên hỗ trợ.
        </Text>
        <DuoButton
          variant="primary"
          size="sm"
          style={{ alignSelf: 'center', paddingHorizontal: 22 }}
          text="Trò chuyện với hỗ trợ"
          onPress={() => {
            setChoiceError('');
            setChoiceVisible(true);
          }}
          disabled={!user}
        />
      </Card>
      <Modal
        visible={choiceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setChoiceVisible(false);
          setChoiceError('');
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!opening) setChoiceVisible(false);
            }}
            accessibilityLabel="Đóng lựa chọn hỗ trợ"
          />
          <View style={styles.choiceCard} accessibilityRole="summary">
            <View style={styles.choiceHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>
                  Bạn muốn trò chuyện với ai?
                </Text>
                <Text style={styles.choiceSubtitle}>
                  Chọn kênh hỗ trợ phù hợp.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!opening) {
                    setChoiceVisible(false);
                  }
                }}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Đóng lựa chọn hỗ trợ"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            {choiceError ? <Text style={styles.choiceError} accessibilityRole="alert">{choiceError}</Text> : null}

            <View style={{ gap: spacing.sm }}>
              <Pressable
                onPress={() => { void openAiSupport(); }}
                disabled={Boolean(opening)}
                style={({ pressed }) => [styles.choiceRow, pressed && styles.choiceRowPressed, opening && styles.choiceRowDisabled]}
                accessibilityRole="button"
              >
                <View style={styles.choiceIcon}><Bot size={21} color={theme.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceRowTitle}>Trợ lý AI Thắng Tin Học</Text>
                  <Text style={styles.choiceRowDescription}>Hỏi về tin học, Office, MOS và LMS.</Text>
                </View>
                {opening === 'ai'
                  ? <ActivityIndicator color={theme.brand} />
                  : <ChevronRight size={18} color={colors.muted} />}
              </Pressable>
              <Pressable
                onPress={() => { void loadSupportContacts(); }}
                disabled={Boolean(opening)}
                style={({ pressed }) => [styles.choiceRow, pressed && styles.choiceRowPressed, opening && styles.choiceRowDisabled]}
                accessibilityRole="button"
              >
                <View style={styles.choiceIcon}><Users size={21} color={theme.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceRowTitle}>Nhân viên hỗ trợ trực tiếp</Text>
                  <Text style={styles.choiceRowDescription}>Trò chuyện trực tiếp với chuyên viên hỗ trợ.</Text>
                </View>
                {opening === 'staff'
                  ? <ActivityIndicator color={theme.brand} />
                  : <ChevronRight size={18} color={colors.muted} />}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = {
  modalRoot: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
  },
  modalBackdrop: {
    ...({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const),
    backgroundColor: colors.overlay,
  },
  choiceCard: {
    width: '100%' as const,
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  choiceHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
  },
  choiceTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' as const },
  choiceSubtitle: { marginTop: spacing.xs, color: colors.muted, fontSize: typography.caption, lineHeight: 20 },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  choiceError: {
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    color: '#059669',
    fontSize: typography.caption,
    lineHeight: 19,
    fontWeight: '700' as const,
  },
  choiceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: 74,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  choiceRowPressed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  choiceRowDisabled: { opacity: 0.6 },
  choiceIcon: {
    width: 46,
    height: 46,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
  },
  choiceRowTitle: { color: '#0F172A', fontSize: 15, fontWeight: '800' as const },
  choiceRowDescription: { marginTop: 3, color: '#64748B', fontSize: 13, lineHeight: 18 },
};
