import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  icon: string;
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

const categoryIcons: { [key: string]: string } = {
  experiences: 'sunny-outline',
  boat_rental: 'boat-outline',
  yacht_charter: 'wine-outline',
  management: 'leaf-outline',
};

const categoryDescriptions: { [key: string]: string } = {
  experiences: 'Yoga, wellness, and adventures',
  boat_rental: 'Luxury sailing and water sports',
  yacht_charter: 'Premium yacht experiences',
  management: 'Professional yacht services',
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredExperiences, setFeaturedExperiences] = useState<Experience[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
      setCategories(categoriesData);
      setFeaturedExperiences(experiencesData.slice(0, 6));
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2d5a5a"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../../assets/images/wy-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Wandering Yacht</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="menu" size={24} color="#2d5a5a" />
          </TouchableOpacity>
        </View>

        {/* Categories Grid */}
        <View style={styles.categoriesSection}>
          <View style={styles.categoriesGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                onPress={() => router.push(`/(tabs)/explore?category=${category.slug}`)}
              >
                <Ionicons
                  name={categoryIcons[category.slug] as any || 'boat-outline'}
                  size={28}
                  color="#2d5a5a"
                />
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryDescription}>
                  {categoryDescriptions[category.slug] || category.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Featured Experiences */}
        <View style={styles.featuredSection}>
          <Text style={styles.sectionLabel}>CURATED FOR YOU</Text>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Experiences</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {featuredExperiences.map((experience) => (
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
                <Text style={styles.experienceTitle} numberOfLines={2}>{experience.title}</Text>
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
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready for Your Next Adventure?</Text>
          <Text style={styles.ctaSubtitle}>
            Book your Montenegro experience today and create memories that last a lifetime.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={styles.ctaButtonText}>Start Exploring</Text>
          </TouchableOpacity>
        </View>

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 18,
    color: '#2d5a5a',
    fontWeight: '500',
  },
  categoriesSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: (width - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8e5e0',
  },
  categoryName: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#2d3a3a',
    fontWeight: '600',
    marginTop: 12,
  },
  categoryDescription: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#7a8a8a',
    marginTop: 4,
    lineHeight: 18,
  },
  featuredSection: {
    paddingHorizontal: 16,
    paddingTop: 40,
    backgroundColor: '#f0ebe4',
    marginTop: 30,
    paddingBottom: 20,
  },
  sectionLabel: {
    fontFamily: 'TraditionalArabic',
    fontSize: 12,
    color: '#c17f59',
    letterSpacing: 2,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 28,
    color: '#2d3a3a',
    fontWeight: '300',
  },
  viewAll: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#2d5a5a',
    fontWeight: '500',
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
  ctaSection: {
    backgroundColor: '#2d5a5a',
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  ctaTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 24,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  ctaSubtitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  ctaButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  ctaButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#2d5a5a',
    fontWeight: '600',
  },
});
