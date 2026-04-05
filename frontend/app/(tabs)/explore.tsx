import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

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
  tags: string[];
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.category as string || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef<any>(null);

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

  const loadData = async () => {
    try {
      const [categoriesData, experiencesData] = await Promise.all([
        api.getCategories(),
        api.getExperiences(),
      ]);
      setCategories(categoriesData.filter((c: Category) => c.slug !== 'all'));
      setExperiences(experiencesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
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

  // Filter experiences based on search and category
  const getFilteredExperiences = () => {
    let filtered = experiences;
    if (selectedCategory) {
      filtered = filtered.filter(exp => exp.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          exp.title.toLowerCase().includes(query) ||
          exp.location.toLowerCase().includes(query) ||
          exp.description.toLowerCase().includes(query) ||
          (exp.tags && exp.tags.some((tag: string) => tag.toLowerCase().includes(query)))
      );
    }
    return filtered;
  };

  // Group experiences by category
  const getGroupedExperiences = () => {
    const filtered = getFilteredExperiences();
    const grouped: { [key: string]: Experience[] } = {};
    filtered.forEach((exp) => {
      if (!grouped[exp.category]) {
        grouped[exp.category] = [];
      }
      grouped[exp.category].push(exp);
    });
    return grouped;
  };

  const getCategoryName = (slug: string) => {
    const cat = categories.find(c => c.slug === slug);
    return cat ? cat.name : slug.replace(/-/g, ' ').toUpperCase();
  };

  const filteredExperiences = getFilteredExperiences();
  const groupedExperiences = getGroupedExperiences();

  const renderExperienceCard = (experience: Experience) => (
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
        <View style={styles.experienceFooter}>
          <View>
            <Text style={styles.priceLabel}>from</Text>
            <Text style={styles.experiencePrice}>€{getLowestPrice(experience)}</Text>
          </View>
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>View</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {selectedCategory ? (
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={styles.backButton}
              activeOpacity={0.6}
            >
              <Ionicons name="arrow-back" size={22} color="#1a3a4a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{getCategoryName(selectedCategory)}</Text>
          </View>
        ) : (
          <Text style={styles.headerTitle}>WANDER WITH LOVE</Text>
        )}
      </View>

      {/* Search Bar */}
      <TouchableOpacity
        style={styles.searchContainer}
        activeOpacity={1}
        onPress={() => searchInputRef.current?.focus()}
      >
        <Ionicons name="search" size={18} color="#9ca3a3" />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search experiences..."
          placeholderTextColor="#9ca3a3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3a3" />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {/* Category List - only when no category pre-selected */}
      {!selectedCategory && (
        <View style={styles.categoryList}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryRow}
              onPress={() => setSelectedCategory(category.slug)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryRowText}>{category.name}</Text>
              <Ionicons name="chevron-forward" size={18} color="#c17f59" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a3a4a" />
        }
      >
        <Text style={styles.resultsCount}>
          {filteredExperiences.length} experience{filteredExperiences.length !== 1 ? 's' : ''}
        </Text>

        {selectedCategory ? (
          /* Single category view */
          filteredExperiences.map(renderExperienceCard)
        ) : (
          /* Grouped by category */
          Object.keys(groupedExperiences).map((categorySlug) => (
            <View key={categorySlug} style={styles.categorySection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionHeaderText}>{getCategoryName(categorySlug)}</Text>
                <View style={styles.sectionLine} />
              </View>
              {groupedExperiences[categorySlug].map(renderExperienceCard)}
            </View>
          ))
        )}
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
    paddingVertical: 16,
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 26,
    fontWeight: '300',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e5e0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 15,
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ede9e3',
  },
  categoryRowText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#1a3a4a',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsCount: {
    fontFamily: 'TraditionalArabic',
    color: '#9ca3a3',
    fontSize: 13,
    marginBottom: 10,
    marginTop: 4,
  },
  categorySection: {
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 8,
    gap: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d5d0c8',
  },
  sectionHeaderText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#c17f59',
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  experienceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  experienceImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#e8e5e0',
  },
  experienceContent: {
    padding: 16,
  },
  experienceTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    color: '#1a2a30',
    fontWeight: '600',
    marginBottom: 6,
  },
  experienceMeta: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
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
  experienceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0ede8',
    paddingTop: 12,
  },
  priceLabel: {
    fontFamily: 'TraditionalArabic',
    fontSize: 12,
    color: '#9ca3a3',
  },
  experiencePrice: {
    fontFamily: 'TraditionalArabic',
    fontSize: 22,
    color: '#1a2a30',
    fontWeight: '600',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a3a4a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewBtnText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});
