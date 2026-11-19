import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RawText } from '../i18n/reactNativeTranslated';
import { useLanguage } from '../i18n/LanguageContext';

interface LanguageSwitcherProps {
  variant?: 'pill' | 'card';
  theme?: 'light' | 'dark';
}

export default function LanguageSwitcher({
  variant = 'pill',
  theme = 'light',
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  if (variant === 'card') {
    const options: Array<{ code: 'vi' | 'en'; flag: string; label: string; sub: string }> = [
      { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt', sub: language === 'en' ? 'Default' : 'Mặc định' },
      { code: 'en', flag: '🇺🇸', label: 'English', sub: 'International' },
    ];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <RawText style={styles.cardTitle}>
            {language === 'en' ? '🌐 LANGUAGE' : '🌐 NGÔN NGỮ'}
          </RawText>
          <View style={styles.cardBadge}>
            <RawText style={styles.cardBadgeText}>
              {language === 'en' ? 'English' : 'Tiếng Việt'}
            </RawText>
          </View>
        </View>

        <View style={styles.cardRow}>
          {options.map((opt) => {
            const active = language === opt.code;
            return (
              <Pressable
                key={opt.code}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setLanguage(opt.code)}
                style={[styles.cardOption, active && styles.cardOptionActive]}
              >
                <RawText style={styles.flag}>{opt.flag}</RawText>
                <View style={styles.optionTextWrap}>
                  <RawText style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {opt.label}
                  </RawText>
                  <RawText style={styles.optionSub}>{opt.sub}</RawText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  const isDark = theme === 'dark';

  return (
    <View style={[styles.pillWrap, isDark ? styles.pillWrapDark : styles.pillWrapLight]}>
      {(['vi', 'en'] as const).map((code) => {
        const active = language === code;
        const label = code === 'vi' ? 'VI' : 'EN';
        return (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityLabel={code === 'vi' ? 'Tiếng Việt' : 'English'}
            accessibilityState={{ selected: active }}
            onPress={() => setLanguage(code)}
            style={[styles.pillBtn, active && styles.pillBtnActive]}
          >
            <RawText
              style={[
                styles.pillText,
                isDark ? styles.pillTextDark : styles.pillTextLight,
                active && styles.pillTextActive,
              ]}
            >
              {label}
            </RawText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  pillWrapLight: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  pillWrapDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  pillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillBtnActive: {
    backgroundColor: '#059669',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pillTextLight: {
    color: '#475569',
  },
  pillTextDark: {
    color: '#E2E8F0',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  cardBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardOptionActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  flag: {
    fontSize: 20,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  optionLabelActive: {
    color: '#065F46',
  },
  optionSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
