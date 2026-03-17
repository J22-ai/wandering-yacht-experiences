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

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      experiences: 'Wellness',
      boat_rental: 'Adventure',
      yacht_charter: 'Luxury',
      management: 'Service',
    };
    return labels[category] || category;
  };

  const formatDuration = (hours: number) => {
    if (hours === 0) return '';
    if (hours >= 24) return `${Math.round(hours / 24)} days`;
    return `${hours} hours`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Experiences</Text>
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

      {/* Category Filters */}
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
              (selectedCategory === category.slug || (!selectedCategory && category.slug === 'all')) && styles.categoryChipActive,
            ]}
            onPress={() =>
              setSelectedCategory(category.slug === 'all' ? null : category.slug)
            }
          >
            <Text
              style={[
                styles.categoryChipText,
                (selectedCategory === category.slug || (!selectedCategory && category.slug === 'all')) && styles.categoryChipTextActive,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2d5a5a"
          />
        }
      >
        <Text style={styles.resultsCount}>
          {filteredExperiences.length} experiences found
        </Text>

        {filteredExperiences.map((experience) => (
          <TouchableOpacity
            key={experience.id}
            style={styles.experienceCard}
            onPress={() => router.push(`/experience/${experience.id}`)}
          >
            <Image
              source={{ uri: experience.image_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800' }}
              style={styles.experienceImage}
            />
            <View style={styles.experienceContent}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {getCategoryLabel(experience.category).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.experienceTitle} numberOfLines={1}>{experience.title}</Text>
              <View style={styles.experienceMeta}>
                <Text style={styles.experienceLocation}>{experience.location}</Text>
                {experience.duration_hours > 0 && (
                  <Text style={styles.experienceDuration}>
                    {formatDuration(experience.duration_hours)}
                  </Text>
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
    backgroundColor: '#f8f6f3',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#2d3a3a',
    fontSize: 28,
    fontWeight: '300',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
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
    color: '#2d3a3a',
    fontSize: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  categoryChipActive: {
    backgroundColor: '#2d5a5a',
    borderColor: '#2d5a5a',
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
    paddingHorizontal: 20,
  },
  resultsCount: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 14,
    marginBottom: 16,
  },
  experienceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  experienceImage: {
    width: '100%',
    height: 200,
  },
  experienceContent: {
    padding: 20,
  },
  categoryBadge: {
    backgroundColor: '#e8f4f4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryBadgeText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 11,
    color: '#2d5a5a',
    fontWeight: '600',
    letterSpacing: 1,
  },
  experienceTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 20,
    color: '#2d3a3a',
    fontWeight: '600',
    marginBottom: 8,
  },
  experienceMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  experienceLocation: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#7a8a8a',
  },
  experienceDuration: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#7a8a8a',
  },
  experienceDescription: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#5a6a6a',
    lineHeight: 22,
    marginBottom: 16,
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
    color: '#2d3a3a',
    fontWeight: '600',
  },
});
