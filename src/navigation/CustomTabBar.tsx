import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ChartLineUp, Crown, House, ShoppingCart, User } from 'phosphor-react-native';
import { Image } from 'react-native';
import { useCartStore } from '../store/cartStore';

const { width: W } = Dimensions.get('window');
const BAR_H    = 56;
const FAB_SIZE = 52;
const FAB_R    = FAB_SIZE / 2;
const CX       = W / 2;
const NW_HALF  = 42;
const ND       = 28;

const TAB_CONFIG: Record<string, { Icon: React.ComponentType<any>; label: string }> = {
  Home:          { Icon: House,     label: 'Anasayfa' },
  Tracker:       { Icon: ChartLineUp, label: 'Kcalculate'     },
  Subscriptions: { Icon: Crown,     label: 'Macro'    },
  Profile:       { Icon: User,     label: 'Hesabım'  },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const fabScale   = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const tabScales  = useRef(
    ['Home', 'Tracker', 'Subscriptions', 'Profile'].map(() => new Animated.Value(1))
  ).current;

  // Badge pop animasyonu — sepet sayısı değişince
  useEffect(() => {
    if (cartCount === 0) return;
    Animated.sequence([
      Animated.spring(badgeScale, { toValue: 1.5, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(badgeScale, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
  }, [cartCount]);

  const animateTab = (index: number) => {
    Animated.sequence([
      Animated.spring(tabScales[index], { toValue: 0.82, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(tabScales[index], { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
  };

  const handleFabPress = () => {
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(fabScale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    const r = state.routes.find(x => x.name === 'Cart');
    if (r) handlePress(r.name, r.key);
  };
  const totalH = BAR_H + insets.bottom;

  const regularRoutes = state.routes.filter((r) => r.name !== 'Cart');
  const leftTabs  = regularRoutes.slice(0, 2);
  const rightTabs = regularRoutes.slice(2);

  const handlePress = (routeName: string, routeKey: string) => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!event.defaultPrevented && state.routes[state.index]?.name !== routeName) {
      navigation.navigate(routeName);
    }
  };

  const renderTab = (route: (typeof state.routes)[number], tabIndex: number) => {
    const cfg = TAB_CONFIG[route.name];
    if (!cfg) return null;
    const { Icon, label } = cfg;
    const isActive = state.routes[state.index]?.name === route.name;
    const isMacro  = route.name === 'Subscriptions';
    return (
      <TouchableOpacity
        key={route.key}
        style={s.tabItem}
        onPress={() => {
          animateTab(tabIndex);
          handlePress(route.name, route.key);
        }}
        activeOpacity={1}
      >
        <Animated.View style={{ transform: [{ scale: tabScales[tabIndex] }] }}>
          {isMacro ? (
            <Image
              source={require('../../assets/macro-coin.png')}
              style={{ width: 22, height: 22, opacity: isActive ? 1 : 0.4 }}
              resizeMode="contain"
            />
          ) : (
            <Icon size={20} weight={isActive ? "bold" : "regular"} color={isActive ? '#fff' : 'rgba(255,255,255,0.4)'} />
          )}
        </Animated.View>
        {isActive && <View style={s.dot} />}
        <Text style={[s.label, isActive && s.labelActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { height: totalH }]} pointerEvents="box-none">
      {/* SVG bar - absolute, şeffaf arka plan */}
      <Svg
        width={W}
        height={totalH}
        viewBox={`0 0 ${W} ${totalH}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path d={`M 0,0 L ${CX - NW_HALF},0 C ${CX - NW_HALF + 15},0 ${CX - FAB_R - 5},${ND} ${CX},${ND} C ${CX + FAB_R + 5},${ND} ${CX + NW_HALF - 15},0 ${CX + NW_HALF},0 L ${W},0 L ${W},${totalH} L 0,${totalH} Z`} fill="#000000" />
      </Svg>

      {/* Tab items */}
      <View style={[s.tabRow, { bottom: insets.bottom }]} pointerEvents="box-none">
        <View style={s.tabGroup}>{leftTabs.map((r, i) => renderTab(r, i))}</View>
        <View style={{ width: NW_HALF * 2 + 4 }} />
        <View style={s.tabGroup}>{rightTabs.map((r, i) => renderTab(r, i + 2))}</View>
      </View>

      {/* FAB */}
      <Animated.View style={[s.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}
          onPress={handleFabPress}
          activeOpacity={1}
        >
          <ShoppingCart size={22} color="#111" />
          {cartCount > 0 && (
            <Animated.View style={[s.badge, { transform: [{ scale: badgeScale }] }]}>
              <Text style={s.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabGroup: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  labelActive: {
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    top: -(FAB_SIZE / 2),
    left: CX - FAB_SIZE / 2,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: '#C6F04F',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#b4d232',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: 3, right: 3,
    backgroundColor: '#111',
    borderRadius: 99,
    minWidth: 16, height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#C6F04F',
  },
  badgeText: {
    color: '#C6F04F',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    lineHeight: 10,
  },
});
