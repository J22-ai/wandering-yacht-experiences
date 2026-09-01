import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations, { Language, LANGUAGES } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

const LANG_KEY = 'wandering_yacht_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>('en');

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLanguage();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANG_KEY);
      if (saved && translations[saved as Language]) {
        setLang(saved as Language);
      }
    } catch (e) {
      console.error('Failed to load language', e);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLang(lang);
    try {
      await AsyncStorage.setItem(LANG_KEY, lang);
    } catch (e) {
      console.error('Failed to save language', e);
    }
  };

  const t = (key: string): string => {
    const strings = translations[language] || translations.en;
    return (strings as any)[key] || (translations.en as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
