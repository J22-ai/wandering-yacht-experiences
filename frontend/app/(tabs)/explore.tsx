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
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { getTranslatedExperience } from '../../src/i18n/experienceTranslations';

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
  card_layout?: string;
  images?: string[];
}

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, language } = useLanguage();
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
    if (hours >= 24) return `${Math.round(hours / 24)} ${t('detail_days')}`;
    return `${hours} ${hours > 1 ? t('detail_hours') : t('detail_hour')}`;
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
    // Sort by lowest price (cheapest first)
    filtered.sort((a, b) => getLowestPrice(a) - getLowestPrice(b));
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
    // Sort each category group by price (cheapest first)
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => getLowestPrice(a) - getLowestPrice(b));
    });
    return grouped;
  };

  const getCategoryName = (slug: string) => {
    const catKeyMap: { [key: string]: string } = {
      'water_adventures': 'cat_water_adventures',
      'yacht_experiences': 'cat_wellness_on_deck',
      'culinary_tours': 'cat_culinary_excursions',
      'nature_escapes': 'cat_nature_escapes',
      'concierge_services': 'cat_concierge_services',
      'weddings_events': 'cat_weddings_events',
      'experiences': 'cat_experiences',
    };
    if (catKeyMap[slug]) return t(catKeyMap[slug]);
    const cat = categories.find(c => c.slug === slug);
    return cat ? cat.name : slug.replace(/[_-]/g, ' ').toUpperCase();
  };

  const handleFleetInquiry = () => {
    const subject = encodeURIComponent('NEW INQUIRY for CHARTERING AN ADDITIONAL YACHT');
    const body = encodeURIComponent('Hello Wandering Yacht,\n\nI would like to inquire about chartering a yacht from your fleet outside of the Wandering Yacht Experiences app.\n\nPlease share available options for:\n- Destination: \n- Dates: \n- Number of guests: \n\nThank you.');
    Linking.openURL(`mailto:info@wanderingyacht.com?subject=${subject}&body=${body}`);
  };

  const getCategoryIcon = (slug) => {
    const icons = {
      'water_adventures': 'boat-outline',
      'yacht_experiences': 'leaf-outline',
      'culinary_tours': 'restaurant-outline',
      'nature_escapes': 'earth-outline',
      'concierge_services': 'diamond-outline',
      'weddings_events': 'heart-outline',
    };
    return icons[slug] || 'star-outline';
  };

  const renderFleetInquiryBanner = () => (
    <View style={styles.fleetBanner}>
      <View style={styles.fleetDivider} />
      <Text style={styles.fleetText}>
        Please inquire about our entire fleet of yachts that you can charter in Montenegro, Croatia, Albania and Greece.
      </Text>
      <TouchableOpacity style={styles.fleetButton} onPress={handleFleetInquiry} activeOpacity={0.7}>
        <Ionicons name="mail-outline" size={16} color="#fff" />
        <Text style={styles.fleetButtonText}>Inquire Here</Text>
      </TouchableOpacity>
      <View style={styles.fleetDivider} />
    </View>
  );

  const filteredExperiences = getFilteredExperiences();
  const groupedExperiences = getGroupedExperiences();

  const renderExperienceCard = (experience) => (
    <TouchableOpacity
      key={experience.id}
      style={styles.experienceCard}
      onPress={() => router.push(`/experience/${experience.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.experienceImageWrap}>
        {experience.card_layout === 'split' && experience.images?.length >= 2 ? (
          <View style={styles.splitImageContainer}>
            <Image
              source={{ uri: experience.images[1] || experience.images[0] }}
              style={styles.splitImageLeft}
            />
            <View style={styles.splitDivider} />
            <Image
              source={{ uri: experience.images[2] || experience.images[1] }}
              style={styles.splitImageRight}
            />
          </View>
        ) : (
          <Image
            source={{ uri: experience.image_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800' }}
            style={styles.experienceImage}
          />
        )}
        <View style={styles.imageOverlay} />
        <View style={styles.imageBadge}>
          <Text style={styles.imageBadgeText}>{t('detail_from')} €{getLowestPrice(experience)}</Text>
          <Text style={styles.imageBadgeTax}>{t('price_incl_taxes')}</Text>
        </View>
      </View>
      <View style={styles.experienceContent}>
        <Text style={styles.experienceTitle} numberOfLines={2}>{getTranslatedExperience(language, experience.title)?.title || experience.title}</Text>
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
          <View style={styles.spotsRow}>
            <View style={styles.spotDot} />
            <Text style={styles.spotsText}>{experience.available_spots} {t('detail_spots')}</Text>
          </View>
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>{t('view')}</Text>
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
          <Text style={styles.headerTitle}>{t('explore_title')}</Text>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TouchableOpacity onPress={() => searchInputRef.current?.focus()}>
          <Ionicons name="search" size={18} color="#9ca3a3" />
        </TouchableOpacity>
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder={t('explore_search')}
          placeholderTextColor="#9ca3a3"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3a3" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a3a4a" />
        }
      >
        {/* Category List - only when no category pre-selected AND no search query */}
        {!selectedCategory && !searchQuery.trim() && (
          <View style={styles.categoryList}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryRow}
                onPress={() => setSelectedCategory(category.slug)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryIconWrap}>
                  <Ionicons name={getCategoryIcon(category.slug)} size={18} color="#c17f59" />
                </View>
                <Text style={styles.categoryRowText}>{getCategoryName(category.slug)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#c17f59" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.resultsCount}>
          {filteredExperiences.length} {t('explore_results_count')}{filteredExperiences.length !== 1 ? 's' : ''}
        </Text>

        {selectedCategory || searchQuery.trim() ? (
          /* Single category or search results view */
          <>
            {filteredExperiences.map(renderExperienceCard)}
            {selectedCategory === 'water_adventures' && renderFleetInquiryBanner()}
          </>
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
              {categorySlug === 'water_adventures' && renderFleetInquiryBanner()}
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
    textAlign: 'center',
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
    paddingTop: 10,
    paddingBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ede9e3',
    gap: 12,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#faf5f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRowText: {
    flex: 1,
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
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  experienceImageWrap: {
    position: 'relative',
  },
  experienceImage: {
    width: '100%',
    height: 190,
    backgroundColor: '#e8e5e0',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  imageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(26,58,74,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageBadgeText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  imageBadgeTax: {
    fontFamily: 'TraditionalArabic',
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
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
  spotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4caf50',
  },
  spotsText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 13,
    color: '#5a6a6a',
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
  // Fleet inquiry banner
  fleetBanner: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  fleetDivider: {
    height: 1,
    backgroundColor: '#d0ccc5',
    marginVertical: 12,
  },
  fleetText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#3a4a50',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 14,
    fontStyle: 'italic',
  },
  fleetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3a4a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
    alignSelf: 'center',
  },
  fleetButtonText: {
    fontFamily: 'TraditionalArabic',
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  // Split image card styles
  splitImageContainer: {
    flexDirection: 'row',
    width: '100%',
    height: 190,
  },
  splitImageLeft: {
    flex: 1,
    height: 190,
    backgroundColor: '#e8e5e0',
  },
  splitDivider: {
    width: 2,
    height: 190,
    backgroundColor: '#fff',
  },
  splitImageRight: {
    flex: 1,
    height: 190,
    backgroundColor: '#e8e5e0',
  },
});
