import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Platform } from 'react-native';

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  shareToNotes: (experiences: any[]) => void;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  toggleFavorite: () => {},
  isFavorite: () => false,
  shareToNotes: () => {},
});

const STORAGE_KEY = 'wandering_yacht_favorites';

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load favorites', e);
    }
  };

  const saveFavorites = async (newFavorites: string[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
    } catch (e) {
      console.error('Failed to save favorites', e);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      saveFavorites(updated);
      return updated;
    });
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const shareToNotes = async (experiences: any[]) => {
    const favoriteExperiences = experiences.filter((exp) => favorites.includes(exp.id));
    if (favoriteExperiences.length === 0) return;

    let text = '⚓ WANDERING YACHT\nFAVORITE EXPERIENCES TO BOOK\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    favoriteExperiences.forEach((exp, index) => {
      const price = exp.ticket_types?.[0]?.price || 0;
      text += `${index + 1}. ${exp.title}\n`;
      text += `   📍 ${exp.location}\n`;
      text += `   💰 From €${price}\n`;
      if (exp.duration_hours > 0) {
        text += `   ⏱ ${exp.duration_hours >= 24 ? Math.round(exp.duration_hours / 24) + ' days' : exp.duration_hours + 'h'}\n`;
      }
      text += '\n';
    });

    text += '━━━━━━━━━━━━━━━━━━━━━━━━\n';
    text += 'www.wanderingyacht.com\n';
    text += 'WhatsApp: +382 69 333 693\n';

    try {
      await Share.share({
        message: text,
        title: 'WANDERING YACHT - Favorite Experiences',
      });
    } catch (e) {
      console.error('Share failed', e);
    }
  };

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite, shareToNotes }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
