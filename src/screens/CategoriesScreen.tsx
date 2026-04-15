import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, MagnifyingGlass } from 'phosphor-react-native';
import ScreenContainer from '../components/ScreenContainer';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { Category, fetchCategories } from '../lib/categories';
import { CachedImage } from '../components/CachedImage';
import { RootStackParamList } from '../navigation/types';
import { COLORS } from '../constants/theme';

type CategoriesNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CAT_COLORS = [
  COLORS.brand.green, '#ffd6a5', '#caffbf', '#a0c4ff', '#ffc6ff',
  '#fdffb6', '#b9fbc0', '#ffd6e0', '#c1d3fe', '#f0e0f0',
];

export default function CategoriesScreen() {
  const navigation = useNavigation<CategoriesNavigationProp>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Kategoriler yüklenemedi.';
      setErrorMessage(message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const filtered = search.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : categories;

  const renderItem = ({ item, index }: { item: Category; index: number }) => (
    <Pressable
      onPress={() =>
        navigation.navigate('CategoryProducts', {
          categoryName: item.name,
        })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {item.image_url ? (
        <View style={styles.iconCircle}>
          <CachedImage uri={item.image_url} style={styles.categoryImage} />
        </View>
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: CAT_COLORS[index % CAT_COLORS.length] }]}>
          <Text style={styles.iconText}>{item.emoji || item.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.cardTitle}>{item.name}</Text>
    </Pressable>
  );

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <ArrowLeft color="#000000" size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Kategoriler</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <MagnifyingGlass size={16} color={COLORS.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Kategori ara..."
          placeholderTextColor={COLORS.text.tertiary}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.brand.green} size="large" />
        </View>
      ) : errorMessage ? (
        <ErrorState message={errorMessage} onAction={loadCategories} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Kategori bulunamadı"
          message="Şu anda listelenecek kategori yok."
          actionLabel="Tekrar Dene"
          onAction={loadCategories}
        />
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.column}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },
  header: {
    backgroundColor: '#f6f6f6',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  headerTitle: {
    flex: 1,
    color: '#000000',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 42,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 50,
    borderRadius: 100,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    height: '100%',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  column: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'center',
  },
  cardPressed: {
    opacity: 0.9,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconText: {
    fontSize: 32,
  },
  cardTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  cardCount: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
});
