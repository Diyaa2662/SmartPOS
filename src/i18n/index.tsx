// src/i18n/index.tsx
// SmartPOS - Localization provider and hook

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nManager } from 'react-native';
import { getAllSettings, saveAllSettings } from '../database/settingsDAO';
import { translations, Language } from './translations';
import { AppSettings } from '../types';

export interface TranslationContextValue {
  language: Language;
  isRTL: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const DEFAULT_LANGUAGE: Language = 'en';

export const TranslationContext = createContext<TranslationContextValue>({
  language: DEFAULT_LANGUAGE,
  isRTL: false,
  setLanguage: async () => {},
  t: key => translations.en[key] ?? key,
});

const interpolate = (
  template: string,
  params?: Record<string, string | number>,
): string => {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) =>
      text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
};

export const TranslationProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const isRTL = language === 'ar';

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const settings: AppSettings = await getAllSettings();
        const savedLanguage = (settings as any).language as
          | Language
          | undefined;
        if (savedLanguage === 'ar' || savedLanguage === 'en') {
          setLanguageState(savedLanguage);
        }
      } catch (e) {
        console.error('Failed to load language setting:', e);
      }
    };
    loadLanguage();
  }, []);

  useEffect(() => {
    if (I18nManager.isRTL !== isRTL) {
      try {
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(isRTL);
      } catch (e) {
        console.warn('Unable to change RTL mode at runtime:', e);
      }
    }
  }, [isRTL]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await saveAllSettings({ language: lang } as unknown as AppSettings);
    } catch (e) {
      console.error('Failed to save language setting:', e);
    }
  };

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) => {
      const template =
        translations[language][key] ?? translations.en[key] ?? key;
      return interpolate(template, params);
    },
    [language],
  );

  return (
    <TranslationContext.Provider value={{ language, isRTL, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = (): TranslationContextValue =>
  useContext(TranslationContext);
