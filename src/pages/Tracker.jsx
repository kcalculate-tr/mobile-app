import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Beef, Droplet, Flame, SlidersHorizontal, Wheat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../supabase';
import { AuthContext } from '../context/AuthContext';
import MacroProfileModal from '../components/MacroProfileModal';

const DEFAULT_GOALS = {
  kcal: 2000,
  protein: 120,
  carbs: 220,
  fats: 70,
};

const DEFAULT_NUTRITION_PROFILE_FORM = {
  gender: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 70,
  goal: 'maintain',
  targets: {
    kcal: 2000,
    protein: 120,
    carbs: 220,
    fats: 70,
  },
};

const MACRO_CONFIG = {
  kcal: { label: 'Kalori', suffix: 'kcal', color: '#F97316', icon: Flame },
  protein: { label: 'Protein', suffix: 'g', color: '#3B82F6', icon: Beef },
  carbs: { label: 'Karb', suffix: 'g', color: '#EAB308', icon: Wheat },
  fats: { label: 'Yağ', suffix: 'g', color: '#EF4444', icon: Droplet },
};

const TRACKER_FILTER_OPTIONS = [
  { key: 'today', label: 'Bugün' },
  { key: 'last_7_days', label: 'Son 7 Gün' },
  { key: 'this_month', label: 'Bu Ay' },
  { key: 'custom', label: 'Tarih Aralığı' },
];

const HISTORY_PROGRESS_STYLES = {
  kcal: { bar: 'bg-orange-500', track: 'bg-orange-100' },
  protein: { bar: 'bg-blue-500', track: 'bg-blue-100' },
  carbs: { bar: 'bg-yellow-400', track: 'bg-yellow-100' },
  fats: { bar: 'bg-red-400', track: 'bg-red-100' },
};

const HISTORY_LIST_VARIANTS = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

const HISTORY_CARD_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeRound(value) {
  return Math.max(0, Math.round(toNumber(value)));
}

function clampPercent(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function normalizeOrderStatus(statusRaw) {
  const status = String(statusRaw || '').toLocaleLowerCase('tr-TR');
  if (!status) return 'pending';
  if (status === 'teslim_edildi' || status === 'delivered') return 'delivered';
  if (status.includes('teslim')) return 'delivered';
  if (status.includes('cancel') || status.includes('iptal')) return 'cancelled';
  if (status.includes('hazır') || status.includes('hazirlaniyor')) return 'preparing';
  if (status.includes('yol')) return 'on_way';
  return 'pending';
}

function isMissingColumnError(error, columnName) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLocaleLowerCase('tr-TR');
  const target = String(columnName || '').toLocaleLowerCase('tr-TR');
  if (code !== '42703') return false;
  return target ? message.includes(target) : true;
}

function getMissingColumnName(errorObj) {
  const text = `${errorObj?.message || ''} ${errorObj?.details || ''}`;
  const patterns = [
    /could not find the ['"]([a-zA-Z0-9_]+)['"]\s+column/i,
    /column\s+"([a-zA-Z0-9_]+)"/i,
    /['"]([a-zA-Z0-9_]+)['"]\s+column/i,
    /\bcolumn\s+([a-zA-Z0-9_]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim();
    if (!candidate) continue;
    if (['of', 'in', 'the'].includes(candidate.toLowerCase())) continue;
    return candidate;
  }

  return '';
}

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildFilterRange(selectedFilter, customStartDate, customEndDate) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  if (selectedFilter === 'last_7_days') {
    const start = new Date(todayStart);
    start.setDate(todayStart.getDate() - 6);
    return {
      label: 'Son 7 Gün',
      start,
      endExclusive: tomorrowStart,
    };
  }

  if (selectedFilter === 'this_month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return {
      label: 'Bu Ay',
      start: monthStart,
      endExclusive: tomorrowStart,
    };
  }

  if (selectedFilter === 'custom') {
    const startRaw = parseDateInputValue(customStartDate);
    const endRaw = parseDateInputValue(customEndDate);
    const start = startRaw || todayStart;
    const safeEndBase = endRaw || start;
    const safeEnd = new Date(safeEndBase.getFullYear(), safeEndBase.getMonth(), safeEndBase.getDate() + 1, 0, 0, 0, 0);
    return {
      label: 'Tarih Aralığı',
      start: start <= safeEnd ? start : todayStart,
      endExclusive: start <= safeEnd ? safeEnd : tomorrowStart,
    };
  }

  return {
    label: 'Bugün',
    start: todayStart,
    endExclusive: tomorrowStart,
  };
}

function buildMacroDistribution(values) {
  const protein = Math.max(0, toNumber(values?.protein, 0));
  const carbs = Math.max(0, toNumber(values?.carbs, 0));
  const fats = Math.max(0, toNumber(values?.fats, 0));
  const total = protein + carbs + fats;

  if (total <= 0) {
    return {
      total,
      proteinPct: 0,
      carbsPct: 0,
      fatsPct: 0,
    };
  }

  return {
    total,
    proteinPct: Math.min(100, (protein / total) * 100),
    carbsPct: Math.min(100, (carbs / total) * 100),
    fatsPct: Math.min(100, (fats / total) * 100),
  };
}

function toDateLabel(dayKey) {
  const parsed = new Date(`${dayKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dayKey;
  return parsed.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    weekday: 'short',
  });
}

function getOrderDate(order) {
  const raw = order?.delivered_at || order?.created_at || '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildEmptyMacroTotals() {
  return { kcal: 0, protein: 0, carbs: 0, fats: 0 };
}

function readItemMacros(item) {
  return {
    kcal: toNumber(item?.cal ?? item?.kcal ?? item?.calories, 0),
    protein: toNumber(item?.protein, 0),
    carbs: toNumber(item?.carbs, 0),
    fats: toNumber(item?.fats ?? item?.fat, 0),
  };
}

function sumMacrosInto(target, item) {
  const quantityRaw = toNumber(item?.quantity, 1);
  const quantity = quantityRaw > 0 ? quantityRaw : 1;
  const perUnit = readItemMacros(item);
  target.kcal += perUnit.kcal * quantity;
  target.protein += perUnit.protein * quantity;
  target.carbs += perUnit.carbs * quantity;
  target.fats += perUnit.fats * quantity;
}

function extractGoalsFromSource(source) {
  const raw = source && typeof source === 'object' ? source : {};
  const nested = raw.nutrition_goals && typeof raw.nutrition_goals === 'object'
    ? raw.nutrition_goals
    : {};

  const read = (keys, fallback = 0) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null) return toNumber(raw[key], fallback);
      if (nested[key] !== undefined && nested[key] !== null) return toNumber(nested[key], fallback);
    }
    return fallback;
  };

  return {
    kcal: read(['daily_goal_kcal', 'calorie_goal', 'calories_goal', 'kcal_goal', 'daily_calorie_target']),
    protein: read(['protein_goal', 'daily_protein_goal']),
    carbs: read(['carbs_goal', 'daily_carbs_goal', 'carbohydrate_goal']),
    fats: read(['fats_goal', 'fat_goal', 'daily_fats_goal']),
  };
}

function mergeGoalsWithFallback(base, incoming) {
  return {
    kcal: toNumber(incoming?.kcal, 0) > 0 ? safeRound(incoming.kcal) : base.kcal,
    protein: toNumber(incoming?.protein, 0) > 0 ? safeRound(incoming.protein) : base.protein,
    carbs: toNumber(incoming?.carbs, 0) > 0 ? safeRound(incoming.carbs) : base.carbs,
    fats: toNumber(incoming?.fats, 0) > 0 ? safeRound(incoming.fats) : base.fats,
  };
}

function isRecoverableOrderFilterError(error, columnName) {
  if (isMissingColumnError(error, columnName)) return true;

  const code = String(error?.code || '');
  const errorText = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  const target = String(columnName || '').toLowerCase();

  if (['22P02', '42804', '42883'].includes(code)) return true;
  if (code === '42P01' || code === 'PGRST205') return true;
  if (errorText.includes('invalid input syntax')) return true;
  if (errorText.includes('operator does not exist')) return true;
  if (target && errorText.includes(target) && errorText.includes('does not exist')) return true;

  return false;
}

async function fetchOrdersWithFallback(selectFilter) {
  let selectColumns = ['id', 'status', 'created_at', 'delivered_at', 'items'];
  let orderColumn = 'created_at';

  for (let i = 0; i < 15; i += 1) {
    if (selectColumns.length === 0) {
      return { data: [], skipped: true, error: null };
    }

    if (orderColumn && !selectColumns.includes(orderColumn)) {
      orderColumn = selectColumns.includes('id') ? 'id' : '';
    }

    let query = supabase
      .from('orders')
      .select(selectColumns.join(','))
      .limit(400);

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    if (selectFilter?.column && selectFilter?.value !== undefined && selectFilter?.value !== null && selectFilter?.value !== '') {
      query = query.eq(selectFilter.column, selectFilter.value);
    }

    const response = await query;
    if (!response.error) {
      return { data: Array.isArray(response.data) ? response.data : [], skipped: false, error: null };
    }

    const missing = getMissingColumnName(response.error);
    if (missing) {
      if (selectColumns.includes(missing)) {
        selectColumns = selectColumns.filter((column) => column !== missing);
        if (orderColumn === missing) {
          orderColumn = selectColumns.includes('id') ? 'id' : '';
        }
        continue;
      }
      if (orderColumn === missing) {
        orderColumn = selectColumns.includes('id') ? 'id' : '';
        continue;
      }
    }

    if (selectFilter?.column && isRecoverableOrderFilterError(response.error, selectFilter.column)) {
      return { data: [], skipped: true, error: response.error };
    }

    throw response.error;
  }

  return { data: [], skipped: true, error: null };
}

async function hydrateOrdersFromOrderItems(orders) {
  const sourceOrders = Array.isArray(orders) ? orders : [];
  if (sourceOrders.length === 0) return sourceOrders;

  const orderIds = sourceOrders
    .map((order) => order?.id)
    .filter((id) => id !== undefined && id !== null);

  if (orderIds.length === 0) return sourceOrders;

  const orderItemsRes = await supabase
    .from('order_items')
    .select('order_id,product_id,quantity,unit_price')
    .in('order_id', orderIds);

  if (orderItemsRes.error || !Array.isArray(orderItemsRes.data) || orderItemsRes.data.length === 0) {
    return sourceOrders;
  }

  const productIds = Array.from(new Set(
    orderItemsRes.data
      .map((item) => item?.product_id)
      .filter((id) => id !== undefined && id !== null)
      .map((id) => String(id))
  ));

  let productMap = new Map();
  if (productIds.length > 0) {
    const productsRes = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (!productsRes.error && Array.isArray(productsRes.data)) {
      productMap = new Map(productsRes.data.map((item) => [String(item?.id), item]));
    }
  }

  const groupedItemsByOrderId = new Map();
  orderItemsRes.data.forEach((row) => {
    const orderKey = String(row?.order_id || '');
    if (!orderKey) return;
    const product = productMap.get(String(row?.product_id || ''));
    const line = {
      id: row?.product_id ?? null,
      name: getProductNameForOrder(product),
      quantity: Math.max(1, toNumber(row?.quantity, 1)),
      price: toNumber(row?.unit_price, getProductPriceForOrder(product)),
      ...getProductMacrosForOrder(product),
      type: product?.type || 'meal',
    };

    if (!groupedItemsByOrderId.has(orderKey)) {
      groupedItemsByOrderId.set(orderKey, []);
    }
    groupedItemsByOrderId.get(orderKey).push(line);
  });

  return sourceOrders.map((order) => {
    const existingItems = Array.isArray(order?.items) ? order.items : [];
    if (existingItems.length > 0) return order;

    const hydrated = groupedItemsByOrderId.get(String(order?.id || ''));
    if (!hydrated || hydrated.length === 0) return order;

    return {
      ...order,
      items: hydrated,
    };
  });
}

function getProductNameForOrder(product) {
  return String(product?.name || product?.title || 'Ürün').trim();
}

function getProductPriceForOrder(product) {
  const amount = Number(product?.price ?? product?.unit_price ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getProductMacrosForOrder(product) {
  const price = getProductPriceForOrder(product);
  const fallbackKcal = Math.max(200, Math.round(price > 0 ? price * 8 : 320));
  const fallbackProtein = Math.max(14, Math.round(fallbackKcal * 0.22 / 4));
  const fallbackCarbs = Math.max(18, Math.round(fallbackKcal * 0.38 / 4));
  const fallbackFats = Math.max(7, Math.round(fallbackKcal * 0.28 / 9));

  const kcal = toNumber(product?.cal ?? product?.kcal ?? product?.calories, 0);
  const protein = toNumber(product?.protein, 0);
  const carbs = toNumber(product?.carbs, 0);
  const fats = toNumber(product?.fats ?? product?.fat, 0);

  return {
    cal: kcal > 0 ? kcal : fallbackKcal,
    protein: protein > 0 ? protein : fallbackProtein,
    carbs: carbs > 0 ? carbs : fallbackCarbs,
    fats: fats > 0 ? fats : fallbackFats,
  };
}

function extractNutritionProfileForm(row) {
  const source = row && typeof row === 'object' ? row : {};

  const readText = (keys, fallback = '') => {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return fallback;
  };

  const readNumber = (keys, fallback = 0) => {
    for (const key of keys) {
      const value = source[key];
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };

  const genderRaw = readText(['gender', 'sex'], DEFAULT_NUTRITION_PROFILE_FORM.gender).toLowerCase();
  const gender = genderRaw === 'female' || genderRaw === 'kadın' || genderRaw === 'kadin'
    ? 'female'
    : 'male';

  const goalRaw = readText(
    ['goal', 'goal_type', 'target_goal'],
    DEFAULT_NUTRITION_PROFILE_FORM.goal
  ).toLowerCase();

  let goal = 'maintain';
  if (goalRaw.includes('lose') || goalRaw.includes('ver')) goal = 'lose_weight';
  if (goalRaw.includes('gain') || goalRaw.includes('al') || goalRaw.includes('kas')) goal = 'gain_weight';
  if (goalRaw.includes('maintain') || goalRaw.includes('koru')) goal = 'maintain';

  return {
    gender,
    age: safeRound(readNumber(['age', 'age_years'], DEFAULT_NUTRITION_PROFILE_FORM.age)),
    heightCm: safeRound(readNumber(['height_cm', 'height'], DEFAULT_NUTRITION_PROFILE_FORM.heightCm)),
    weightKg: safeRound(readNumber(['weight_kg', 'weight'], DEFAULT_NUTRITION_PROFILE_FORM.weightKg)),
    goal,
    targets: {
      kcal: safeRound(readNumber(['daily_goal_kcal', 'calorie_goal', 'kcal_goal', 'daily_calorie_target'], DEFAULT_GOALS.kcal)),
      protein: safeRound(readNumber(['protein_goal', 'daily_protein_goal'], DEFAULT_GOALS.protein)),
      carbs: safeRound(readNumber(['carbs_goal', 'daily_carbs_goal', 'carbohydrate_goal'], DEFAULT_GOALS.carbs)),
      fats: safeRound(readNumber(['fats_goal', 'fat_goal', 'daily_fats_goal'], DEFAULT_GOALS.fats)),
    },
  };
}

function buildNutritionProfilePayload(userId, values) {
  return {
    user_id: userId,
    gender: values.gender,
    age: safeRound(values.age),
    height_cm: safeRound(values.heightCm),
    weight_kg: safeRound(values.weightKg),
    goal: values.goal,
    goal_type: values.goal,
    daily_goal_kcal: safeRound(values.targets?.kcal),
    protein_goal: safeRound(values.targets?.protein),
    carbs_goal: safeRound(values.targets?.carbs),
    fats_goal: safeRound(values.targets?.fats),
    updated_at: new Date().toISOString(),
  };
}

async function saveNutritionProfile(userId, payload) {
  const next = { ...payload };

  for (let i = 0; i < 30; i += 1) {
    if (Object.keys(next).length === 0) {
      throw new Error('Beslenme profili için yazılabilir alan bulunamadı.');
    }

    const upsertRes = await supabase
      .from('user_nutrition_profiles')
      .upsert(next, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();

    if (!upsertRes.error) {
      return upsertRes.data || next;
    }

    const missingColumn = getMissingColumnName(upsertRes.error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(next, missingColumn)) {
      delete next[missingColumn];
      continue;
    }

    const conflictMessage = String(upsertRes.error?.message || '').toLowerCase();
    if (String(upsertRes.error?.code || '') === '42P10' || conflictMessage.includes('on conflict')) {
      const updateRes = await supabase
        .from('user_nutrition_profiles')
        .update(next)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();

      if (!updateRes.error && updateRes.data) {
        return updateRes.data;
      }

      const updateMissingColumn = getMissingColumnName(updateRes.error);
      if (updateMissingColumn && Object.prototype.hasOwnProperty.call(next, updateMissingColumn)) {
        delete next[updateMissingColumn];
        continue;
      }

      const insertRes = await supabase
        .from('user_nutrition_profiles')
        .insert([next])
        .select('*')
        .maybeSingle();

      if (!insertRes.error) {
        return insertRes.data || next;
      }

      const insertMissingColumn = getMissingColumnName(insertRes.error);
      if (insertMissingColumn && Object.prototype.hasOwnProperty.call(next, insertMissingColumn)) {
        delete next[insertMissingColumn];
        continue;
      }

      throw insertRes.error;
    }

    throw upsertRes.error;
  }

  throw new Error('Beslenme profili kaydetme fallback limiti aşıldı.');
}

function RingChart({
  value,
  goal,
  color,
  size = 78,
  stroke = 7,
  centerTopText = '',
  centerValueText = '',
  centerBottomText = '',
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = clampPercent(value, goal);
  const dashOffset = circumference - ((percent / 100) * circumference);
  const viewBox = `0 0 ${size} ${size}`;
  const center = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={viewBox} className="h-full w-full -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#F0F0F0" strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerTopText && <p className="mb-0 text-[9px] font-semibold text-brand-dark/65">{centerTopText}</p>}
        {centerValueText && <p className="mb-0 text-xs font-extrabold leading-none text-brand-dark">{centerValueText}</p>}
        {centerBottomText && <p className="mb-0 mt-0.5 text-[9px] text-brand-dark/65">{centerBottomText}</p>}
      </div>
    </div>
  );
}

export default function Tracker() {
  const navigate = useNavigate();
  const { user, avatarUrl } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('Kullanıcı');
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [userProfile, setUserProfile] = useState(DEFAULT_NUTRITION_PROFILE_FORM);
  const [showMacroProfileModal, setShowMacroProfileModal] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [todayTotals, setTodayTotals] = useState(buildEmptyMacroTotals());
  const [timelineRows, setTimelineRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return formatDateInputValue(date);
  });
  const [customEndDate, setCustomEndDate] = useState(() => formatDateInputValue(new Date()));

  useEffect(() => {
    if (!user) return;
    const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Kullanıcı';
    setUserName(displayName);
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    async function fetchTrackerData() {
      setLoading(true);
      setError('');

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          navigate('/login');
          return;
        }

        if (!isMounted) return;
        const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Kullanıcı';
        setUserName(displayName);

        let resolvedGoals = { ...DEFAULT_GOALS };
        resolvedGoals = mergeGoalsWithFallback(resolvedGoals, extractGoalsFromSource(user?.user_metadata));
        try {
          const profileRes = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!profileRes.error && profileRes.data) {
            resolvedGoals = mergeGoalsWithFallback(resolvedGoals, extractGoalsFromSource(profileRes.data));
          }
        } catch {}

        try {
          const settingsRes = await supabase
            .from('settings')
            .select('*')
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (!settingsRes.error && settingsRes.data) {
            resolvedGoals = mergeGoalsWithFallback(resolvedGoals, extractGoalsFromSource(settingsRes.data));
          }
        } catch {}

        let nutritionProfileRow = null;
        try {
          const nutritionRes = await supabase
            .from('user_nutrition_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (nutritionRes.error) {
            throw nutritionRes.error;
          }

          nutritionProfileRow = nutritionRes.data || null;
          if (nutritionProfileRow) {
            resolvedGoals = mergeGoalsWithFallback(resolvedGoals, extractGoalsFromSource(nutritionProfileRow));
          }
        } catch (nutritionErr) {
          console.error('Beslenme profili alınamadı:', nutritionErr);
          nutritionProfileRow = null;
        }

        if (!isMounted) return;
        setUserProfile(
          nutritionProfileRow ? extractNutritionProfileForm(nutritionProfileRow) : DEFAULT_NUTRITION_PROFILE_FORM
        );
        setProfileSaveError('');
        setGoals(resolvedGoals);

        const numericUserId = Number(user.id);
        const attempts = [
          { column: 'customer_email', value: user.email },
          { column: 'user_id', value: user.id },
          { column: 'customer_id', value: user.id },
          ...(Number.isFinite(numericUserId)
            ? [
              { column: 'user_id', value: numericUserId },
              { column: 'customer_id', value: numericUserId },
            ]
            : []),
        ].filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');

        const collectedByOrderId = new Map();
        const errors = [];
        let anySuccessfulQuery = false;

        for (const attempt of attempts) {
          let response;
          try {
            response = await fetchOrdersWithFallback(attempt);
          } catch (attemptError) {
            errors.push(attemptError);
            continue;
          }

          if (!response.skipped) anySuccessfulQuery = true;
          if (response.error) {
            errors.push(response.error);
          }

          (response.data || []).forEach((row) => {
            const key = String(row?.id || '');
            if (!key) return;
            if (!collectedByOrderId.has(key)) {
              collectedByOrderId.set(key, row);
            }
          });
        }

        if (collectedByOrderId.size === 0) {
          try {
            const fallbackResponse = await fetchOrdersWithFallback(null);
            if (!fallbackResponse.skipped) anySuccessfulQuery = true;
            (fallbackResponse.data || []).forEach((row) => {
              const key = String(row?.id || '');
              if (!key) return;
              if (!collectedByOrderId.has(key)) {
                collectedByOrderId.set(key, row);
              }
            });
          } catch (fallbackError) {
            errors.push(fallbackError);
          }
        }

        if (!anySuccessfulQuery && errors.length > 0 && import.meta.env.DEV) {
          console.warn('Tracker sipariş sorguları recoverable hatalar verdi:', errors);
        }

        const ordersWithHydratedItems = await hydrateOrdersFromOrderItems(Array.from(collectedByOrderId.values()));

        const deliveredOrders = ordersWithHydratedItems.filter(
          (order) => normalizeOrderStatus(order?.status) === 'delivered'
        );

        const allDayTotalsMap = new Map();

        deliveredOrders.forEach((order) => {
          const orderDate = getOrderDate(order);
          if (!orderDate) return;
          const dayKey = formatDayKey(orderDate);
          const items = Array.isArray(order?.items) ? order.items : [];
          if (!allDayTotalsMap.has(dayKey)) {
            allDayTotalsMap.set(dayKey, buildEmptyMacroTotals());
          }

          const timelineTotals = allDayTotalsMap.get(dayKey);

          items.forEach((item) => {
            sumMacrosInto(timelineTotals, item);
          });
        });

        const nextTimelineRows = Array.from(allDayTotalsMap.entries())
          .map(([key, totals]) => ({
            key,
            kcal: safeRound(totals.kcal),
            protein: safeRound(totals.protein),
            carbs: safeRound(totals.carbs),
            fats: safeRound(totals.fats),
          }))
          .sort((a, b) => b.key.localeCompare(a.key));
        const nextHistoryRows = nextTimelineRows.slice(0, 7).map((row) => ({
          ...row,
          label: toDateLabel(row.key),
        }));

        const todayKey = formatDayKey(new Date());
        const today = allDayTotalsMap.get(todayKey) || buildEmptyMacroTotals();

        if (!isMounted) return;
        setTodayTotals({
          kcal: safeRound(today.kcal),
          protein: safeRound(today.protein),
          carbs: safeRound(today.carbs),
          fats: safeRound(today.fats),
        });
        setTimelineRows(nextTimelineRows);
        setHistoryRows(nextHistoryRows);
      } catch (err) {
        if (!isMounted) return;
        console.error('Tracker verisi alınamadı:', err);
        setError('Geçmiş tüketim bulunamadı.');
        setTodayTotals(buildEmptyMacroTotals());
        setTimelineRows([]);
        setHistoryRows([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchTrackerData();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleSaveNutritionProfile = useCallback(async (formValues) => {
    setProfileSaveError('');
    setProfileSaving(true);

    try {
      let userId = String(user?.id || '');
      if (!userId) {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          navigate('/login');
          return;
        }

        userId = String(authUser.id || '');
      }

      const payload = buildNutritionProfilePayload(userId, formValues);
      const saved = await saveNutritionProfile(userId, payload);
      const mergedSource = { ...payload, ...(saved && typeof saved === 'object' ? saved : {}) };

      setUserProfile(extractNutritionProfileForm(mergedSource));
      setGoals((prev) => mergeGoalsWithFallback(prev, extractGoalsFromSource(mergedSource)));
      return true;
    } catch (saveErr) {
      console.error('Beslenme profili kaydedilemedi:', saveErr);
      setProfileSaveError('Profil kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.');
      return false;
    } finally {
      setProfileSaving(false);
    }
  }, [navigate, user?.id]);

  const todayDateText = useMemo(() => (
    new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
  ), []);

  const activeFilterRange = useMemo(
    () => buildFilterRange(selectedFilter, customStartDate, customEndDate),
    [customEndDate, customStartDate, selectedFilter]
  );

  const filteredStats = useMemo(() => {
    const nextTotals = buildEmptyMacroTotals();
    if (selectedFilter === 'today') {
      const values = { ...todayTotals };
      return {
        values,
        distribution: buildMacroDistribution(values),
      };
    }

    if (Array.isArray(timelineRows) && timelineRows.length > 0) {
      timelineRows.forEach((row) => {
        const rowDate = parseDateInputValue(row.key);
        if (!rowDate) return;
        if (rowDate < activeFilterRange.start || rowDate >= activeFilterRange.endExclusive) return;
        nextTotals.kcal += toNumber(row.kcal, 0);
        nextTotals.protein += toNumber(row.protein, 0);
        nextTotals.carbs += toNumber(row.carbs, 0);
        nextTotals.fats += toNumber(row.fats, 0);
      });
    }

    const values = {
      kcal: safeRound(nextTotals.kcal),
      protein: safeRound(nextTotals.protein),
      carbs: safeRound(nextTotals.carbs),
      fats: safeRound(nextTotals.fats),
    };

    return {
      values,
      distribution: buildMacroDistribution(values),
    };
  }, [activeFilterRange.endExclusive, activeFilterRange.start, selectedFilter, timelineRows, todayTotals]);

  const remainingKcal = Math.max(goals.kcal - filteredStats.values.kcal, 0);
  const overKcal = Math.max(filteredStats.values.kcal - goals.kcal, 0);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-dark">
      <div className="mx-auto w-full max-w-[430px] min-h-screen px-4 pb-24">
        <div className="h-10 w-full" />

        <header className="sticky top-0 z-20 -mx-4 border-b border-brand-secondary bg-brand-bg/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-secondary bg-brand-white"
              aria-label="Geri"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-semibold text-brand-dark">Kalori Takibi</h1>
            <button
              type="button"
              onClick={() => setShowMacroProfileModal(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-secondary bg-brand-white"
              aria-label="Makro Profilini Güncelle"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </header>

        <section className="mt-4 flex items-center justify-between rounded-2xl border border-brand-secondary bg-brand-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-brand-dark">Merhaba, {userName}</p>
            <p className="mt-0.5 text-xs text-brand-dark/60 capitalize">{todayDateText}</p>
          </div>
          <div className="h-11 w-11 overflow-hidden rounded-full border border-brand-secondary bg-brand-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brand-primary text-sm font-bold text-brand-white">
                {(userName || 'K').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-brand-secondary bg-brand-white p-3 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/55">Zaman Çizelgesi</p>
          <div className="flex flex-wrap gap-2">
            {TRACKER_FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedFilter(option.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selectedFilter === option.key
                    ? 'bg-brand-primary text-brand-white'
                    : 'bg-brand-bg text-brand-dark/75'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {selectedFilter === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-brand-dark/65">Başlangıç</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full rounded-xl border border-brand-secondary/50 bg-brand-bg px-2.5 py-2 text-xs text-brand-dark"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-brand-dark/65">Bitiş</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full rounded-xl border border-brand-secondary/50 bg-brand-bg px-2.5 py-2 text-xs text-brand-dark"
                />
              </label>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-brand-secondary bg-brand-white p-5 shadow-sm">
          {loading ? (
            <div className="space-y-3">
              <div className="app-skeleton h-4 w-40" />
              <div className="app-skeleton mx-auto h-[210px] w-[210px] rounded-full" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((item) => (
                  <div key={`tracker-macro-skeleton-${item}`} className="app-skeleton h-24" />
                ))}
              </div>
            </div>
          ) : (
            <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-brand-dark/60">{activeFilterRange.label.toUpperCase()}</p>
              <h2 className="mt-1 text-xl font-bold text-brand-dark">Toplam Enerji</h2>
            </div>
            <span className="rounded-full border border-brand-secondary bg-brand-white px-2.5 py-1 text-[11px] font-bold text-brand-dark">
              Hedef: {goals.kcal} kcal / gün
            </span>
          </div>

          <div className="mt-4 flex justify-center">
            <RingChart
              value={filteredStats.values.kcal}
              goal={Math.max(filteredStats.values.kcal, 1)}
              color={MACRO_CONFIG.kcal.color}
              size={210}
              stroke={16}
              centerTopText={activeFilterRange.label}
              centerValueText={`${safeRound(filteredStats.values.kcal)} kcal`}
              centerBottomText={overKcal > 0 ? `Günlük hedef +${safeRound(overKcal)}` : `${safeRound(remainingKcal)} kcal kalan`}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {(['protein', 'carbs', 'fats']).map((key) => {
              const cfg = MACRO_CONFIG[key];
              const Icon = cfg.icon;
              const amount = safeRound(filteredStats.values[key]);
              const ratio = safeRound(
                key === 'protein'
                  ? filteredStats.distribution.proteinPct
                  : key === 'carbs'
                    ? filteredStats.distribution.carbsPct
                    : filteredStats.distribution.fatsPct
              );

              return (
                <div key={key} className="rounded-2xl border border-brand-secondary bg-brand-white p-2.5 text-center">
                  <div className="mb-2 flex justify-center">
                    <RingChart
                      value={ratio}
                      goal={100}
                      color={cfg.color}
                      size={62}
                      stroke={5}
                    />
                  </div>
                  <p className="mb-0 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark/75">
                    <Icon size={12} style={{ color: cfg.color }} />
                    {cfg.label}
                  </p>
                  <p className="mb-0 mt-1 text-[11px] font-bold text-brand-dark">
                    {amount}{cfg.suffix}
                  </p>
                  <p className="mb-0 mt-0.5 text-[10px] font-semibold text-brand-dark/70">%{ratio} dağılım</p>
                </div>
              );
            })}
          </div>
            </>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-brand-dark">Geçmiş Tüketim</h3>
            <span className="rounded-full border border-brand-secondary bg-brand-white px-2 py-1 text-[11px] font-bold text-brand-dark">
              Son 7 gün
            </span>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <div className="space-y-2.5">
                {[0, 1, 2].map((item) => (
                  <div key={`tracker-history-skeleton-${item}`} className="app-skeleton h-[84px]" />
                ))}
              </div>
            ) : historyRows.length === 0 ? (
              <div className="rounded-2xl border border-brand-secondary bg-brand-white p-4 text-center">
                <p className="mb-0 text-sm text-brand-dark/65">
                  {error
                    ? 'Geçmiş veriler alınamadı. Lütfen birazdan tekrar deneyin.'
                    : 'Henüz hiç öğün kaydı girmediniz. Günlük hedeflerinizi takip etmek için yediklerinizi eklemeye başlayın.'}
                </p>
              </div>
            ) : (
              <motion.div variants={HISTORY_LIST_VARIANTS} initial="hidden" animate="visible" className="space-y-2.5">
              {historyRows.map((row) => {
                const macroDistribution = buildMacroDistribution({
                  protein: row.protein,
                  carbs: row.carbs,
                  fats: row.fats,
                });

                return (
                  <motion.div
                    key={row.key}
                    variants={HISTORY_CARD_VARIANTS}
                    className="rounded-2xl border border-brand-secondary bg-brand-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="mb-0 text-sm font-bold text-brand-dark">{row.label}</p>
                      <p className="mb-0 text-sm font-extrabold text-brand-dark">{row.kcal} kcal</p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { key: 'protein', label: 'Prot', unit: 'g', value: row.protein },
                        { key: 'carbs', label: 'Karb', unit: 'g', value: row.carbs },
                        { key: 'fats', label: 'Yağ', unit: 'g', value: row.fats },
                      ].map((item) => {
                        const consumed = safeRound(item.value);
                        const ratioRaw = item.key === 'protein'
                          ? macroDistribution.proteinPct
                          : item.key === 'carbs'
                            ? macroDistribution.carbsPct
                            : macroDistribution.fatsPct;
                        const ratio = Math.max(0, Math.min(100, toNumber(ratioRaw, 0)));
                        const style = HISTORY_PROGRESS_STYLES[item.key];

                        return (
                          <div key={`${row.key}-${item.key}`} className="min-w-0">
                            <p className="mb-1 truncate text-[10px] font-semibold text-brand-dark/70">
                              {item.label}: {consumed}
                              {item.unit}
                            </p>
                            <div className={`h-1.5 w-full overflow-hidden rounded-full ${style.track}`}>
                              <div
                                className={`h-full rounded-full ${style.bar}`}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
              </motion.div>
            )}
          </div>
        </section>
      </div>

      <MacroProfileModal
        open={showMacroProfileModal}
        initialData={userProfile}
        saving={profileSaving}
        error={profileSaveError}
        onSave={handleSaveNutritionProfile}
        onClose={() => setShowMacroProfileModal(false)}
      />
    </div>
  );
}
