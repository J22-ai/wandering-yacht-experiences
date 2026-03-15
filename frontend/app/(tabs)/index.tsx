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
  Platform,
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
  ticket_types: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

const iconMap: { [key: string]: keyof typeof Ionicons.glyphMap } = {
  compass: 'compass',
  sailboat: 'boat',
  ship: 'boat-outline',
  briefcase: 'briefcase',
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
      setFeaturedExperiences(experiencesData.slice(0, 4));
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a365d"
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
            <View>
              <Text style={styles.welcomeText}>
                {user ? `Welcome, ${user.full_name.split(' ')[0]}` : 'Welcome'}
              </Text>
              <Text style={styles.headerTitle}>WANDERING YACHT</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=1200' }}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Luxury Awaits</Text>
            <Text style={styles.heroSubtitle}>Book your next adventure on the water</Text>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => router.push('/(tabs)/explore')}
            >
              <Text style={styles.heroButtonText}>Explore Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                onPress={() => router.push(`/(tabs)/explore?category=${category.slug}`)}
              >
                <Image
                  source={{ uri: category.image_url }}
                  style={styles.categoryImage}
                />
                <View style={styles.categoryOverlay}>
                  <Ionicons
                    name={iconMap[category.icon] || 'boat'}
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Experiences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.experiencesGrid}>
            {featuredExperiences.map((experience) => (
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
                  <Text style={styles.experienceTitle} numberOfLines={1}>
                    {experience.title}
                  </Text>
                  <View style={styles.experienceDetails}>
                    <Ionicons name="location" size={12} color="#8899a6" />
                    <Text style={styles.experienceLocation} numberOfLines={1}>
                      {experience.location}
                    </Text>
                  </View>
                  <Text style={styles.experiencePrice}>
                    From ${getLowestPrice(experience)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 30 }} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  welcomeText: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 14,
  },
  headerTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#1a365d',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a2d4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(10, 22, 40, 0.7)',
  },
  heroTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 14,
    marginTop: 4,
  },
  heroButton: {
    backgroundColor: '#1a365d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  heroButtonText: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  seeAll: {
    fontFamily: 'TraditionalArabic',
    color: '#e53e3e',
    fontSize: 14,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryCard: {
    width: 140,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(26, 54, 93, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  experiencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  experienceCard: {
    width: (width - 44) / 2,
    backgroundColor: '#1a2d4a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  experienceImage: {
    width: '100%',
    height: 120,
  },
  experienceInfo: {
    padding: 12,
  },
  experienceTitle: {
    fontFamily: 'TraditionalArabic',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  experienceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  experienceLocation: {
    fontFamily: 'TraditionalArabic',
    color: '#8899a6',
    fontSize: 12,
    flex: 1,
  },
  experiencePrice: {
    fontFamily: 'TraditionalArabic',
    color: '#e53e3e',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});
