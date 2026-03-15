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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8899a6" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search experiences..."
          placeholderTextColor="#8899a6"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#8899a6" />
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
              selectedCategory === category.slug && styles.categoryChipActive,
            ]}
            onPress={() =>
              setSelectedCategory(category.slug === 'all' ? null : category.slug)
            }
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category.slug && styles.categoryChipTextActive,
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
            tintColor="#00b4d8"
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
              source={{ uri: experience.image_url || 'https://images.unsplash.com/photo-1531419746980-63af10612bf3?w=600' }}
              style={styles.experienceImage}
            />
            <View style={styles.experienceInfo}>
              <View style={styles.experienceBadge}>
                <Text style={styles.experienceBadgeText}>
                  {experience.category.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.experienceTitle}>{experience.title}</Text>
              <View style={styles.experienceDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="location" size={14} color="#8899a6" />
                  <Text style={styles.detailText}>{experience.location}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar" size={14} color="#8899a6" />
                  <Text style={styles.detailText}>{formatDate(experience.date)}</Text>
                </View>
                {experience.duration_hours > 0 && (
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={14} color="#8899a6" />
                    <Text style={styles.detailText}>{experience.duration_hours}h</Text>
                  </View>
                )}
              </View>
              <View style={styles.experienceFooter}>
                <Text style={styles.experiencePrice}>
                  From ${getLowestPrice(experience)}
                </Text>
                <View style={styles.spotsContainer}>
                  <Ionicons name="people" size={14} color="#00b4d8" />
                  <Text style={styles.spotsText}>
                    {experience.available_spots} spots left
                  </Text>
                </View>
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
    backgroundColor: '#0a1628',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2d4a',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a2d4a',
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: '#00b4d8',
  },
  categoryChipText: {
    color: '#8899a6',
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
    color: '#8899a6',
    fontSize: 14,
    marginBottom: 16,
  },
  experienceCard: {
    backgroundColor: '#1a2d4a',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  experienceImage: {
    width: '100%',
    height: 180,
  },
  experienceInfo: {
    padding: 16,
  },
  experienceBadge: {
    backgroundColor: 'rgba(0, 180, 216, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  experienceBadgeText: {
    color: '#00b4d8',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  experienceTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  experienceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#8899a6',
    fontSize: 13,
  },
  experienceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a3d5a',
  },
  experiencePrice: {
    color: '#00b4d8',
    fontSize: 18,
    fontWeight: '700',
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotsText: {
    color: '#00b4d8',
    fontSize: 13,
  },
});
