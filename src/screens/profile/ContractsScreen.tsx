import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { CaretLeft } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ScreenContainer';
import { CONTRACTS } from '../../data/contractsData';
import { RootStackParamList } from '../../navigation/types';

type ContractsRoute = RouteProp<RootStackParamList, 'ProfileContracts'>;

export default function ContractsScreen() {
  const navigation = useNavigation();
  const route = useRoute<ContractsRoute>();
  const insets = useSafeAreaInsets();

  const initialSlug = route.params?.slug;
  const initialIndex = useMemo(() => {
    const i = CONTRACTS.findIndex((c) => c.slug === initialSlug);
    return i >= 0 ? i : 0;
  }, [initialSlug]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeContract = CONTRACTS[activeIndex];

  const paragraphs = useMemo(
    () => activeContract.content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
    [activeContract],
  );

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sözleşmeler</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {CONTRACTS.map((c, i) => {
            const active = i === activeIndex;
            return (
              <TouchableOpacity
                key={c.slug}
                onPress={() => setActiveIndex(i)}
                style={s.tab}
                activeOpacity={0.7}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{c.title}</Text>
                {active && <View style={s.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(40, insets.bottom + 20) }]}
        showsVerticalScrollIndicator={false}
      >
        {paragraphs.map((p, i) => {
          const isHeading = /^(MADDE|BÖLÜM)\b/i.test(p);
          return (
            <Text key={i} style={isHeading ? s.heading : s.body}>
              {p}
            </Text>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    backgroundColor: '#ffffff',
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  tabIndicator: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    height: 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 12,
  },
  heading: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1A1A1A',
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 12,
    marginTop: 4,
  },
});
