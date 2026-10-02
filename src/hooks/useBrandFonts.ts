import { useEffect } from 'react';
import { FontDisplay, useFonts } from 'expo-font';
import { fonts } from '../theme/fonts';

const brandFonts = {
  [fonts.regular]: {
    uri: require('../../assets/fonts/TraditionalArabic-Regular.ttf'),
    display: FontDisplay.SWAP,
  },
};

/** Native builds embed this face; Expo Go and web load the same local asset. */
export function useBrandFonts() {
  const [, error] = useFonts(brandFonts);

  useEffect(() => {
    if (error) {
      console.warn('Traditional Arabic could not load; continuing with fallback text.', error);
    }
  }, [error]);
  // Deliberately expose no readiness gate: fonts must never hold navigation/splash.
}