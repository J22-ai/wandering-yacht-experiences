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
  ImageBackground,
  Modal,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const openLink = (url: string) => {
  if (Platform.OS === 'web') {
    try {
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (!newWindow || newWindow.closed) {
        // Popup blocked — try anchor fallback
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }
    } catch {
      window.location.href = url;
    }
  } else {
    Linking.openURL(url);
  }
};

const { width: screenWidth } = Dimensions.get('window');

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

const featureItems = [
  { title: 'WATER ADVENTURES', desc: 'Thrilling water sports and activities', slug: 'water_adventures', logo: require('../../assets/images/wy-splash.jpg') },
  { title: 'WELLNESS ON DECK', desc: 'Luxury sailing and wellness on the water', slug: 'yacht_experiences', logo: require('../../assets/images/wy-wellness.jpg') },
  { title: 'CULINARY EXCURSIONS', desc: 'Wine tasting and gourmet adventures', slug: 'culinary_tours', logo: require('../../assets/images/wy-culinary.jpg') },
  { title: 'NATURE ESCAPES', desc: 'Explore breathtaking landscapes', slug: 'nature_escapes', logo: require('../../assets/images/wy-nature.jpg') },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredExperiences, setFeaturedExperiences] = useState<Experience[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allExperiences, setAllExperiences] = useState<Experience[]>([]);
  const searchInputRef = React.useRef<TextInput>(null);

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
      setAllExperiences(experiencesData);
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

  const filteredSearchResults = allExperiences.filter((exp) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      exp.title.toLowerCase().includes(q) ||
      exp.location.toLowerCase().includes(q) ||
      exp.description.toLowerCase().includes(q)
    );
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1a3a4a"
          />
        }
      >
        {/* Logo Section - Large & Centered */}
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/images/wy-logo.png')}
            style={styles.mainLogo}
            resizeMode="contain"
          />
        </View>

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <View style={styles.featuresGrid}>
            {featureItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
                onPress={() => router.push({ pathname: '/(tabs)/explore', params: { category: item.slug } })}
              >
                <View style={styles.featureIconWrap}>
                  <Image
                    source={item.logo}
                    style={styles.featureLogo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDesc}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Featured Experiences */}
        <View style={styles.featuredSection}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>CURATED FOR YOU</Text>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Experiences</Text>
            <TouchableOpacity
              onPress={() => router.navigate('/(tabs)/explore' as Href)}
              style={styles.viewAllBtn}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="arrow-forward" size={16} color="#1a3a4a" />
            </TouchableOpacity>
          </View>

          {featuredExperiences.map((experience) => (
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
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready for Your{'\n'}Next Adventure?</Text>
          <Text style={styles.ctaSubtitle}>
            Book your Montenegro experience today and create memories that last a lifetime.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => { setSearchQuery(''); setShowSearch(true); }}
          >
            <Text style={styles.ctaButtonText}>Start Exploring</Text>
          </TouchableOpacity>
        </View>

        {/* About & Contact Buttons */}
        <View style={styles.bottomLinksSection}>
          <TouchableOpacity
            style={styles.bottomLinkButton}
            onPress={() => router.push('/about')}
          >
            <Ionicons name="information-circle-outline" size={22} color="#1a3a4a" />
            <Text style={styles.bottomLinkText}>About Us</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3a3" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomLinkButton}
            onPress={() => openLink('https://wa.me/38269333693')}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            <Text style={styles.bottomLinkText}>Contact Us</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3a3" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Search Modal */}
      <Modal
        visible={showSearch}
        animationType="slide"
        presentationStyle="pageSheet"
        onShow={() => {
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 300);
        }}
      >
        <View style={[styles.searchModal, { paddingTop: insets.top + 10 }]}>
          <View style={styles.searchModalHeader}>
            <Text style={styles.searchModalTitle}>Find an Experience</Text>
            <TouchableOpacity onPress={() => setShowSearch(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#1a2a30" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#9ca3a3" />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Type to search (e.g. yoga, kayak, wine...)"
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
          <Text style={styles.searchResultsCount}>
            {filteredSearchResults.length} experience{filteredSearchResults.length !== 1 ? 's' : ''}
          </Text>
          <ScrollView style={styles.searchResultsList} showsVerticalScrollIndicator={false}>
            {filteredSearchResults.map((exp) => (
              <TouchableOpacity
                key={exp.id}
                style={styles.searchResultItem}
                onPress={() => {
                  setShowSearch(false);
                  router.push(`/experience/${exp.id}`);
                }}
                activeOpacity={0.7}
              >
                <Image source={{ uri: exp.image_url }} style={styles.searchResultImage} />
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultTitle} numberOfLines={1}>{exp.title}</Text>
                  <View style={styles.searchResultMeta}>
                    <Ionicons name="location-outline" size={13} color="#7a8a8a" />
                    <Text style={styles.searchResultLocation} numberOfLines={1}>{exp.location}</Text>
                  </View>
                  <Text style={styles.searchResultPrice}>from €{getLowestPrice(exp)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3a3" />
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f7',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0ede8',
  },
  mainLogo: {
    width: 120,
    height: 120,
  },
  featuresSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(26, 58, 74, 0.08)',
    alignItems: 'center',
  },
  featureIconWrap: {
    marginBottom: 12,
    alignItems: 'center',
  },
  featureLogo: {
    width: 30,
    height: 30,
  },
  featureTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#1a3a4a',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDesc: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#7a8a8a',
    lineHeight: 18,
    textAlign: 'center',
  },
  featuredSection: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 16,
  },
  sectionLabelRow: {
    marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: 'TraditionalArabic',
    fontSize: 12,
    color: '#c17f59',
    letterSpacing: 2,
    fontWeight: '600',
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
    color: '#1a2a30',
    fontWeight: '300',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#1a3a4a',
    fontWeight: '500',
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
  ctaSection: {
    backgroundColor: '#1a3a4a',
    padding: 32,
    alignItems: 'center',
    marginTop: 12,
  },
  ctaTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36,
  },
  ctaSubtitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  ctaButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 8,
  },
  ctaButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#1a3a4a',
    fontWeight: '600',
  },
  bottomLinksSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 10,
  },
  bottomLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0ede8',
    gap: 14,
  },
  bottomLinkText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#1a2a30',
    fontWeight: '500',
    flex: 1,
  },
  searchModal: {
    flex: 1,
    backgroundColor: '#faf9f7',
    paddingHorizontal: 16,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  searchModalTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 24,
    color: '#1a2a30',
    fontWeight: '300',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e5e0',
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'TraditionalArabic',
    color: '#1a2a30',
    fontSize: 16,
    height: 44,
    padding: 0,
  },
  searchResultsCount: {
    fontFamily: 'TraditionalArabic',
    color: '#7a8a8a',
    fontSize: 14,
    marginBottom: 12,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0ede8',
  },
  searchResultImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#e8e5e0',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  searchResultTitle: {
    fontFamily: 'TraditionalArabic',
    fontSize: 16,
    color: '#1a2a30',
    fontWeight: '600',
    marginBottom: 3,
  },
  searchResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  searchResultLocation: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#7a8a8a',
  },
  searchResultPrice: {
    fontFamily: 'TraditionalArabic',
    fontSize: 14,
    color: '#1a3a4a',
    fontWeight: '600',
  },
});
