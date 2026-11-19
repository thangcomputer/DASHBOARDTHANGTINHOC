import React, { useSyncExternalStore } from 'react';
import * as RN from 'react-native';
import type {
  AlertButton,
  AlertOptions,
  ButtonProps,
  RefreshControlProps,
  ShareContent,
  ShareOptions,
  TextInputProps,
  TextProps,
} from 'react-native';
import {
  translateInterpolatedParts,
  translateText,
} from '../../../shared/i18n/translate.mjs';
import { getCurrentLanguage, subscribeLanguage, type AppLanguage } from './LanguageContext';
import { dispatchAppAlert } from './appAlertBus';

export * from 'react-native';

function useAppLanguage(): AppLanguage {
  return useSyncExternalStore(subscribeLanguage, getCurrentLanguage, getCurrentLanguage);
}

function flattenChildren(node: React.ReactNode, out: React.ReactNode[] = []): React.ReactNode[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      flattenChildren(item, out);
    }
  } else if (node !== null && node !== undefined && typeof node !== 'boolean') {
    out.push(node);
  }
  return out;
}

function translateChildren(children: React.ReactNode, lang: AppLanguage): React.ReactNode {
  if (lang !== 'en' || children === null || children === undefined || typeof children === 'boolean') {
    return children;
  }
  if (typeof children === 'string') {
    return translateText(children, lang);
  }
  if (typeof children === 'number') {
    return children;
  }
  if (Array.isArray(children)) {
    const flat = flattenChildren(children);
    const translated = translateInterpolatedParts(flat, lang);
    return translated.map((part) => (typeof part === 'string' ? translateText(part, lang) : part)) as React.ReactNode[];
  }
  return children;
}

export const RawText = RN.Text;
export const RawTextInput = RN.TextInput;
export const RawAlert = RN.Alert;

type TextInstance = React.ComponentRef<typeof RN.Text>;
type TextInputInstance = React.ComponentRef<typeof RN.TextInput>;

export const Text = React.forwardRef<TextInstance, TextProps>(function TranslatedText(
  { children, accessibilityLabel, accessibilityHint, ...rest },
  ref
) {
  const lang = useAppLanguage();
  const nextChildren = translateChildren(children, lang);
  const nextA11yLabel =
    lang === 'en' && typeof accessibilityLabel === 'string'
      ? translateText(accessibilityLabel, lang)
      : accessibilityLabel;
  const nextA11yHint =
    lang === 'en' && typeof accessibilityHint === 'string'
      ? translateText(accessibilityHint, lang)
      : accessibilityHint;

  return React.createElement(
    RN.Text,
    {
      ...rest,
      ref,
      accessibilityLabel: nextA11yLabel,
      accessibilityHint: nextA11yHint,
    },
    nextChildren
  );
});

export const TextInput = React.forwardRef<TextInputInstance, TextInputProps>(
  function TranslatedTextInput(
    { placeholder, accessibilityLabel, accessibilityHint, ...rest },
    ref
  ) {
    const lang = useAppLanguage();
    const nextPlaceholder =
      lang === 'en' && typeof placeholder === 'string'
        ? translateText(placeholder, lang)
        : placeholder;
    const nextA11yLabel =
      lang === 'en' && typeof accessibilityLabel === 'string'
        ? translateText(accessibilityLabel, lang)
        : accessibilityLabel;
    const nextA11yHint =
      lang === 'en' && typeof accessibilityHint === 'string'
        ? translateText(accessibilityHint, lang)
        : accessibilityHint;

    return React.createElement(RN.TextInput, {
      ...rest,
      ref,
      placeholder: nextPlaceholder,
      accessibilityLabel: nextA11yLabel,
      accessibilityHint: nextA11yHint,
    });
  }
);

const AnimatedTranslatedText = RN.Animated.createAnimatedComponent(Text);

export const Animated = {
  ...RN.Animated,
  Text: AnimatedTranslatedText,
};

export const Alert = {
  ...RN.Alert,
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    const lang = getCurrentLanguage();
    const nextTitle = lang === 'en' && typeof title === 'string' ? translateText(title, lang) : title;
    const nextMessage = lang === 'en' && typeof message === 'string' ? translateText(message, lang) : message;
    const nextButtons = lang === 'en' && Array.isArray(buttons)
      ? buttons.map((btn) =>
          btn && typeof btn.text === 'string'
            ? { ...btn, text: translateText(btn.text, lang) }
            : btn
        )
      : buttons;
    if (dispatchAppAlert({ title: nextTitle, message: nextMessage, buttons: nextButtons, options })) {
      return;
    }
    return RN.Alert.alert(nextTitle, nextMessage, nextButtons, options);
  },
};

export const Share = {
  ...RN.Share,
  share(content: ShareContent, options?: ShareOptions) {
    const lang = getCurrentLanguage();
    if (lang !== 'en' || !content) {
      return RN.Share.share(content, options);
    }
    const nextContent: ShareContent = {
      ...content,
      ...(typeof content.title === 'string' ? { title: translateText(content.title, lang) } : {}),
      ...('message' in content && typeof content.message === 'string'
        ? { message: translateText(content.message, lang) }
        : {}),
    };
    const nextOptions = options && typeof options.dialogTitle === 'string'
      ? { ...options, dialogTitle: translateText(options.dialogTitle, lang) }
      : options;
    return RN.Share.share(nextContent, nextOptions);
  },
};

export function Button({ title, accessibilityLabel, ...rest }: ButtonProps) {
  const lang = useAppLanguage();
  const nextTitle = lang === 'en' && typeof title === 'string' ? translateText(title, lang) : title;
  const nextA11y = lang === 'en' && typeof accessibilityLabel === 'string'
    ? translateText(accessibilityLabel, lang)
    : accessibilityLabel;
  return React.createElement(RN.Button, {
    ...rest,
    title: nextTitle,
    accessibilityLabel: nextA11y,
  });
}

export function RefreshControl({ title, ...rest }: RefreshControlProps) {
  const lang = useAppLanguage();
  const nextTitle = lang === 'en' && typeof title === 'string' ? translateText(title, lang) : title;
  return React.createElement(RN.RefreshControl, {
    ...rest,
    title: nextTitle,
  });
}
