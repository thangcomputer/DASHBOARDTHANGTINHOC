import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X } from 'lucide-react-native';
import { mobileApiRequest, resolveMobilePublicUrl } from '../services/apiClient';
import { DuoButton } from './duo/DuoButton';
import { colors, spacing, typography } from '../theme/tokens';

const STORAGE_PREFIX = 'cms_popup_seen_';

export type PopupData = {
  isActive: boolean;
  targetRole: string;
  title?: string;
  content?: string;
  imageUrl?: string;
};

export function MobilePopupBanner({ role = 'student' }: { role?: string }) {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `${STORAGE_PREFIX}${role}_${today}`;

    AsyncStorage.getItem(storageKey).then((seen) => {
      if (seen || cancelled) return;

      mobileApiRequest<{ success: boolean; data?: PopupData }>('/settings/popup')
        .then((res) => {
          if (cancelled || !res?.success || !res.data) return;
          const { isActive, targetRole, title, content, imageUrl } = res.data;
          if (!isActive) return;
          if (targetRole !== 'all' && targetRole !== role) return;
          if (!title && !content && !imageUrl) return;

          setPopup(res.data);
          setVisible(true);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [role]);

  const handleClose = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = `${STORAGE_PREFIX}${role}_${today}`;
    try {
      await AsyncStorage.setItem(storageKey, '1');
    } catch {}
    setVisible(false);
  };

  if (!visible || !popup) return null;

  const imageUri = popup.imageUrl ? resolveMobilePublicUrl(popup.imageUrl) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10} accessibilityLabel="Đóng thông báo">
            <X size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : null}

          {popup.title || popup.content ? (
            <ScrollView style={styles.contentWrap} contentContainerStyle={styles.contentContainer}>
              {popup.title ? <Text style={styles.title}>{popup.title}</Text> : null}
              {popup.content ? <Text style={styles.content}>{popup.content}</Text> : null}
            </ScrollView>
          ) : null}

          <View style={styles.actionWrap}>
            <DuoButton variant="primary" size="lg" fullWidth text="Đã hiểu, đóng thông báo ✓" onPress={handleClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    zIndex: 9200,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bannerImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#0F172A',
  },
  contentWrap: {
    maxHeight: 220,
  },
  contentContainer: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 24,
  },
  content: {
    fontSize: typography.small,
    color: '#475569',
    lineHeight: 20,
  },
  actionWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
});
