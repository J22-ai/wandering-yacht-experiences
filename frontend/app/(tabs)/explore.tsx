import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Experience {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
  image_url: string;
  capacity: number;
  available_spots: number;
  duration_hours: number;
  ticket_types: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [filteredExperiences, setFilteredExperiences] = useState<Experience[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.category as string || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Update selected category when navigating from Home with a category param
  useEffect(() => {
    if (params.category) {
      setSelectedCategory(params.category as string);
    }
  }, [params.category]);

  useEffect(() => {
    if (token) {
      api.setToken(token);
    }
    loadData();
  }, [token]);

  useEffect(() => {
    filterExperiences();
  }, [experiences, selectedCategory, searchQuery]);

  const loadData = async () => {
    try {
      const [categoriesData, experiencesData] = await Promise.all([
        api.getCategories(),
        api.getExperiences(),
      ]);
      setCategories([{ id: 'all', name: 'All', slug: 'all' }, ...categoriesData]);
      setExperiences(experiencesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const filterExperiences = () => {
    let filtered = experiences;

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter((exp) => exp.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          exp.title.toLowerCase().includes(query) ||
          exp.location.toLowerCase().includes(query) ||
          exp.description.toLowerCase().includes(query)
      );
    }

    setFilteredExperiences(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getLowestPrice = (experience: Experience) => {
    if (!experience.ticket_types || experience.ticket_types.length === 0) return 0;
    return Math.min(...experience.ticket_types.map((t) => t.price));
  };

  const formatDuration = (hours: number) => {
    if (hours === 0) return '';
    if (hours >= 24) return `${Math.round(hours / 24)} days`;
    return `${hours}h`;
  };

  // Get the display name for the selected category
  const getSelectedCategoryName = () => {
    if (!selectedCategory) return 'All Experiences';
    const cat = categories.find(c => c.slug === selectedCategory);
    return cat ? cat.name : 'All Experiences';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {selectedCategory ? (
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#1a3a4a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{getSelectedCategoryName()}</Text>
          </View>
        ) : (
          <Text style={styles.headerTitle}>All Experiences</Text>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3a3" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search experiences..."
          placeholderTextColor="#9ca3a3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3a3" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Filters - only show when no category is pre-selected */}
      {!selectedCategory && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                (!selectedCategory && category.slug === 'all') && styles.categoryChipActive,
              ]}
              onPress={() =>
                setSelectedCategory(category.slug === 'all' ? null : category.slug)
              }
            >
              <Text
                style={[
                  styles.categoryChipText,
                  (!selectedCategory && category.slug === 'all') && styles.categoryChipTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a3a4a"
          />
        }
      >
        <Text style={styles.resultsCount}>
          {filteredExperiences.length} experience{filteredExperiences.length !== 1 ? 's' : ''} found
        </Text>

        {filteredExperiences.map((experience) => (
          <TouchableOpacity
            key={experience.id}
            style={styles.experienceCard}
            onPress={() => router.push(`/experience/${experience.id}`)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: experience.image_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800' }}
              style={styles.experienceImage}
            />
            <View style={styles.experienceContent}>
              <Text style={styles.experienceTitle} numberOfLines={2}>{experience.title}</Text>
              <View style={styles.experienceMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={14} color="#7a8a8a" />
                  <Text style={styles.metaText}>{experience.location}</Text>
                </View>
                {experience.duration_hours > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color="#7a8a8a" />
                    <Text style={styles.metaText}>{formatDuration(experience.duration_hours)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.experienceDescription} numberOfLines={2}>
                {experience.description}
              </Text>
              <View style={styles.experienceFooter}>
                <Text style={styles.priceLabel}>from</Text>
                <Text style={styles.experiencePrice}>€{getLowestPrice(experience)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0ede8',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 28,
    fontWeight: '300',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e5e0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  categoryChipActive: {
    backgroundColor: '#1a3a4a',
    borderColor: '#1a3a4a',
  },
  categoryChipText: {
    fontFamily: 'TraditionalArabic',
    color: '#5a6a6a',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsCount: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 14,
    marginBottom: 14,
  },
  experienceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  experienceImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#e8e5e0',
  },
  experienceContent: {
    padding: 18,
  },
  experienceTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 19,
    color: '#1a2a30',
    fontWeight: '600',
    marginBottom: 8,
  },
  experienceMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#7a8a8a',
  },
  experienceDescription: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#5a6a6a',
    lineHeight: 21,
    marginBottom: 14,
  },
  experienceFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  priceLabel: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#7a8a8a',
  },
  experiencePrice: {
    fontFamily: 'TraditionalArabic',
    fontSize: 22,
    color: '#1a2a30',
    fontWeight: '600',
  },
});
