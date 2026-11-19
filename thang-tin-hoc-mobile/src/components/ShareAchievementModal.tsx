import React, { useCallback, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share as NativeShare,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Award, Check, Clock, Copy, ExternalLink, Flame, Share, Sparkles, Star, Target, Trophy, X, Zap,
} from 'lucide-react-native';
import { buildPlatformShareUrls } from '../../../shared/dailyPractice/shareAchievement.mjs';
import { translateText } from '../../../shared/i18n/translate.mjs';
import { useLanguage } from '../i18n/LanguageContext';
import { Mascot, type MascotMood } from './dailyPractice/Mascot';

export type ShareStatItem = {
  key: string;
  icon: string;
  color: string;
  bg: string;
  value: string;
  label: string;
};

export type ShareAchievementData = {
  topPrompt: string;
  eyebrow: string;
  heroLabel: string;
  headline: string;
  mood?: string;
  stats: ShareStatItem[];
  footerNote: string;
  shareTitle: string;
  shareText: string;
  shareUrl: string;
};

function renderStatIcon(icon: string, color: string) {
  switch (icon) {
    case 'trophy':
      return <Trophy size={17} color={color} strokeWidth={2.4} />;
    case 'flame':
      return <Flame size={17} color={color} strokeWidth={2.4} />;
    case 'zap':
      return <Zap size={17} color={color} strokeWidth={2.4} />;
    case 'clock':
      return <Clock size={17} color={color} strokeWidth={2.4} />;
    case 'check':
      return <Check size={17} color={color} strokeWidth={2.6} />;
    case 'target':
      return <Target size={17} color={color} strokeWidth={2.4} />;
    case 'star':
      return <Star size={17} color={color} strokeWidth={2.4} />;
    default:
      return <Award size={17} color={color} strokeWidth={2.4} />;
  }
}

/**
 * Nút chuẩn có chữ SHARE để gắn đồng nhất trên các màn hoàn thành Mobile.
 */
export function ShareTriggerButton({
  onPress,
  label = 'SHARE',
  size = 'md',
  variant = 'sky',
  style,
}: {
  onPress: () => void;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'sky' | 'white';
  style?: object;
}) {
  const isSm = size === 'sm';
  const isWhite = variant === 'white';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.triggerBase,
        isSm ? styles.triggerSm : styles.triggerMd,
        isWhite ? styles.triggerWhite : styles.triggerSky,
        pressed && styles.triggerPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Chia sẻ thành tích lên nền tảng khác"
    >
      <Share size={isSm ? 13 : 15} color="#0369A1" strokeWidth={2.6} />
      <Text style={[styles.triggerText, isSm && styles.triggerTextSm]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Màn hình thẻ chia sẻ thành tích kiểu Duolingo trên Mobile App & Expo Web.
 */
export function ShareAchievementModal({
  visible,
  onClose,
  data,
  inlineOverlay = false,
}: {
  visible: boolean;
  onClose: () => void;
  data: ShareAchievementData | null;
  /** Đặt true khi mở bên trong một Modal sẵn có để tránh lỗi chồng Modal trên iOS. */
  inlineOverlay?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  const translatedShareTitle = language === 'en' && data?.shareTitle ? translateText(data.shareTitle, 'en') : data?.shareTitle;
  const translatedShareText = language === 'en' && data?.shareText ? translateText(data.shareText, 'en') : data?.shareText;
  const translatedHeadline = language === 'en' && data?.headline ? translateText(data.headline, 'en') : data?.headline;

  const urls = buildPlatformShareUrls({
    title: translatedShareTitle,
    text: translatedShareText,
    url: data?.shareUrl,
  });

  const copyCaption = useCallback(async (noticeText = 'Đã sao chép nội dung để dán lên nền tảng khác!') => {
    const text = translatedShareText || translatedHeadline || '';
    try {
      if (Platform.OS === 'web' && typeof globalThis.navigator !== 'undefined' && globalThis.navigator.clipboard) {
        await globalThis.navigator.clipboard.writeText(text);
        setCopied(true);
        setStatusNotice(noticeText);
        setTimeout(() => setCopied(false), 2400);
        return true;
      }
    } catch {
      /* fallback below */
    }
    if (Platform.OS !== 'web') {
      try {
        await NativeShare.share({ title: translatedShareTitle, message: text });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, [translatedHeadline, translatedShareText, translatedShareTitle]);

  const handlePrimaryShare = async () => {
    if (!data) return;
    setStatusNotice('');
    if (Platform.OS !== 'web') {
      try {
        await NativeShare.share({
          title: translatedShareTitle,
          message: translatedShareText || '',
        });
      } catch {
        /* dismissed */
      }
      return;
    }

    const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({
          title: translatedShareTitle,
          text: translatedShareText,
          url: data.shareUrl,
        });
        setStatusNotice('Đã mở hộp thoại chia sẻ!');
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }

    await copyCaption('Đã chép nội dung thành tích — dán để đăng lên Zalo / Facebook nhé!');
  };

  const handleOpenPlatform = async (platform: 'facebook' | 'zalo' | 'telegram') => {
    const targetUrl = platform === 'facebook'
      ? urls.facebook
      : platform === 'telegram'
        ? urls.telegram
        : urls.zaloWeb;
    if (Platform.OS !== 'web') {
      try {
        await NativeShare.share({ title: translatedShareTitle, message: translatedShareText || '' });
        return;
      } catch {
        /* fallback open url */
      }
    } else {
      await copyCaption(
        platform === 'zalo'
          ? 'Đã chép nội dung thành tích — dán vào Zalo để chia sẻ nhé!'
          : 'Đã chép nội dung & mở trang chia sẻ!',
      );
    }
    void Linking.openURL(targetUrl).catch(() => undefined);
  };

  if (!visible || !data) return null;

  const content = (
    <View
      style={[
        styles.backdrop,
        { paddingTop: Math.max(insets.top + 8, 16), paddingBottom: Math.max(insets.bottom + 12, 16) },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Đóng cửa sổ chia sẻ"
          >
            <X size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          <Text style={styles.topPrompt}>{data.topPrompt}</Text>

          <View style={styles.card}>
            <View style={styles.cardGlowTop} pointerEvents="none" />
            <View style={styles.cardHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandDot}>
                  <Sparkles size={13} color="#FFFFFF" strokeWidth={2.5} />
                </View>
                <Text style={styles.brandText}>DewSkill</Text>
              </View>
              <Text style={styles.eyebrowText}>{data.eyebrow}</Text>
            </View>

            <View style={styles.heroWrap}>
              <Mascot mood={(data.mood as MascotMood) || 'graduate'} size={86} />
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{data.heroLabel}</Text>
              </View>
            </View>

            <Text style={styles.headline}>{data.headline}</Text>

            <View style={styles.statsGrid}>
              {(data.stats || []).map((item) => (
                <View key={item.key} style={styles.statTile}>
                  <View style={[styles.statIconBox, { backgroundColor: item.bg }]}>
                    {renderStatIcon(item.icon, item.color)}
                  </View>
                  <View style={styles.statTextWrap}>
                    <Text style={styles.statVal}>
                      {item.value}
                    </Text>
                    <Text style={styles.statLbl}>
                      {item.label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.footerNote}>{data.footerNote}</Text>

          <Pressable
            onPress={() => { void handlePrimaryShare(); }}
            style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="SHARE thành tích"
          >
            <Share size={18} color="#0EA5E9" strokeWidth={2.6} />
            <Text style={styles.shareBtnText}>SHARE</Text>
          </Pressable>

          <View style={styles.platformRow}>
            <Pressable onPress={() => { void handleOpenPlatform('facebook'); }} style={styles.platformPill} accessibilityRole="button">
              <ExternalLink size={12} color="#FFFFFF" />
              <Text style={styles.platformPillText}>Facebook</Text>
            </Pressable>
            <Pressable onPress={() => { void handleOpenPlatform('zalo'); }} style={styles.platformPill} accessibilityRole="button">
              <ExternalLink size={12} color="#FFFFFF" />
              <Text style={styles.platformPillText}>Zalo</Text>
            </Pressable>
            <Pressable onPress={() => { void handleOpenPlatform('telegram'); }} style={styles.platformPill} accessibilityRole="button">
              <ExternalLink size={12} color="#FFFFFF" />
              <Text style={styles.platformPillText}>Telegram</Text>
            </Pressable>
            {Platform.OS === 'web' ? (
              <Pressable onPress={() => { void copyCaption(); }} style={styles.platformPill} accessibilityRole="button">
                {copied ? <Check size={12} color="#86EFAC" /> : <Copy size={12} color="#FFFFFF" />}
                <Text style={styles.platformPillText}>{copied ? 'Đã chép' : 'Sao chép'}</Text>
              </Pressable>
            ) : null}
          </View>

          {statusNotice ? (
            <View style={styles.noticePill}>
              <Text style={styles.noticeText}>{statusNotice}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );

  if (inlineOverlay) {
    return <View style={styles.inlineOverlayRoot}>{content}</View>;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineOverlayRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    elevation: 50,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#0A3977',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topPrompt: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 25,
    paddingHorizontal: 38,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 16,
    paddingBottom: 18,
    backgroundColor: '#BFE8FE',
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#020C22',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  cardGlowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: '#66C4FB',
    opacity: 0.9,
  },
  cardHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandDot: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  eyebrowText: {
    flex: 1,
    textAlign: 'right',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 4,
    zIndex: 2,
  },
  heroPill: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFDF4',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroPillText: {
    color: '#1E3A8A',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  headline: {
    marginTop: 10,
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 4,
    zIndex: 2,
  },
  statsGrid: {
    marginTop: 12,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 2,
  },
  statTile: {
    width: '48.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(14, 165, 233, 0.16)',
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  statVal: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '900',
    lineHeight: 19,
  },
  statLbl: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 1,
  },
  footerNote: {
    color: 'rgba(186, 230, 253, 0.9)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  shareBtn: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 4,
    borderBottomColor: '#BAE6FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  shareBtnText: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  platformPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  platformPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  noticePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
  },
  noticeText: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  triggerBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderBottomWidth: 3,
  },
  triggerSm: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 5,
  },
  triggerMd: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 7,
  },
  triggerSky: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderBottomColor: '#7DD3FC',
  },
  triggerWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BAE6FD',
    borderBottomColor: '#7DD3FC',
  },
  triggerPressed: {
    transform: [{ translateY: 1 }],
    borderBottomWidth: 1,
  },
  triggerText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  triggerTextSm: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
});
