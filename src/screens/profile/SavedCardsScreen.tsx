import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft, CreditCard, Lock, Plus } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ScreenContainer';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';

type SavedCardsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SavedCardsScreen() {
  const navigation = useNavigation<SavedCardsNavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, loading } = useRequireAuth();

  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated) return null;

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Kayıtlı Kartlarım</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: Math.max(32, insets.bottom + 24) }]}
      >
        {/* Coming soon badge */}
        <View style={s.comingBadge}>
          <Text style={s.comingBadgeText}>Yakında Aktif Olacak</Text>
        </View>

        {/* Empty state — dark card preview */}
        <View style={s.mockCard}>
          <View style={s.mockCardCircle1} />
          <View style={s.mockCardCircle2} />
          <CreditCard size={28} color="rgba(255,255,255,0.4)" />
          <Text style={s.mockCardLabel}>Kart Eklenmemiş</Text>
          <Text style={s.mockCardSub}>Kartlarınız buraya eklenecek</Text>
          <View style={s.mockCardDots}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={s.mockDotGroup}>
                {Array.from({ length: 4 }).map((__, j) => (
                  <View key={j} style={s.mockDot} />
                ))}
              </View>
            ))}
          </View>
        </View>

        <Text style={s.emptyTitle}>Kayıtlı kart bulunmuyor</Text>
        <Text style={s.emptySub}>
          Ödeme kartlarınızı ekleyerek hızlıca ödeme yapabilirsiniz.
        </Text>

        {/* Add card button (disabled) */}
        <TouchableOpacity style={s.addCardBtn} disabled activeOpacity={0.6}>
          <View style={s.addCardIconWrap}>
            <Plus size={18} color={COLORS.text.tertiary} />
          </View>
          <Text style={s.addCardText}>Yeni Kart Ekle</Text>
        </TouchableOpacity>

        {/* Security note */}
        <View style={s.securityNote}>
          <Lock size={14} color={COLORS.text.secondary} />
          <Text style={s.securityText}>
            Kartlarınız 256-bit SSL şifrelemesiyle güvenle saklanır.
            Kart bilgilerinize yalnızca siz erişebilirsiniz.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },

  content: { paddingHorizontal: 16, paddingTop: 8, alignItems: 'center', gap: 14 },

  comingBadge: {
    backgroundColor: COLORS.brand.green, borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  comingBadgeText: { fontSize: 12, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },

  // Mock card
  mockCard: {
    width: '100%', height: 180, borderRadius: 20,
    backgroundColor: '#1a1a1a', overflow: 'hidden',
    alignItems: 'flex-start', justifyContent: 'flex-end',
    padding: 20, gap: 4, marginTop: 4,
  },
  mockCardCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -60, right: -40,
  },
  mockCardCircle2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)', top: 20, right: 60,
  },
  mockCardLabel: { fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: 'rgba(255,255,255,0.6)' },
  mockCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12 },
  mockCardDots: { flexDirection: 'row', gap: 8 },
  mockDotGroup: { flexDirection: 'row', gap: 4 },
  mockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },

  emptyTitle: { fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', textAlign: 'center' },
  emptySub: { fontSize: 13, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },

  addCardBtn: {
    width: '100%', height: 56, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
  },
  addCardIconWrap: {
    width: 28, height: 28, borderRadius: 100,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  addCardText: { fontSize: 14, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.tertiary },

  securityNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)', width: '100%',
  },
  securityText: { flex: 1, fontSize: 12, color: COLORS.text.secondary, lineHeight: 18 },
});
