import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import * as Print from 'expo-print';
import { KCALCULATE_LOGO_B64 } from '../constants/kcalculateLogo';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Sharing from 'expo-sharing';
import { Circle, Svg, Polyline } from 'react-native-svg';
import {ChartBar, CheckCircle, SquaresFour, Package, Plus, Drop, FilePdf, ForkKnife, TrophyIcon} from 'phosphor-react-native';
import { MACRO_COLORS, hexToRgba } from '../constants/colors';
import ScreenContainer from '../components/ScreenContainer';
import AnimatedNumberText from '../components/AnimatedNumberText';
import { CachedImage } from '../components/CachedImage';
import { transformImageUrl, ImagePreset } from '../lib/imageUrl';
import { useAuth } from '../context/AuthContext';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { getSupabaseClient } from '../lib/supabase';
import { formatSupabaseErrorForDevLog } from '../lib/supabaseErrors';
import { RootStackParamList } from '../navigation/types';
import { usePantryStore, PantryItem } from '../store/pantryStore';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

type TrackerNavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FilterType = 'today' | 'yesterday' | 'week' | 'last14' | 'last30';
type ViewMode = 'ozet' | 'grafik';

// ─── Tipler ─────────────────────────────────────────────────────────────────

type MacroTotals = { kcal: number; protein: number; carbs: number; fat: number };

type OrderProduct = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type OrderItem = {
  quantity: number;
  products: OrderProduct | null;
};

type Order = {
  id: string;
  order_code: string | null;
  created_at: string;
  order_items: OrderItem[];
};

type UserNutritionProfile = {
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_water: number | null;
};

// ─── Reducer Types ─────────────────────────────────────────────────────────

type MeasurementRow = { date: string; weight_kg: number | null; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null };
type MealLogRow = { id: string; meal_type: string; calories: number; date: string };

// UI state
type UIState = {
  viewMode: ViewMode;
  showStartPicker: boolean;
  showEndPicker: boolean;
  dataLoading: boolean;
  errorMessage: string;
  exportingPDF: boolean;
};
type UIAction =
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_SHOW_START_PICKER'; payload: boolean }
  | { type: 'SET_SHOW_END_PICKER'; payload: boolean }
  | { type: 'SET_DATA_LOADING'; payload: boolean }
  | { type: 'SET_ERROR_MESSAGE'; payload: string }
  | { type: 'SET_EXPORTING_PDF'; payload: boolean };
function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_VIEW_MODE': return { ...state, viewMode: action.payload };
    case 'SET_SHOW_START_PICKER': return { ...state, showStartPicker: action.payload };
    case 'SET_SHOW_END_PICKER': return { ...state, showEndPicker: action.payload };
    case 'SET_DATA_LOADING': return { ...state, dataLoading: action.payload };
    case 'SET_ERROR_MESSAGE': return { ...state, errorMessage: action.payload };
    case 'SET_EXPORTING_PDF': return { ...state, exportingPDF: action.payload };
    default: return state;
  }
}
const uiInitial: UIState = {
  viewMode: 'ozet',
  showStartPicker: false,
  showEndPicker: false,
  dataLoading: true,
  errorMessage: '',
  exportingPDF: false,
};

// Data state
type DataState = {
  orders: Order[];
  nutritionProfile: UserNutritionProfile | null;
  measurements: MeasurementRow[];
  mealLogs: MealLogRow[];
  todayMacros: MacroTotals;
  waterCount: number;
  consumedInstances: Set<string>;
};
type DataAction =
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_NUTRITION_PROFILE'; payload: UserNutritionProfile | null }
  | { type: 'SET_MEASUREMENTS'; payload: MeasurementRow[] }
  | { type: 'SET_MEAL_LOGS'; payload: MealLogRow[] }
  | { type: 'APPEND_MEAL_LOG'; payload: MealLogRow }
  | { type: 'SET_TODAY_MACROS'; payload: MacroTotals }
  | { type: 'SET_WATER_COUNT'; payload: number }
  | { type: 'SET_CONSUMED_INSTANCES'; payload: Set<string> };
function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'SET_ORDERS': return { ...state, orders: action.payload };
    case 'SET_NUTRITION_PROFILE': return { ...state, nutritionProfile: action.payload };
    case 'SET_MEASUREMENTS': return { ...state, measurements: action.payload };
    case 'SET_MEAL_LOGS': return { ...state, mealLogs: action.payload };
    case 'APPEND_MEAL_LOG': return { ...state, mealLogs: [...state.mealLogs, action.payload] };
    case 'SET_TODAY_MACROS': return { ...state, todayMacros: action.payload };
    case 'SET_WATER_COUNT': return { ...state, waterCount: action.payload };
    case 'SET_CONSUMED_INSTANCES': return { ...state, consumedInstances: action.payload };
    default: return state;
  }
}
const dataInitial: DataState = {
  orders: [],
  nutritionProfile: null,
  measurements: [],
  mealLogs: [],
  todayMacros: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  waterCount: 0,
  consumedInstances: new Set(),
};

// Filter state
type FilterState = {
  selectedFilter: FilterType;
  customStart: Date;
  customEnd: Date;
};
type FilterAction =
  | { type: 'SET_SELECTED_FILTER'; payload: FilterType }
  | { type: 'SET_CUSTOM_START'; payload: Date }
  | { type: 'SET_CUSTOM_END'; payload: Date };
function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_SELECTED_FILTER': return { ...state, selectedFilter: action.payload };
    case 'SET_CUSTOM_START': return { ...state, customStart: action.payload };
    case 'SET_CUSTOM_END': return { ...state, customEnd: action.payload };
    default: return state;
  }
}
const filterInitial: FilterState = {
  selectedFilter: 'today',
  customStart: new Date(Date.now() - 7 * 86400000),
  customEnd: new Date(),
};

// Meal form state
type MealFormState = {
  visible: boolean;
  mealType: 'kahvalti' | 'ogle' | 'aksam' | 'atistirma';
  calories: string;
  note: string;
  saving: boolean;
};
type MealFormAction =
  | { type: 'SET_VISIBLE'; payload: boolean }
  | { type: 'SET_MEAL_TYPE'; payload: MealFormState['mealType'] }
  | { type: 'SET_CALORIES'; payload: string }
  | { type: 'SET_NOTE'; payload: string }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'RESET_FORM' };
function mealFormReducer(state: MealFormState, action: MealFormAction): MealFormState {
  switch (action.type) {
    case 'SET_VISIBLE': return { ...state, visible: action.payload };
    case 'SET_MEAL_TYPE': return { ...state, mealType: action.payload };
    case 'SET_CALORIES': return { ...state, calories: action.payload };
    case 'SET_NOTE': return { ...state, note: action.payload };
    case 'SET_SAVING': return { ...state, saving: action.payload };
    case 'RESET_FORM': return { ...state, calories: '', note: '', visible: false };
    default: return state;
  }
}
const mealFormInitial: MealFormState = {
  visible: false,
  mealType: 'kahvalti',
  calories: '',
  note: '',
  saving: false,
};

// ─── Normalizasyon ──────────────────────────────────────────────────────────

const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeProduct = (raw: unknown): OrderProduct => {
  const r = (raw != null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    name: String(r.name ?? '').trim() || 'Ürün',
    calories: toNum(r.calories ?? r.cal ?? r.kcal),
    protein: toNum(r.protein),
    carbs: toNum(r.carbs),
    fat: toNum(r.fat ?? r.fats),
  };
};

const normalizeOrderItem = (raw: unknown): OrderItem => {
  const r = (raw != null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    quantity: Math.max(1, toNum(r.quantity, 1)),
    products: r.products != null ? normalizeProduct(r.products) : null,
  };
};

const normalizeOrder = (raw: unknown): Order => {
  const r = (raw != null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    order_code: r.order_code ? String(r.order_code).trim() : null,
    created_at: String(r.created_at ?? ''),
    order_items: Array.isArray(r.order_items)
      ? r.order_items.map(normalizeOrderItem)
      : [],
  };
};

// ─── Hesaplama fonksiyonları ─────────────────────────────────────────────────

const getFilterRange = (filter: FilterType): { start: Date; end: Date } => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (filter === 'today') return { start: todayStart, end: dayEnd };

  if (filter === 'yesterday') {
    const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(dayEnd); yEnd.setDate(yEnd.getDate() - 1);
    return { start: yStart, end: yEnd };
  }

  if (filter === 'week') {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    return { start: weekStart, end: dayEnd };
  }

  if (filter === 'last14') { const s = new Date(todayStart); s.setDate(s.getDate()-13); return { start: s, end: dayEnd }; }
  if (filter === 'last30') { const s = new Date(todayStart); s.setDate(s.getDate()-29); return { start: s, end: dayEnd }; }

const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  return { start: monthStart, end: dayEnd };
};

const getDayCount = (filter: FilterType): number => {
  if (filter === 'today') return 1;
  if (filter === 'yesterday') return 1;
  if (filter === 'week') return 7;
  if (filter === 'last14') return 14;
  if (filter === 'last30') return 30;
return new Date().getDate();
};

const calculateOrderMacros = (order: Order): MacroTotals => {
  const t: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  order.order_items.forEach((item) => {
    if (!item.products) return;
    const q = item.quantity;
    t.kcal += item.products.calories * q;
    t.protein += item.products.protein * q;
    t.carbs += item.products.carbs * q;
    t.fat += item.products.fat * q;
  });
  return t;
};

const calculateTotalMacros = (orders: Order[]): MacroTotals => {
  const t: MacroTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  orders.forEach((o) => {
    const m = calculateOrderMacros(o);
    t.kcal += m.kcal;
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
  });
  return t;
};

const calculateAverageMacros = (orders: Order[], filter: FilterType): MacroTotals => {
  const totals = calculateTotalMacros(orders);
  const days = getDayCount(filter);
  return {
    kcal: Math.round(totals.kcal / days),
    protein: Math.round(totals.protein / days),
    carbs: Math.round(totals.carbs / days),
    fat: Math.round(totals.fat / days),
  };
};

const formatDayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDayLabel = (dayKey: string): string => {
  const d = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  const today = formatDayKey(new Date());
  if (dayKey === today) return 'Bugün';
  return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const groupByDay = (orders: Order[]) => {
  const map = new Map<string, Order[]>();
  orders.forEach((order) => {
    const key = formatDayKey(new Date(order.created_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(order);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dayKey, dayOrders]) => ({
      dayKey,
      dayLabel: formatDayLabel(dayKey),
      orders: dayOrders,
      macros: calculateTotalMacros(dayOrders),
    }));
};

// ─── BigCalorieRing ──────────────────────────────────────────────────────────

type BigRingProps = { current: number; target: number };

function BigCalorieRing({ current, target }: BigRingProps) {
  const size = 200;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const remaining = Math.max(target - current, 0);

  const animatedKcal = useRef(new Animated.Value(0)).current;
  const [displayKcal, setDisplayKcal] = useState(0);

  useEffect(() => {
    Animated.timing(animatedKcal, {
      toValue: current,
      duration: 800,
      useNativeDriver: false,
    }).start();
    const id = animatedKcal.addListener(({ value }) => setDisplayKcal(Math.round(value)));
    return () => animatedKcal.removeListener(id);
  }, [current]);

  return (
    <View style={s.ringWrapper}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={s.ringAbsolute}>
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke="#e8e8e8" strokeWidth={stroke} fill="none"
          />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={COLORS.brand.green} strokeWidth={stroke} fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />
        </Svg>
        <View style={s.ringCenter}>
          <AnimatedNumberText style={s.ringKcal} value={displayKcal.toLocaleString()} />
          <Text style={s.ringKcalLabel}>kcal tüketildi</Text>
          <View style={s.ringBadge}>
            {remaining > 0 ? (
              <AnimatedNumberText style={s.ringBadgeText} value={`${remaining} kcal kaldı`} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TrophyIcon size={16} color="#A3E635" weight="fill" />
                <Text style={s.ringBadgeText}>Hedefe ulaşıldı!</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline' }}>
        <Text style={s.ringTargetLabel}>Günlük hedef: </Text>
        <AnimatedNumberText style={s.ringTargetBold} value={`${target.toLocaleString()} kcal`} />
      </View>
    </View>
  );
}

// ─── MacroRing ──────────────────────────────────────────────────────────────

type MacroRingProps = {
  label: string;
  current: number;
  target: number;
  color: string;
  trackColor: string;
  unit: string;
  onPress?: () => void;
};

function MacroRing({ label, current, target, color, trackColor, unit, onPress }: MacroRingProps) {
  const size = 88;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(current / target, 1) : 0;

  return (
    <TouchableOpacity onPress={onPress} style={s.macroRingCard} activeOpacity={0.85}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={s.ringAbsolute}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
            transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          />
        </Svg>
        <View style={s.macroRingCenter}>
          <View style={[s.macroRingDot, { backgroundColor: color }]} />
          <AnimatedNumberText style={s.macroRingValue} value={Math.round(current)} />
        </View>
      </View>
      <View style={s.macroRingInfo}>
        <Text style={s.macroRingLabel}>{label}</Text>
        <AnimatedNumberText style={s.macroRingSubLabel} value={`${Math.round(current)}${unit} / ${Math.round(target)}${unit}`} />
        <View style={[s.macroRingTrack, { backgroundColor: trackColor }]}>
          <View style={[s.macroRingFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: color }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── GrafikView ──────────────────────────────────────────────────────────────

type MeasurementPoint = { date: string; weight_kg: number | null; waist_cm: number | null; hip_cm: number | null; chest_cm: number | null };

type GrafikViewProps = {
  orders: Order[];
  nutritionProfile: UserNutritionProfile | null;
  measurements: MeasurementPoint[];
  onExportPDF: () => void;
  exportingPDF: boolean;
};

const WEEK_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function GrafikView({ orders, nutritionProfile, measurements, onExportPDF, exportingPDF }: GrafikViewProps) {
  const targetKcal = nutritionProfile?.target_calories ?? 2000;
  const targetProtein = nutritionProfile?.target_protein ?? 120;
  const targetCarbs = nutritionProfile?.target_carbs ?? 250;
  const targetFat = nutritionProfile?.target_fat ?? 65;

  const weeklyData = useMemo(() => {
    const days: { label: string; kcal: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDayKey(d);
      const dayOrders = orders.filter(o => formatDayKey(new Date(o.created_at)) === key);
      const kcal = calculateTotalMacros(dayOrders).kcal;
      days.push({ label: WEEK_DAYS[(d.getDay() + 6) % 7], kcal, date: key });
    }
    return days;
  }, [orders]);

  const macroConsistency = useMemo(() => {
    let proteinDays = 0, carbsDays = 0, fatDays = 0;
    weeklyData.forEach(({ date }) => {
      const dayOrders = orders.filter(o => formatDayKey(new Date(o.created_at)) === date);
      if (dayOrders.length === 0) return;
      const m = calculateTotalMacros(dayOrders);
      if (m.protein >= targetProtein * 0.85) proteinDays++;
      if (m.carbs >= targetCarbs * 0.85) carbsDays++;
      if (m.fat >= targetFat * 0.85) fatDays++;
    });
    return { proteinDays, carbsDays, fatDays };
  }, [weeklyData, orders, targetProtein, targetCarbs, targetFat]);

  const adherenceScore = useMemo(() => {
    const activeDays = weeklyData.filter(d => d.kcal > 0);
    if (activeDays.length === 0) return null;
    const onTarget = activeDays.filter(d =>
      d.kcal >= targetKcal * 0.9 && d.kcal <= targetKcal * 1.1
    ).length;
    return Math.round((onTarget / activeDays.length) * 100);
  }, [weeklyData, targetKcal]);

  const weightTrend = useMemo(() =>
    measurements.filter(m => m.weight_kg != null).slice(0, 14).reverse(),
    [measurements]
  );

  const maxKcal = Math.max(...weeklyData.map(d => d.kcal), targetKcal, 1);
  const activeDays7 = weeklyData.filter(d => d.kcal > 0);
  const avgKcal = activeDays7.length > 0
    ? Math.round(activeDays7.reduce((s, d) => s + d.kcal, 0) / activeDays7.length) : 0;
  const kcalDiff = avgKcal > 0 ? avgKcal - targetKcal : 0;

  const weekOrders = orders.filter(o =>
    weeklyData.some(w => w.date === formatDayKey(new Date(o.created_at)))
  );
  const weekTotals = calculateTotalMacros(weekOrders);
  const pK = weekTotals.protein * 4;
  const cK = weekTotals.carbs * 4;
  const fK = weekTotals.fat * 9;
  const tot = pK + cK + fK || 1;

  return (
    <View style={s.grafikContainer}>

      {/* 1. Haftalık Kalori */}
      <View style={s.grafikCard}>
        <View style={s.grafikCardHeader}>
          <Text style={s.grafikTitle}>Haftalık Kalori</Text>
          {avgKcal > 0 && (
            <View style={[s.diffBadge, { backgroundColor: kcalDiff > 200 ? '#FEE2E2' : kcalDiff < -200 ? '#DBEAFE' : '#DCFCE7' }]}>
              <Text style={[s.diffBadgeText, { color: kcalDiff > 200 ? '#DC2626' : kcalDiff < -200 ? '#2563EB' : '#16A34A' }]}>
                Ort. {avgKcal} kcal
              </Text>
            </View>
          )}
        </View>
        <View style={s.barChartRow}>
          {weeklyData.map((day, i) => {
            const barH = (day.kcal / maxKcal) * 80;
            const isToday = i === 6;
            const overTarget = day.kcal > targetKcal * 1.1;
            const onTarget = day.kcal >= targetKcal * 0.9 && day.kcal <= targetKcal * 1.1;
            const barColor = day.kcal === 0 ? '#e8e8e8' : overTarget ? '#FCA5A5' : onTarget ? COLORS.brand.green : '#93C5FD';
            return (
              <View key={i} style={s.barCol}>
                <View style={s.barBg}>
                  <View style={[s.barTargetLine, { bottom: (targetKcal / maxKcal) * 80 }]} />
                  {barH > 0 && <View style={[s.barFill, { height: barH, backgroundColor: barColor }]} />}
                </View>
                <Text style={[s.barLabel, isToday && s.barLabelToday]}>{day.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={s.barLegendRow}>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: COLORS.brand.green }]} /><Text style={s.legendText}>Hedefe uygun</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#FCA5A5' }]} /><Text style={s.legendText}>Hedef üstü</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#93C5FD' }]} /><Text style={s.legendText}>Hedef altı</Text></View>
        </View>
      </View>

      {/* 2. Hedefe Uyum + Makro Tutarlılık */}
      <View style={s.twoColRow}>
        <View style={[s.grafikCard, { flex: 1 }]}>
          <Text style={s.grafikTitle}>Hedefe Uyum</Text>
          <Text style={s.grafikSub}>Bu hafta</Text>
          {adherenceScore === null ? (
            <View style={s.noDataBox}><Text style={s.noDataText}>Henüz sipariş yok</Text></View>
          ) : (
            <>
              <View style={s.scoreCircle}>
                <Text style={[s.scoreValue, {
                  color: adherenceScore >= 70 ? '#16A34A' : adherenceScore >= 40 ? '#F59E0B' : '#DC2626'
                }]}>{adherenceScore}%</Text>
              </View>
              <Text style={s.scoreLabel}>
                {adherenceScore >= 70 ? 'Harika!' : adherenceScore >= 40 ? 'İyi gidiyor' : 'Devam et'}
              </Text>
            </>
          )}
        </View>

        <View style={[s.grafikCard, { flex: 1 }]}>
          <Text style={s.grafikTitle}>Makro Tutarlılık</Text>
          <Text style={s.grafikSub}>7 günde kaç gün</Text>
          <View style={s.macroConsistencyList}>
            {[
              { label: 'Protein', days: macroConsistency.proteinDays, color: MACRO_COLORS.protein.main },
              { label: 'Karb', days: macroConsistency.carbsDays, color: MACRO_COLORS.carbs.main },
              { label: 'Yağ', days: macroConsistency.fatDays, color: MACRO_COLORS.fat.main },
            ].map(m => (
              <View key={m.label} style={s.macroConsistencyRow}>
                <View style={[s.macroConsistencyDot, { backgroundColor: m.color }]} />
                <Text style={s.macroConsistencyLabel}>{m.label}</Text>
                <View style={s.macroConsistencyTrack}>
                  <View style={[s.macroConsistencyFill, { width: `${(m.days / 7) * 100}%` as any, backgroundColor: m.color }]} />
                </View>
                <Text style={s.macroConsistencyDays}>{m.days}/7</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 3. Makro Dağılımı */}
      <View style={s.grafikCard}>
        <Text style={s.grafikTitle}>Makro Dağılımı</Text>
        <Text style={s.grafikSub}>Bu haftaki kalori dağılımı</Text>
        <View style={[s.macroBar, { marginTop: SPACING.sm, height: 14, borderRadius: RADIUS.xs }]}>
          <View style={[s.macroBarSegment, { flex: pK / tot, backgroundColor: MACRO_COLORS.protein.main }]} />
          <View style={[s.macroBarSegment, { flex: cK / tot, backgroundColor: MACRO_COLORS.carbs.main }]} />
          <View style={[s.macroBarSegment, { flex: fK / tot, backgroundColor: MACRO_COLORS.fat.main }]} />
        </View>
        <View style={s.macroDagRow}>
          {[
            { label: 'Protein', g: Math.round(weekTotals.protein), pct: Math.round((pK / tot) * 100), color: MACRO_COLORS.protein.main, target: targetProtein * 7 },
            { label: 'Karb', g: Math.round(weekTotals.carbs), pct: Math.round((cK / tot) * 100), color: MACRO_COLORS.carbs.main, target: targetCarbs * 7 },
            { label: 'Yağ', g: Math.round(weekTotals.fat), pct: Math.round((fK / tot) * 100), color: MACRO_COLORS.fat.main, target: targetFat * 7 },
          ].map(m => (
            <View key={m.label} style={s.macroDagCell}>
              <Text style={[s.macroDagPct, { color: m.color }]}>%{m.pct}</Text>
              <Text style={s.macroDagLabel}>{m.label}</Text>
              <Text style={s.macroDagG}>{m.g}g</Text>
              <Text style={s.macroDagTarget}>H: {m.target}g</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 4. Kilo Trendi */}
      <View style={s.grafikCard}>
        <Text style={s.grafikTitle}>Kilo Trendi</Text>
        <Text style={s.grafikSub}>Son ölçümler</Text>
        {weightTrend.length < 2 ? (
          <View style={s.noDataBox}>
            <Text style={s.noDataText}>Henüz yeterli ölçüm yok{'\n'}Hedef Düzenle'den kilo girin</Text>
          </View>
        ) : (
          (() => {
            const weights = weightTrend.map(w => w.weight_kg as number);
            const minW = Math.min(...weights) - 1;
            const maxW = Math.max(...weights) + 1;
            const chartW = 280;
            const chartH = 80;
            const points = weights.map((w, i) => ({
              x: (i / (weights.length - 1)) * chartW,
              y: chartH - ((w - minW) / (maxW - minW)) * chartH,
            }));
            const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
            const firstW = weights[0];
            const lastW = weights[weights.length - 1];
            const change = Math.round((lastW - firstW) * 10) / 10;
            return (
              <>
                <View style={{ alignItems: 'center', marginTop: SPACING.sm }}>
                  <Svg width={chartW} height={chartH + 10}>
                    <Polyline
                      points={polyline}
                      fill="none"
                      stroke={COLORS.brand.green}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((p, i) => (
                      <Circle key={i} cx={p.x} cy={p.y} r={3} fill={i === points.length - 1 ? '#000' : COLORS.brand.green} />
                    ))}
                  </Svg>
                </View>
                <View style={s.weightSummaryRow}>
                  <View style={s.weightSummaryCell}>
                    <Text style={s.weightSummaryLabel}>Başlangıç</Text>
                    <Text style={s.weightSummaryValue}>{firstW} kg</Text>
                  </View>
                  <View style={[s.weightChangeBadge, { backgroundColor: change < 0 ? '#DCFCE7' : change > 0 ? '#FEE2E2' : '#f0f0f0' }]}>
                    <Text style={[s.weightChangeText, { color: change < 0 ? '#16A34A' : change > 0 ? '#DC2626' : COLORS.text.tertiary }]}>
                      {change > 0 ? '+' : ''}{change} kg
                    </Text>
                  </View>
                  <View style={[s.weightSummaryCell, { alignItems: 'flex-end' }]}>
                    <Text style={s.weightSummaryLabel}>Son</Text>
                    <Text style={s.weightSummaryValue}>{lastW} kg</Text>
                  </View>
                </View>
              </>
            );
          })()
        )}
      </View>

      {/* 5. Beden Değişimi */}
      <View style={s.grafikCard}>
        <Text style={s.grafikTitle}>Beden Değişimi</Text>
        <Text style={s.grafikSub}>İlk ölçüm → Son ölçüm</Text>
        {measurements.length < 2 ? (
          <View style={s.noDataBox}>
            <Text style={s.noDataText}>Henüz yeterli ölçüm yok</Text>
          </View>
        ) : (
          <View style={s.bedenGrid}>
            {(() => {
              const oldest = [...measurements].reverse()[0];
              const newest = measurements[0];
              return [
                { label: 'Bel', key: 'waist_cm' as const, unit: 'cm' },
                { label: 'Kalça', key: 'hip_cm' as const, unit: 'cm' },
                { label: 'Göğüs', key: 'chest_cm' as const, unit: 'cm' },
              ].map(item => {
                const from = (oldest as any)[item.key] as number | null;
                const to = (newest as any)[item.key] as number | null;
                const d = from && to ? Math.round((to - from) * 10) / 10 : null;
                return (
                  <View key={item.label} style={s.bedenCell}>
                    <Text style={s.bedenLabel}>{item.label}</Text>
                    <Text style={s.bedenValue}>{to != null ? `${to} ${item.unit}` : '—'}</Text>
                    {d != null && d !== 0 && (
                      <View style={[s.bedenDiff, { backgroundColor: d < 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                        <Text style={[s.bedenDiffText, { color: d < 0 ? '#16A34A' : '#DC2626' }]}>
                          {d > 0 ? '+' : ''}{d} cm
                        </Text>
                      </View>
                    )}
                  </View>
                );
         });
            })()}
          </View>
        )}
      </View>

    </View>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'today',     label: 'Bugün' },
  { key: 'yesterday', label: 'Dün' },
  { key: 'week',      label: 'Son 7 Gün' },
  { key: 'last14',    label: 'Son 14 Gün' },
  { key: 'last30',    label: 'Son 30 Gün' },
];

export default function TrackerScreen() {
  const navigation = useNavigation<TrackerNavigationProp>();

  const { user } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();

  const [ui, dispatchUI] = useReducer(uiReducer, uiInitial);
  const [data, dispatchData] = useReducer(dataReducer, dataInitial);
  const [filters, dispatchFilter] = useReducer(filterReducer, filterInitial);
  const [mealForm, dispatchMealForm] = useReducer(mealFormReducer, mealFormInitial);

  // Destructure for convenience (avoids changing 200+ JSX references)
  const { viewMode, showStartPicker, showEndPicker, dataLoading, errorMessage, exportingPDF } = ui;
  const { orders, nutritionProfile, measurements, mealLogs, todayMacros, waterCount, consumedInstances } = data;
  const { selectedFilter, customStart, customEnd } = filters;

  const pantryItems = usePantryStore((state) => state.items);
  const removePantryItem = usePantryStore((state) => state.removeItem);

  const animValuesRef = useRef<Map<string, {
    scale: Animated.Value;
    bgFlash: Animated.Value;
    translateY: Animated.Value;
    opacity: Animated.Value;
  }>>(new Map());

  useEffect(() => {
    return () => {
      if (animValuesRef.current) {
        animValuesRef.current.forEach(anim => {
          anim.scale.stopAnimation();
          anim.bgFlash.stopAnimation();
          anim.translateY.stopAnimation();
          anim.opacity.stopAnimation();
        });
        animValuesRef.current.clear();
      }
    };
  }, []);

  // Meal form state destructured for JSX convenience
  const { visible: mealModalVisible, mealType, calories: mealCalories, note: mealNote, saving: mealSaving } = mealForm;

  const insets = useSafeAreaInsets();

  // Meal modal custom animation (backdrop fade + sheet slide, independent)
  const mealBackdropOpacity = useRef(new Animated.Value(0)).current;
  const mealSheetTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  useEffect(() => {
    const screenH = Dimensions.get('window').height;
    if (mealModalVisible) {
      Animated.parallel([
        Animated.timing(mealBackdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(mealSheetTranslateY, { toValue: 0, damping: 28, stiffness: 120, mass: 1, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(mealBackdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(mealSheetTranslateY, { toValue: screenH, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [mealModalVisible, mealBackdropOpacity, mealSheetTranslateY]);

  const fetchData = useCallback(
    async (filter: FilterType) => {
      if (!user) {
        dispatchUI({ type: 'SET_DATA_LOADING', payload: false });
        return;
      }

      dispatchUI({ type: 'SET_DATA_LOADING', payload: true });
      dispatchUI({ type: 'SET_ERROR_MESSAGE', payload: '' });

      try {
        const supabase = getSupabaseClient();
        const { start, end } = getFilterRange(filter);

        const [profileRes, ordersRes, measurementRes, mealLogsRes] = await Promise.all([
          supabase
            .from('user_nutrition_profiles')
            .select('target_calories,target_protein,target_carbs,target_fat,target_water')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('orders')
            .select('id,order_code,created_at,order_items(quantity,products(name,calories,protein,carbs,fats))')
            .eq('user_id', user.id)
            .eq('status', 'delivered')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false }),
          supabase
            .from('body_measurements')
            .select('date,weight_kg,waist_cm,hip_cm,chest_cm')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(30),
          supabase
            .from('meal_logs')
            .select('id,meal_type,calories,date')
            .eq('user_id', user.id)
            .eq('date', new Date().toISOString().split('T')[0]),
        ]);

        if (profileRes.data && !profileRes.error) {
          const p = profileRes.data as Record<string, unknown>;
          dispatchData({ type: 'SET_NUTRITION_PROFILE', payload: {
            target_calories: toNum(p.target_calories),
            target_protein: toNum(p.target_protein),
            target_carbs: toNum(p.target_carbs),
            target_fat: toNum(p.target_fat),
            target_water: p.target_water != null ? toNum(p.target_water) : null,
          } });
        } else {
          dispatchData({ type: 'SET_NUTRITION_PROFILE', payload: null });
        }

        if (ordersRes.error) throw ordersRes.error;

        dispatchData({ type: 'SET_ORDERS', payload:
          (Array.isArray(ordersRes.data) ? ordersRes.data : []).map(normalizeOrder),
        });

        if (measurementRes.data) {
          dispatchData({ type: 'SET_MEASUREMENTS', payload: measurementRes.data as any });
        }

        if (mealLogsRes.data) dispatchData({ type: 'SET_MEAL_LOGS', payload: mealLogsRes.data as any });

      } catch (error: unknown) {
        if (__DEV__) {
          console.warn(`[tracker] fetchData error: ${formatSupabaseErrorForDevLog(error)}`);
        }
        dispatchUI({ type: 'SET_ERROR_MESSAGE', payload: 'Veriler yüklenemedi. Lütfen tekrar deneyin.' });
      } finally {
        dispatchUI({ type: 'SET_DATA_LOADING', payload: false });
      }
    },
    [user],
  );

  // Test item temizliği — bir kez çalışır
  useEffect(() => {
    if (__DEV__) {
      usePantryStore.getState().items
        .filter(i => i.productId === 'test-1' || i.productId === 'test-real')
        .forEach(i => usePantryStore.getState().removeItem(i.id));
    }
  }, []);

  useEffect(() => {
    fetchData(selectedFilter);
  }, [fetchData, selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;

      const backfillPantry = async () => {
        try {
          const supabase = getSupabaseClient();
          const since = new Date();
          since.setDate(since.getDate() - 30);

          const { data, error } = await supabase
            .from('orders')
            .select(
              'id,order_code,delivered_at,order_items(id,product_id,product_name,quantity,products(name,calories,protein,carbs,fats,img))',
            )
            .eq('user_id', user.id)
            .eq('status', 'delivered')
            .not('delivered_at', 'is', null)
            .gte('delivered_at', since.toISOString())
            .order('delivered_at', { ascending: false });

          if (cancelled || error || !Array.isArray(data)) return;

          const candidates: Omit<PantryItem, 'id' | 'addedAt'>[] = [];
          for (const order of data as any[]) {
            const items = Array.isArray(order?.order_items) ? order.order_items : [];
            for (const oi of items) {
              const orderItemId = String(oi?.id ?? '').trim();
              if (!orderItemId) continue;

              const product = (oi?.products ?? {}) as Record<string, unknown>;
              const name = String(oi?.product_name || product?.name || 'Ürün').trim();
              const productId = String(oi?.product_id ?? (product as any)?.id ?? '');
              const quantity = Math.max(1, Math.floor(Number(oi?.quantity) || 1));

              candidates.push({
                productId,
                orderItemId,
                name,
                quantity,
                calories: Number(product?.calories) || 0,
                protein: Number(product?.protein) || 0,
                carbs: Number(product?.carbs) || 0,
                fat: Number((product as any)?.fats) || 0,
                imageUrl: (product as any)?.img ? String((product as any).img) : undefined,
              });
            }
          }

          if (!cancelled && candidates.length > 0) {
            usePantryStore.getState().addItemsFromOrders(candidates);
          }
        } catch (err) {
          if (__DEV__) {
            console.warn(`[tracker] pantry backfill failed: ${formatSupabaseErrorForDevLog(err)}`);
          }
        }
      };

      backfillPantry();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  const expandedItems = useMemo(() =>
    pantryItems.flatMap(item =>
      Array.from({ length: item.quantity }, (_, i) => ({
        ...item,
        instanceId: `${item.id}-${i}`,
        quantity: 1,
      }))
    ),
    [pantryItems]
  );

  const pantryConsumedMacros = useMemo(() =>
    expandedItems
      .filter(i => consumedInstances.has(i.instanceId))
      .reduce(
        (acc, i) => ({
          kcal: acc.kcal + i.calories,
          protein: acc.protein + i.protein,
          carbs: acc.carbs + i.carbs,
          fat: acc.fat + i.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [expandedItems, consumedInstances]
  );

  const displayMacros = useMemo(() => {
    const mealLogKcal = selectedFilter === 'today'
      ? mealLogs.reduce((s, m) => s + m.calories, 0)
      : 0;

    const base = selectedFilter === 'today'
      ? calculateTotalMacros(orders)
      : calculateAverageMacros(orders, selectedFilter);

    if (selectedFilter === 'today') {
      return {
        kcal: base.kcal + pantryConsumedMacros.kcal + mealLogKcal,
        protein: base.protein + pantryConsumedMacros.protein,
        carbs: base.carbs + pantryConsumedMacros.carbs,
        fat: base.fat + pantryConsumedMacros.fat,
      };
    }
    return base;
  }, [orders, selectedFilter, pantryConsumedMacros, mealLogs]);

  const handleToggleConsumed = (instanceId: string) => {
    const next = new Set(consumedInstances);
    if (next.has(instanceId)) next.delete(instanceId);
    else next.add(instanceId);
    dispatchData({ type: 'SET_CONSUMED_INSTANCES', payload: next });
  };

  const getAnimValues = (instanceId: string) => {
    if (!animValuesRef.current.has(instanceId)) {
      animValuesRef.current.set(instanceId, {
        scale: new Animated.Value(1),
        bgFlash: new Animated.Value(0),
        translateY: new Animated.Value(0),
        opacity: new Animated.Value(1),
      });
    }
    return animValuesRef.current.get(instanceId)!;
  };

  const handleTukettim = (instanceId: string) => {
    const anim = getAnimValues(instanceId);

    // bgFlash tamamen JS driver'da — diğer native animasyonlardan ayrı çalışır
    Animated.sequence([
      Animated.timing(anim.bgFlash, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(anim.bgFlash, { toValue: 0, duration: 100, useNativeDriver: false }),
    ]).start();

    // scale + translateY + opacity tamamen native driver'da
    Animated.sequence([
      Animated.timing(anim.scale, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.timing(anim.scale, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(anim.translateY, { toValue: 30, duration: 300, useNativeDriver: true }),
        Animated.timing(anim.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => {
      animValuesRef.current.delete(instanceId);
      handleToggleConsumed(instanceId);
    });
  };

  const handleDeletePantryItem = (itemId: string) => {
    Alert.alert(
      'Dolabından Kaldır',
      'Bu ürünü dolabınızdan kaldırmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: () => {
            const next = new Set(consumedInstances);
            for (const key of next) {
              if (key.startsWith(itemId)) next.delete(key);
            }
            dispatchData({ type: 'SET_CONSUMED_INSTANCES', payload: next });
            removePantryItem(itemId);
          },
        },
      ]
    );
  };

  const handleSaveMealLog = async () => {
    if (!user || !mealCalories) return;
    dispatchMealForm({ type: 'SET_SAVING', payload: true });
    try {
      const supabase = getSupabaseClient();
      const { data: row, error } = await supabase.from('meal_logs').insert({
        user_id: user.id,
        date: new Date().toISOString().split('T')[0],
        meal_type: mealType,
        calories: parseInt(mealCalories),
        note: mealNote || null,
      }).select().single();
      if (error) throw error;
      dispatchData({ type: 'APPEND_MEAL_LOG', payload: row as any });
      dispatchMealForm({ type: 'RESET_FORM' });
    } catch (e) {
      if (__DEV__) console.warn('meal log error:', e);
    } finally {
      dispatchMealForm({ type: 'SET_SAVING', payload: false });
    }
  };

  const timeline = useMemo(() => groupByDay(orders), [orders]);

  const weeklyData7 = useMemo(() => {
    const days: { label: string; kcal: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDayKey(d);
      const dayOrders = orders.filter(o => formatDayKey(new Date(o.created_at)) === key);
      const kcal = calculateTotalMacros(dayOrders).kcal;
      days.push({ label: WEEK_DAYS[(d.getDay() + 6) % 7], kcal, date: key });
    }
    return days;
  }, [orders]);

  const handleExportPDF = async () => {
    dispatchUI({ type: 'SET_EXPORTING_PDF', payload: true });
    try {
      // Rapor meta bilgileri
      const filterLabels: Record<string, string> = {
        today: 'Bugün', yesterday: 'Dün', week: 'Bu Hafta',
        month: 'Bu Ay', last14: 'Son 14 Gün', last30: 'Son 30 Gün',
      };
      const filterLabel = filterLabels[selectedFilter] || 'Seçili Dönem';
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Kullanıcı';
      const userEmail = user?.email || '—';

      const logoDataUrl = KCALCULATE_LOGO_B64;
      const activeDays = weeklyData7.filter((d: any) => d.kcal > 0);
      const avgKcal = activeDays.length > 0
        ? Math.round(activeDays.reduce((s: number, d: any) => s + d.kcal, 0) / activeDays.length)
        : 0;

      const newest = measurements[0];
      const oldest = measurements.length > 1 ? measurements[measurements.length - 1] : null;
      const weightChange = newest?.weight_kg && oldest?.weight_kg
        ? Math.round((newest.weight_kg - oldest.weight_kg) * 10) / 10
        : null;

const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { size: A4; margin: 60px 30px 40px 30px; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #ffffff; }
    body { font-family: -apple-system, 'Helvetica Neue', 'Arial', 'Segoe UI', sans-serif; background: #ffffff; color: #1a1a1a; font-size: 14px; padding: 50px 30px 40px 30px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { page-break-inside: auto; }
    tr    { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    .section { page-break-inside: avoid; }
    .measurements-section { page-break-inside: auto; break-inside: auto; }
    .measurements-section .section-title,
    .measurements-section thead {
      page-break-after: avoid;
      break-after: avoid;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 10px 30px;
      page-break-inside: avoid;
    }

    /* ── Header ── */
    .header {
      background: #ffffff;
      padding: 28px 32px 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      border-bottom: 3px solid COLORS.brand.green;
    }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .logo-img { height: 36px; object-fit: contain; }
    .header-title { color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; }
    .header-subtitle { color: #64748b; font-size: 13px; margin-top: 3px; }
    .header-right { text-align: right; }
    .date-range { color: #0f172a; font-size: 13px; font-weight: 800; }
    .created-label { color: #94a3b8; font-size: 11px; margin-top: 4px; }

    /* ── Müşteri bilgileri ── */
    .customer-bar {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 32px;
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
    }
    .customer-item { }
    .customer-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .customer-value { font-size: 16px; font-weight: 700; color: #1a1a1a; }

    /* ── İçerik ── */
    .content { padding: 20px 32px; }

    /* ── Section ── */
    .section { margin-bottom: 18px; }
    .section-title {
      font-size: 13px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.8px; color: #64748b;
      margin-bottom: 12px; padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }

    /* ── Kilo banner ── */
    .weight-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: 16px;
      padding: 16px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .weight-from { color: rgba(255,255,255,0.6); font-size: 13px; }
    .weight-arrow { color: COLORS.brand.green; font-size: 22px; font-weight: 900; padding: 0 12px; }
    .weight-to { color: #fff; font-size: 20px; font-weight: 900; }
    .weight-diff { border-radius: 100px; padding: 6px 14px; font-size: 13px; font-weight: 800; }
    .weight-diff.down { background: rgba(22,163,74,0.15); color: #16A34A; }
    .weight-diff.up   { background: rgba(220,38,38,0.15);  color: #DC2626; }
    .weight-diff.same { background: rgba(100,116,139,0.15); color: #64748b; }

    /* ── Grid kartlar ── */
    .grid { display: flex; gap: 12px; margin-bottom: 16px; }
    .card {
      flex: 1; background: #f8fafc; border-radius: 12px; padding: 12px 14px;
      border: 1px solid #e2e8f0;
    }
    .card-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .card-value { font-size: 24px; font-weight: 900; color: #0f172a; }
    .card-unit  { font-size: 13px; color: #64748b; margin-top: 4px; }
    .card-value.green { color: #16A34A; }
    .card-value.red   { color: #DC2626; }

    /* ── Kalori bar grafik ── */
    .bar-chart { margin-top: 16px; }
    .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .bar-label { font-size: 13px; color: #334155; width: 32px; text-align: right; font-weight: 600; }
    .bar-track { flex: 1; background: #f1f5f9; border-radius: 4px; height: 18px; overflow: hidden; }
    .bar-fill  { height: 100%; border-radius: 4px; background: COLORS.brand.green; }
    .bar-fill.over   { background: #FCA5A5; }
    .bar-fill.under  { background: #93C5FD; }
    .bar-fill.empty  { background: #e8e8e8; }
    .bar-value { font-size: 13px; color: #0f172a; font-weight: 700; width: 80px; }

    /* ── Makro bar ── */
    .macro-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .macro-name { font-size: 14px; color: #1a1a1a; width: 100px; font-weight: 700; }
    .macro-track { flex: 1; background: #f1f5f9; border-radius: 4px; height: 10px; overflow: hidden; }
    .macro-fill  { height: 100%; border-radius: 4px; }
    .macro-vals  { font-size: 14px; color: #0f172a; font-weight: 700; width: 100px; text-align: right; }

    /* ── Tablo ── */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #f8fafc; }
    th { padding: 9px 12px; font-weight: 700; text-align: left; color: #1a1a1a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; color: #1a1a1a; font-size: 13px; }
    tr:last-child td { border-bottom: none; }

    /* ── Footer ── */
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer-brand { font-size: 12px; font-weight: 800; color: #0f172a; }
    .footer-note  { font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>

  <!-- ── Header ── -->
  <div class="header">
    <div class="header-left">
      <img src="${KCALCULATE_LOGO_B64}" class="logo-img" alt="kcalculate" />
      <div>
        <div class="header-title">Geçmiş Beslenme Raporu Özeti</div>
        <div class="header-subtitle">eatkcal.com · Kcalculate</div>
      </div>
    </div>
    <div class="header-right">
      <div class="date-range">${filterLabel}</div>
      <div class="created-label">Oluşturulma: ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>

  <!-- ── Müşteri bilgileri ── -->
  <div class="customer-bar">
    <div class="customer-item">
      <div class="customer-label">İsim Soyisim</div>
      <div class="customer-value">${userName}</div>
    </div>
    <div class="customer-item">
      <div class="customer-label">E-posta</div>
      <div class="customer-value">${userEmail}</div>
    </div>
    <div class="customer-item">
      <div class="customer-label">Günlük Kalori Hedefi</div>
      <div class="customer-value">${nutritionProfile?.target_calories ?? '—'} kcal</div>
    </div>
    <div class="customer-item">
      <div class="customer-label">Rapor Dönemi</div>
      <div class="customer-value">${filterLabel}</div>
    </div>
  </div>

  <div class="content">

    <!-- ── Kilo değişimi ── -->
    ${weightChange !== null ? `
    <div class="weight-banner">
      <div>
        <div class="weight-from">${oldest?.weight_kg} kg başlangıç</div>
      </div>
      <div class="weight-arrow">→</div>
      <div class="weight-to">${newest?.weight_kg} kg</div>
      <div class="weight-diff ${weightChange < 0 ? 'down' : weightChange > 0 ? 'up' : 'same'}">
        ${weightChange > 0 ? '+' : ''}${weightChange} kg
      </div>
    </div>` : ''}

    <!-- ── Kalori özeti ── -->
    <div class="section">
      <div class="section-title">Kalori Özeti</div>
      <div class="grid">
        <div class="card">
          <div class="card-label">Ortalama Kalori</div>
          <div class="card-value">${avgKcal}</div>
          <div class="card-unit">kcal/gün</div>
        </div>
        <div class="card">
          <div class="card-label">Günlük Hedef</div>
          <div class="card-value">${nutritionProfile?.target_calories ?? '—'}</div>
          <div class="card-unit">kcal/gün</div>
        </div>
        <div class="card">
          <div class="card-label">Hedefe Fark</div>
          <div class="card-value ${avgKcal > (nutritionProfile?.target_calories ?? 0) ? 'red' : 'green'}">
            ${avgKcal > 0 && nutritionProfile?.target_calories
              ? `${avgKcal - nutritionProfile.target_calories > 0 ? '+' : ''}${avgKcal - nutritionProfile.target_calories}`
              : '—'}
          </div>
          <div class="card-unit">kcal</div>
        </div>
        <div class="card">
          <div class="card-label">Toplam Sipariş</div>
          <div class="card-value">${orders.length}</div>
          <div class="card-unit">sipariş</div>
        </div>
      </div>

      <!-- Günlük kalori bar chart -->
      ${weeklyData7.filter((d: any) => d.label).length > 0 ? `
      <div class="bar-chart">
        ${(() => {
          const data = weeklyData7;
          const maxKcal = Math.max(...data.map((d: any) => d.kcal), 1);
          return data.map((d: any) => `
            <div class="bar-row">
              <div class="bar-label">${d.label}</div>
              <div class="bar-track">
                <div class="bar-fill ${d.kcal === 0 ? 'empty' : d.kcal > (nutritionProfile?.target_calories ?? 0) * 1.1 ? 'over' : d.kcal >= (nutritionProfile?.target_calories ?? 0) * 0.9 ? '' : 'under'}" style="width: ${Math.round(d.kcal / maxKcal * 100)}%"></div>
              </div>
              <div class="bar-value">${d.kcal > 0 ? d.kcal + ' kcal' : '—'}</div>
            </div>
          `).join('');
        })()}
      </div>` : ''}
      <div style="display:flex;gap:16px;margin-top:8px;padding:12px 0;border-top:1px solid #f1f5f9;">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;">
          <div style="width:12px;height:12px;border-radius:3px;background:COLORS.brand.green;"></div> Hedefe uygun
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;">
          <div style="width:12px;height:12px;border-radius:3px;background:#FCA5A5;"></div> Hedef üstü
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;">
          <div style="width:12px;height:12px;border-radius:3px;background:#93C5FD;"></div> Hedef altı
        </div>
      </div>
    </div>

    <!-- ── Makro hedefleri ── -->
    <div class="section">
      <div class="section-title">Makro Hedefleri</div>
      ${(() => {
        const totals = calculateTotalMacros(orders);
        const days = Math.max(orders.length, 1);
        const macros = [
          { name: 'Protein',       val: Math.round(totals.protein/days), target: nutritionProfile?.target_protein ?? 0,  color: MACRO_COLORS.protein.main },
          { name: 'Karbonhidrat',  val: Math.round(totals.carbs/days),   target: nutritionProfile?.target_carbs ?? 0,    color: MACRO_COLORS.carbs.main },
          { name: 'Yağ',           val: Math.round(totals.fat/days),      target: nutritionProfile?.target_fat ?? 0,      color: MACRO_COLORS.fat.main },
        ];
        return macros.map(m => `
          <div class="macro-row">
            <div class="macro-name">${m.name}</div>
            <div class="macro-track">
              <div class="macro-fill" style="width:${m.target > 0 ? Math.min(Math.round(m.val/m.target*100),100) : 0}%; background:${m.color}"></div>
            </div>
            <div class="macro-vals">${m.val}g / ${m.target || '—'}g</div>
          </div>
        `).join('');
      })()}
    </div>

    <!-- ── Vücut ölçümleri ── -->
    ${measurements.length > 0 ? `
    <div class="section measurements-section">
      <div class="section-title">Vücut Ölçümleri</div>
      <table>
        <thead><tr><th>Tarih</th><th>Kilo</th><th>Bel</th><th>Kalça</th><th>Göğüs</th></tr></thead>
        <tbody>
          ${measurements.slice(0, 5).map(m => `
            <tr>
              <td>${new Date(m.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td>${m.weight_kg != null ? m.weight_kg + ' kg' : '—'}</td>
              <td>${m.waist_cm != null ? m.waist_cm + ' cm' : '—'}</td>
              <td>${m.hip_cm != null ? m.hip_cm + ' cm' : '—'}</td>
              <td>${m.chest_cm != null ? m.chest_cm + ' cm' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : ''}

  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <div class="footer-brand">Kcalculate · eatkcal.com</div>
    <div class="footer-note">Rapor oluşturulma: ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>

</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Raporu Paylaş' });
    } catch (e) {
      if (__DEV__) console.warn('PDF export error:', e);
    } finally {
      dispatchUI({ type: 'SET_EXPORTING_PDF', payload: false });
    }
  };

  const targets = {
    kcal: nutritionProfile?.target_calories ?? 2000,
    protein: nutritionProfile?.target_protein ?? 120,
    carbs: nutritionProfile?.target_carbs ?? 250,
    fat: nutritionProfile?.target_fat ?? 65,
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color={COLORS.brand.green} size="large" />
  </View>;
  if (!isAuthenticated) return null;

  return (
    <ScreenContainer edges={['top']} style={s.container}>
      {/* ── Kalori Ekle Modal ── */}
      <Modal
        visible={mealModalVisible}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={() => dispatchMealForm({ type: 'SET_VISIBLE', payload: false })}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: mealBackdropOpacity }]}>
            <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => dispatchMealForm({ type: 'SET_VISIBLE', payload: false })} />
          </Animated.View>
          <Animated.View style={[s.modalSheet, { paddingBottom: Math.max(40, insets.bottom + 24), transform: [{ translateY: mealSheetTranslateY }] }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Kalori Ekle</Text>
            <Text style={s.modalSub}>Bugün tükettiğin kaloriyi gir</Text>
            <View style={s.mealTypeRow}>
              {([
                { key: 'kahvalti', label: '🌅 Kahvaltı' },
                { key: 'ogle', label: '☀️ Öğle' },
                { key: 'aksam', label: '🌙 Akşam' },
                { key: 'atistirma', label: '🍎 Atıştırma' },
              ] as const).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.mealTypeBtn, mealType === opt.key && s.mealTypeBtnActive]}
                  onPress={() => dispatchMealForm({ type: 'SET_MEAL_TYPE', payload: opt.key })}
                  activeOpacity={0.8}
                >
                  <Text style={[s.mealTypeBtnText, mealType === opt.key && s.mealTypeBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.calorieInputWrapper}>
              <TextInput
                style={s.calorieInput}
                value={mealCalories}
                onChangeText={(v) => dispatchMealForm({ type: 'SET_CALORIES', payload: v })}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COLORS.text.tertiary}
                maxLength={5}
                autoFocus
              />
              <Text style={s.calorieInputUnit}>kcal</Text>
            </View>
            <TextInput
              style={s.mealNoteInput}
              value={mealNote}
              onChangeText={(v) => dispatchMealForm({ type: 'SET_NOTE', payload: v })}
              placeholder="Not ekle (opsiyonel) — örn: tavuk salata"
              placeholderTextColor={COLORS.text.tertiary}
              maxLength={80}
            />
            <TouchableOpacity
              style={[s.modalSaveBtn, (!mealCalories || mealSaving) && { opacity: 0.5 }]}
              onPress={handleSaveMealLog}
              disabled={!mealCalories || mealSaving}
              activeOpacity={0.85}
            >
              {mealSaving
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={s.modalSaveBtnText}>Kaydet</Text>
              }
            </TouchableOpacity>
            {mealLogs.length > 0 && (
              <View style={s.todayMealsSection}>
                <Text style={s.todayMealsTitle}>Bugün girildi</Text>
                {mealLogs.map(log => (
                  <View key={log.id} style={s.todayMealRow}>
                    <Text style={s.todayMealType}>
                      {log.meal_type === 'kahvalti' ? '🌅 Kahvaltı'
                        : log.meal_type === 'ogle' ? '☀️ Öğle'
                        : log.meal_type === 'aksam' ? '🌙 Akşam'
                        : '🍎 Atıştırma'}
                    </Text>
                    <Text style={s.todayMealKcal}>{log.calories} kcal</Text>
                  </View>
                ))}
                <View style={s.todayMealTotal}>
                  <Text style={s.todayMealTotalLabel}>Toplam</Text>
                  <Text style={s.todayMealTotalValue}>{mealLogs.reduce((sum, m) => sum + m.calories, 0)} kcal</Text>
                </View>
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Image
            source={require('../../assets/kcalculate-logo.png')}
            style={{ height: 56, width: 129 }}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
            <TouchableOpacity
              style={s.historyBtn}
              onPress={() => navigation.navigate('MeasurementHistory')}
              activeOpacity={0.8}
            >
              <Text style={s.historyBtnText}>Geçmiş</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => navigation.navigate('NutritionProfile')}
              activeOpacity={0.8}
            >
              <Text style={s.editBtnText}>Hedef Düzenle</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── View Mode Toggle ── */}
        <View style={s.toggleRow}>
          {([
            { id: 'ozet' as ViewMode, label: 'Özet', Icon: SquaresFour },
            { id: 'grafik' as ViewMode, label: 'Grafik', Icon: ChartBar },
          ] as { id: ViewMode; label: string; Icon: typeof SquaresFour }[]).map(({ id, label, Icon }) => (
            <TouchableOpacity
              key={id}
              style={[s.toggleBtn, viewMode === id && s.toggleBtnActive]}
              onPress={() => dispatchUI({ type: 'SET_VIEW_MODE', payload: id })}
              activeOpacity={0.8}
            >
              <Icon size={14} color="#000000" />
              <Text style={s.toggleBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Filter pills (sadece özet modda) ── */}
        {viewMode === 'ozet' && (
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: SPACING.xs, paddingHorizontal: SPACING.lg }}>
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[s.filterBtn, selectedFilter === opt.key && s.filterBtnActive]}
                onPress={() => dispatchFilter({ type: 'SET_SELECTED_FILTER', payload: opt.key })}
                activeOpacity={0.8}
              >
                <Text style={[s.filterText, selectedFilter === opt.key && s.filterTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {dataLoading ? (
          <View style={s.centered}>
            <ActivityIndicator color={COLORS.brand.green} size="large" />
          </View>
        ) : errorMessage ? (
          <View style={s.centered}>
            <Text style={s.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => fetchData(selectedFilter)}>
              <Text style={s.retryBtnText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'grafik' ? (
          <>
            <GrafikView
              orders={orders}
              nutritionProfile={nutritionProfile}
              measurements={measurements}
              onExportPDF={handleExportPDF}
              exportingPDF={exportingPDF}
            />
            <TouchableOpacity
              style={s.pdfBottomBtn}
              onPress={handleExportPDF}
              disabled={exportingPDF}
              activeOpacity={0.85}
            >
              {exportingPDF ? (
                <ActivityIndicator color={COLORS.brand.green} size="small" />
              ) : (
                <>
                  <FilePdf size={16} color={COLORS.brand.green} />
                  <Text style={s.pdfBottomBtnText}>Ücretsiz Beslenme Raporunu İndir</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* ── Pantry ── */}
            <View style={s.pantrySection}>
              <View style={s.pantrySectionHeader}>
                <Package size={14} color="#000000" />
                <Text style={s.pantrySectionTitle}>Dolabındakiler</Text>
                {expandedItems.filter(i => !consumedInstances.has(i.instanceId)).length > 0 && (
                  <Text style={s.pantrySectionSub}>
                    {expandedItems.filter(i => !consumedInstances.has(i.instanceId)).length} ürün bekliyor
                  </Text>
                )}
                <TouchableOpacity
                  style={s.addMealBtn}
                  onPress={() => dispatchMealForm({ type: 'SET_VISIBLE', payload: true })}
                  activeOpacity={0.8}
                >
                  <Plus size={12} color="#000000" />
                  <Text style={s.addMealBtnText}>Kalori Ekle</Text>
                </TouchableOpacity>
              </View>

              {expandedItems.filter(i => !consumedInstances.has(i.instanceId)).length === 0 ? (
                <View style={s.pantryEmptyBox}>
                  <Text style={s.pantryEmptyEmoji}>📦</Text>
                  <Text style={s.pantryEmptyTitle}>Dolabında hiç kcal öğünü yok</Text>
                  <Text style={s.pantryEmptySub}>Öğünsüz kalma, hemen sipariş ver!</Text>
                  <TouchableOpacity
                    style={s.pantryEmptyBtn}
                    onPress={() => navigation.navigate('Tabs', { screen: 'Home' } as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.pantryEmptyBtnText}>Ürünlere Gözat</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  keyboardShouldPersistTaps="handled"
                  data={expandedItems.filter(i => !consumedInstances.has(i.instanceId))}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.instanceId}
                  contentContainerStyle={s.pantryList}
                  renderItem={({ item }) => {
                    const anim = getAnimValues(item.instanceId);
                    // bgFlash yalnızca JS-driver overlay View'ında kullanılır
                    const flashOpacity = anim.bgFlash; // 0→1→0
                    return (
                      // Dış View: YALNIZCA native-driver props (scale, translateY, opacity)
                      <Animated.View style={[s.pantryCard, {
                        opacity: anim.opacity,
                        transform: [
                          { scale: anim.scale },
                          { translateY: anim.translateY },
                        ],
                      }]}>
                        {/* Yeşil flash overlay — ayrı Animated.View, YALNIZCA JS-driver */}
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            { borderRadius: RADIUS.md, backgroundColor: COLORS.brand.green, opacity: flashOpacity },
                          ]}
                        />
                        <TouchableOpacity
                          style={s.pantryDeleteBtn}
                          onPress={() => handleDeletePantryItem(item.id)}
                          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                        >
                          <Text style={s.pantryDeleteBtnText}>✕</Text>
                        </TouchableOpacity>
                        <View style={s.pantryImageBox}>
                          {item.imageUrl ? (
                            <CachedImage
                              uri={transformImageUrl(item.imageUrl, ImagePreset.productCard) ?? item.imageUrl}
                              style={{ width: 48, height: 48, borderRadius: RADIUS.sm }}
                            />
                          ) : (
                            <Text style={s.pantryImageFallback}>
                              {item.name.slice(0, 1).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text style={s.pantryName} numberOfLines={2}>{item.name}</Text>
                        <Text style={s.pantryKcal}>{item.calories} kcal</Text>
                        <TouchableOpacity
                          style={s.consumeBtn}
                          onPress={() => handleTukettim(item.instanceId)}
                          activeOpacity={0.8}
                        >
                          <CheckCircle size={12} color="#000000" />
                          <Text style={s.consumeBtnText}>Tükettim</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  }}
                />
              )}
            </View>

            {/* ── Big Calorie Ring ── */}
            <View style={s.calorieCard}>
              <BigCalorieRing current={displayMacros.kcal} target={targets.kcal} />
              <View style={s.miniStatsRow}>
                {[
                  { label: 'Hedef', value: targets.kcal },
                  { label: 'Tüketilen', value: Math.round(displayMacros.kcal) },
                  { label: 'Kalan', value: Math.max(targets.kcal - Math.round(displayMacros.kcal), 0) },
                ].map((stat, i, arr) => (
                  <View
                    key={stat.label}
                    style={[s.miniStat, i < arr.length - 1 && s.miniStatBorder]}
                  >
                    <Text style={s.miniStatValue}>{stat.value.toLocaleString()}</Text>
                    <Text style={s.miniStatLabel}>{stat.label}</Text>
                    <Text style={s.miniStatUnit}>kcal</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Macro Rings ── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Makrolar</Text>
                <Text style={s.sectionHint}>Detay için tıkla →</Text>
              </View>
              <View style={s.macroRingsRow}>
                <MacroRing
                  label="Karbonhidrat"
                  current={displayMacros.carbs}
                  target={targets.carbs}
                  color={MACRO_COLORS.carbs.main}
                  trackColor={MACRO_COLORS.carbs.track}
                  unit="g"
                  onPress={() => navigation.navigate('NutritionProfile')}
                />
                <MacroRing
                  label="Protein"
                  current={displayMacros.protein}
                  target={targets.protein}
                  color={MACRO_COLORS.protein.main}
                  trackColor={MACRO_COLORS.protein.track}
                  unit="g"
                  onPress={() => navigation.navigate('NutritionProfile')}
                />
                <MacroRing
                  label="Yağ"
                  current={displayMacros.fat}
                  target={targets.fat}
                  color={MACRO_COLORS.fat.main}
                  trackColor={MACRO_COLORS.fat.track}
                  unit="g"
                  onPress={() => navigation.navigate('NutritionProfile')}
                />
              </View>
            </View>

            {/* ── Water Tracker ── */}
            <View style={s.waterCard}>
              <View style={s.waterHeader}>
                <View style={s.waterTitleRow}>
                  <Text style={s.waterTitle}>Su Takibi</Text>
                  <AnimatedNumberText style={s.waterSub} value={`${waterCount} / 8 bardak · ${waterCount * 250}ml`} />
                </View>
                <TouchableOpacity
                  style={s.waterPlusBtn}
                  onPress={() => dispatchData({ type: 'SET_WATER_COUNT', payload: Math.min(waterCount + 1, 8) })}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color={COLORS.brand.green} />
                </TouchableOpacity>
              </View>
              <View style={s.waterBarsRow}>
                {Array.from({ length: 8 }, (_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.waterDropBtn}
                    onPress={() => dispatchData({ type: 'SET_WATER_COUNT', payload: i + 1 })}
                    activeOpacity={0.7}
                  >
                    <Drop
                      size={28}
                      color={i < waterCount ? '#000000' : 'rgba(0,0,0,0.2)'}
                      weight={i < waterCount ? 'fill' : 'regular'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Sipariş Geçmişi ── */}
            {orders.length === 0 ? (
              <View style={s.emptyState}>
                <ForkKnife size={56} color={COLORS.brand.green} weight="duotone" />
                <Text style={s.emptyTitle}>Henüz sipariş geçmişiniz yok</Text>
                <Text style={s.emptySub}>Teslim edilen siparişleriniz burada gösterilir.</Text>
                <TouchableOpacity
                  style={s.orderBtn}
                  onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
                  activeOpacity={0.85}
                >
                  <Text style={s.orderBtnText}>Sipariş Ver</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Sipariş Geçmişi</Text>
                {timeline.map((group) => (
                  <View key={group.dayKey} style={s.dayGroup}>
                    <View style={s.dayHeaderRow}>
                      <Text style={s.dayHeaderLabel}>{group.dayLabel}</Text>
                      <Text style={s.dayHeaderKcal}>{Math.round(group.macros.kcal)} kcal</Text>
                    </View>
                    {group.orders.map((order) => {
                      const om = calculateOrderMacros(order);
                      const itemNames = order.order_items
                        .map((i) => i.products?.name)
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <View key={order.id} style={s.orderCard}>
                          <View style={s.orderCardTop}>
                            <Text style={s.orderCode}>
                              {order.order_code ?? `#${order.id.slice(0, 8).toUpperCase()}`}
                            </Text>
                            <View style={s.orderKcalBadge}>
                              <Text style={s.orderKcalText}>{Math.round(om.kcal)} kcal</Text>
                            </View>
                          </View>
                          {itemNames ? (
                            <Text style={s.orderItems} numberOfLines={2}>{itemNames}</Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f6f6' },
  scroll: { paddingTop: 0, paddingBottom: 160 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: TYPOGRAPHY.size['3xl'], fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
  editBtn: {
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  editBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  historyBtn: {
    backgroundColor: '#f0f0f0',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  historyBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },

  // View mode toggle
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    backgroundColor: '#f6f6f6',
    borderRadius: RADIUS.pill,
    padding: 4,
    marginBottom: SPACING.md,
  },
  toggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  toggleBtnActive: {
    backgroundColor: '#ffffff',
    ...SHADOWS.sm,
  },
  toggleBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: '#000000' },

  // Date range picker
  dateRangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: '#f9f9f9', borderRadius: RADIUS.md, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
  },
  dateRangeBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  dateRangeBtnLabel: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.tertiary, textTransform: 'uppercase' },
  dateRangeBtnValue: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000', marginTop: 2 },
  dateRangeSep: { fontSize: TYPOGRAPHY.size.lg, color: COLORS.text.tertiary, fontWeight: '300',
fontFamily: 'PlusJakartaSans_400Regular'},
  dateRangeApply: {
    backgroundColor: COLORS.brand.green, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  dateRangeApplyText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000' },

  // Filter pills
  filterRow: {
    marginBottom: SPACING.md,
  },
  filterBtn: {
    height: 40,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  filterBtnActive: { backgroundColor: COLORS.brand.green },
  filterText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(0,0,0,0.5)' },
  filterTextActive: { color: '#000000', fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', opacity: 1 },

  // Loading / Error
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING['3xl'], minHeight: 200 },
  errorText: { color: '#B91C1C', fontSize: TYPOGRAPHY.size.md, textAlign: 'center', marginBottom: SPACING.md },
  retryBtn: { backgroundColor: COLORS.brand.green, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  retryBtnText: { color: '#000000', fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', fontSize: TYPOGRAPHY.size.md },

  // Calorie ring card
  calorieCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.xl,
    paddingTop: SPACING['2xl'],
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  ringWrapper: { alignItems: 'center' },
  ringAbsolute: { position: 'absolute', top: 0, left: 0 },
  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringKcal: { fontSize: TYPOGRAPHY.size['6xl'], fontWeight: TYPOGRAPHY.weight.black,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', lineHeight: 40 },
  ringKcalLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },
  ringBadge: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
  },
  ringBadgeText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  ringTargetLabel: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary, marginTop: SPACING.sm, textAlign: 'center' },
  ringTargetBold: { color: '#000000', fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},
  // Mini stats
  miniStatsRow: { flexDirection: 'row', width: '100%', marginTop: SPACING.xl },
  miniStat: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.xs },
  miniStatBorder: { borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.08)' },
  miniStatValue: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginBottom: 2 },
  miniStatLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },
  miniStatUnit: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },

  // Sections
  section: { marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, gap: SPACING.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  sectionHint: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },

  // Macro rings row
  macroRingsRow: { flexDirection: 'row', gap: SPACING.sm },
  macroRingCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  macroRingCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  macroRingDot: { width: 8, height: 8, borderRadius: 4 },
  macroRingValue: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
  macroRingInfo: { alignItems: 'center', width: '100%' },
  macroRingLabel: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginBottom: 2 },
  macroRingSubLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, marginBottom: SPACING.xs },
  macroRingTrack: { height: 4, borderRadius: RADIUS.pill, width: '100%', overflow: 'hidden' },
  macroRingFill: { height: '100%', borderRadius: RADIUS.pill },

  // Water tracker
  waterCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  waterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  waterTitleRow: { gap: 2 },
  waterTitle: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  waterSub: { fontSize: TYPOGRAPHY.size.xs, color: 'rgba(0,0,0,0.6)' },
  waterPlusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterBarsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  waterDropBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },

  // Grafik
  grafikContainer: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: '#1a1a1a', borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    alignSelf: 'flex-end', marginBottom: SPACING.xs,
  },
  pdfBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.brand.green },
  chartLegendRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm, flexWrap: 'wrap' },
  emptyHint: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary, textAlign: 'center', marginTop: SPACING.sm },
  twoColRow: { flexDirection: 'row', gap: SPACING.sm },
  grafikCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  diffBadge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  diffBadgeText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},
  barTargetLine: {
    position: 'absolute', left: 0, right: 0, height: 1.5,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  barLegendRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  scoreCircleWrapper: { alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.xs },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#f6f6f6', alignItems: 'center',
    justifyContent: 'center', alignSelf: 'center', marginVertical: SPACING.sm,
  },
  scoreValue: { fontSize: TYPOGRAPHY.size['2xl'], fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold'},
  scoreLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, textAlign: 'center' },
  macroConsistencyList: { gap: SPACING.xs, marginTop: SPACING.xs },
  macroConsistencyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  macroConsistencyDot: { width: 8, height: 8, borderRadius: 2 },
  macroConsistencyLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, width: 52, flexShrink: 0 },
  macroConsistencyTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#f0f0f0', overflow: 'hidden' },
  macroConsistencyFill: { height: '100%', borderRadius: 3 },
  macroConsistencyDays: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000', width: 20, textAlign: 'right' },
  macroConsistencyValue: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, width: 58, textAlign: 'right' },
  macroDagRow: { flexDirection: 'row', marginTop: SPACING.sm },
  macroDagCell: { flex: 1, alignItems: 'center', gap: 2 },
  macroDagPct: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold'},
  macroDagLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },
  macroDagG: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000' },
  macroDagTarget: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },
  weightSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  weightSummaryCell: { gap: 2 },
  weightSummaryLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },
  weightSummaryValue: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000' },
  weightSumCell: { flex: 1, alignItems: 'center', gap: 3 },
  weightSumLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary },
  weightSumValue: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },
  weightChangeBadge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  weightChangeText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold'},
  noDataBox: { paddingVertical: SPACING.xl, alignItems: 'center' },
  noDataText: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary, textAlign: 'center', lineHeight: 18 },
  bedenGrid: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  bedenCell: { flex: 1, alignItems: 'center', backgroundColor: '#f6f6f6', borderRadius: RADIUS.sm, padding: SPACING.sm, gap: SPACING.xs },
  bedenLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold'},
  bedenValue: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000' },
  bedenDiff: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  bedenDiffText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},
  grafikSub: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, marginBottom: SPACING.xs },
  pdfBottomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: '#000000', borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm, paddingVertical: SPACING.lg,
  },
  pdfBottomBtnText: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.brand.green },
  grafikCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  grafikTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginBottom: SPACING.md },
  barChartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.xs, height: 100 },
  barCol: { flex: 1, alignItems: 'center', gap: SPACING.xs },
  barBg: { flex: 1, width: '100%', justifyContent: 'flex-end', backgroundColor: '#f0f0f0', borderRadius: RADIUS.xs, overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: RADIUS.xs },
  barLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium'},
  barLabelToday: { color: '#000000', fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},
  barKcal: { fontSize: 8, color: COLORS.text.tertiary, textAlign: 'center' },
  macroBar: { flexDirection: 'row', height: 12, borderRadius: RADIUS.pill, overflow: 'hidden', marginBottom: SPACING.sm },
  macroBarSegment: { height: '100%' },
  macroLegend: { flexDirection: 'row', gap: SPACING.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary },

  // Day groups
  dayGroup: { gap: SPACING.xs, marginBottom: SPACING.sm },
  dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xs, marginTop: SPACING.xs },
  dayHeaderLabel: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', textTransform: 'capitalize' },
  dayHeaderKcal: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold'},
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    padding: 13,
    ...SHADOWS.sm,
  },
  orderCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderCode: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  orderKcalBadge: { backgroundColor: '#f0f0f0', borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  orderKcalText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  orderItems: { marginTop: SPACING.xs, fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.secondary, lineHeight: 17 },

  // Pantry
  pantrySection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    ...SHADOWS.sm,
  },
  pantrySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  pantrySectionTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    flex: 1,
  },
  pantrySectionSub: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
  },
  pantryList: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  pantryCard: {
    width: 100,
    backgroundColor: '#f6f6f6',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    gap: 5,
  },
  pantryImageBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pantryImageFallback: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.tertiary,
  },
  pantryName: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 14,
  },
  pantryKcal: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
    fontWeight: TYPOGRAPHY.weight.medium,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  consumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    marginTop: 2,
  },
  consumeBtnText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  consumeBtnActive: {
    backgroundColor: '#DCFCE7',
  },
  consumeBtnTextActive: {
    color: '#16A34A',
  },
  pantryCardConsumed: {
    opacity: 0.6,
  },
  pantryNameConsumed: {
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
  },
  pantryKcalConsumed: {
    color: COLORS.text.disabled,
  },
  pantryDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pantryDeleteBtnText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: '#333',
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  pantryEmptyBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  pantryEmptyEmoji: {
    fontSize: TYPOGRAPHY.size['6xl'],
    marginBottom: SPACING.sm,
  },
  pantryEmptyTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  pantryEmptySub: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  pantryEmptyBtn: {
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  pantryEmptyBtnText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  addMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    marginLeft: 'auto',
  },
  addMealBtnText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  // Meal log modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginTop: 12, marginBottom: SPACING.xl,
  },
  modalTitle: { fontSize: TYPOGRAPHY.size.xl, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000', marginBottom: SPACING.xs },
  modalSub: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary, marginBottom: SPACING.lg },
  mealTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  mealTypeBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: '#f0f0f0' },
  mealTypeBtnActive: { backgroundColor: COLORS.brand.green },
  mealTypeBtnText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary },
  mealTypeBtnTextActive: { color: '#000000' },
  calorieInputWrapper: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  calorieInput: {
    fontSize: 48, fontWeight: TYPOGRAPHY.weight.extrabold,
    fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000',
    textAlign: 'center', minWidth: 120,
  },
  calorieInputUnit: { fontSize: TYPOGRAPHY.size['2xl'], color: COLORS.text.tertiary, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold'},
  mealNoteInput: {
    backgroundColor: '#f6f6f6', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md, fontSize: TYPOGRAPHY.size.sm, color: '#000', marginBottom: SPACING.lg,
  },
  modalSaveBtn: {
    height: 56, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  modalSaveBtnText: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  todayMealsSection: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: SPACING.lg, gap: SPACING.sm },
  todayMealsTitle: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.tertiary },
  todayMealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayMealType: { fontSize: TYPOGRAPHY.size.sm, color: '#000000' },
  todayMealKcal: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  todayMealTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  todayMealTotalLabel: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  todayMealTotalValue: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.brand.green },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: SPACING['3xl'], paddingHorizontal: SPACING['2xl'] },
  emptyIcon: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginBottom: SPACING.xs, textAlign: 'center' },
  emptySub: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 19, marginBottom: SPACING.lg },
  orderBtn: { backgroundColor: COLORS.brand.green, borderRadius: RADIUS.pill, paddingHorizontal: 28, paddingVertical: SPACING.md },
  orderBtnText: { color: '#000000', fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', fontSize: TYPOGRAPHY.size.md },

});
