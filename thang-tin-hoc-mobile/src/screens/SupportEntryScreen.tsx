import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Headphones, MessageCircle } from 'lucide-react-native';
import { AppScreen, Card, PrimaryButton } from '../components/ui';
import { useAuth } from '../app/AuthContext';
import { colors, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import { openAiSupportConversation } from '../services/aiSupportApi';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function SupportEntryScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const [opening, setOpening] = useState(false);

  const openSupport = async () => {
    if (!user || opening) return;
    setOpening(true);
    try {
      const support = await openAiSupportConversation();
      navigation.navigate('Conversation', {
        conversationId: support.conversationId,
        conversationName: 'Trợ lý Thắng Tin Học',
        participantId: 'ai_support',
        participantRole: 'system',
        participantOnline: true,
        supportStatus: support.status,
      });
    } catch (error) {
      Alert.alert(
        'Không thể mở hỗ trợ',
        error instanceof Error ? error.message : 'Vui lòng thử lại.',
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <AppScreen>
      <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
        <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: colors.brandSoft }}>
          <Headphones size={27} color={colors.brand} />
        </View>
        <Text style={{ color: colors.ink, fontSize: typography.heading, fontWeight: '800', textAlign: 'center' }}>
          Hỗ trợ Thắng Tin Học
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.small, lineHeight: 21, textAlign: 'center' }}>
          Hỏi trợ lý AI về tin học và LMS, hoặc chuyển cuộc trò chuyện cho nhân viên hỗ trợ.
        </Text>
        <PrimaryButton
          title={opening ? 'Đang kết nối…' : 'Trò chuyện với hỗ trợ'}
          onPress={() => { void openSupport(); }}
          disabled={opening || !user}
          loading={opening}
        />
      </Card>
    </AppScreen>
  );
}
