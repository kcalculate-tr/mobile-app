import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Beef, CalendarDays, Droplet, Flame, Footprints, Wheat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { AuthContext } from '../context/AuthContext';

const DEFAULT_GOALS = {
  kcal: 2000,
  protein: 120,
  carbs: 220,
  fats: 70,
};

const MACRO_CONFIG = {
  kcal: { label: 'Kalori', suffix: 'kcal', color: '#F97316', icon: Flame },
  protein: { label: 'Protein', suffix: 'g', color: '#3B82F6', icon: Beef },
  carbs: { label: 'Karb', suffix: 'g', color: '#EAB308', icon: Wheat },
  fats: { label: 'Yağ', suffix: 'g', color: '#EF4444', icon: Droplet },
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

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLastNDaysKeys(count = 7) {
  const now = new Date();
  const keys = [];
  for (let i = 0; i < count; i += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    keys.push(formatDayKey(day));
  }
  return keys;
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

function extractActivityFromSource(source) {
  const raw = source && typeof source === 'object' ? source : {};
  const read = (keys) => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null) return toNumber(raw[key], 0);
    }
    return 0;
  };

  return {
    waterMl: read(['water_ml', 'daily_water_ml', 'water', 'hydration_ml']),
    steps: read(['steps', 'daily_steps', 'step_count']),
  };
}

function mergeActivityWithFallback(base, incoming) {
  return {
    waterMl: toNumber(incoming?.waterMl, 0) > 0 ? safeRound(incoming.waterMl) : base.waterMl,
    steps: toNumber(incoming?.steps, 0) > 0 ? safeRound(incoming.steps) : base.steps,
  };
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
        {centerTopText && <p className="mb-0 text-[9px] font-semibold text-[#202020]/65">{centerTopText}</p>}
        {centerValueText && <p className="mb-0 text-xs font-extrabold leading-none text-[#202020]">{centerValueText}</p>}
        {centerBottomText && <p className="mb-0 mt-0.5 text-[9px] text-[#202020]/65">{centerBottomText}</p>}
      </div>
    </div>
  );
}

function MacroGrid({ values, goals }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.keys(MACRO_CONFIG).map((key) => {
        const config = MACRO_CONFIG[key];
        const Icon = config.icon;
        const amount = safeRound(values?.[key]);
        const goal = safeRound(goals?.[key]);

        return (
          <div key={key} className="rounded-2xl border border-[#82CD47] bg-brand-white p-3">
            <div className="flex items-center gap-3">
              <RingChart
                value={amount}
                goal={goal}
                color={config.color}
                size={44}
                stroke={4}
              />
              <div className="min-w-0">
                <p className="mb-0 text-[13px] font-extrabold leading-none text-[#202020]">
                  {amount}
                  {config.suffix}
                </p>
                <p className="mb-0 mt-1 inline-flex items-center gap-1 text-[11px] leading-none text-[#202020]/70">
                  <Icon size={12} style={{ color: config.color }} />
                  {config.label}
                </p>
              </div>
            </div>
          </div>
        );
      })}
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
  const [dailyActivity, setDailyActivity] = useState({ waterMl: 0, steps: 0 });
  const [todayTotals, setTodayTotals] = useState(buildEmptyMacroTotals());
  const [historyRows, setHistoryRows] = useState([]);

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
        let resolvedActivity = mergeActivityWithFallback({ waterMl: 0, steps: 0 }, extractActivityFromSource(user?.user_metadata));

        try {
          const profileRes = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!profileRes.error && profileRes.data) {
            resolvedGoals = mergeGoalsWithFallback(resolvedGoals, extractGoalsFromSource(profileRes.data));
            resolvedActivity = mergeActivityWithFallback(resolvedActivity, extractActivityFromSource(profileRes.data));
          }
        } catch {
          // no-op
        }

        try {
          const settingsRes = await supabase
            .from('settings')
            .select('*')
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (!settingsRes.error && settingsRes.data) {
            resolvedGoals = mergeGoalsWithFallback(resolvedGoals, extractGoalsFromSource(settingsRes.data));
            resolvedActivity = mergeActivityWithFallback(resolvedActivity, extractActivityFromSource(settingsRes.data));
          }
        } catch {
          // no-op
        }

        if (!isMounted) return;
        setGoals(resolvedGoals);
        setDailyActivity({
          waterMl: safeRound(resolvedActivity.waterMl),
          steps: safeRound(resolvedActivity.steps),
        });

        const dayKeys = getLastNDaysKeys(7);
        const attempts = [
          { column: 'user_id', value: user.id },
          { column: 'customer_id', value: user.id },
          { column: 'customer_email', value: user.email },
        ].filter((item) => item.value);

        const collectedByOrderId = new Map();
        const errors = [];
        let anySuccessfulQuery = false;

        for (const attempt of attempts) {
          let query = supabase
            .from('orders')
            .select('id,status,created_at,delivered_at,items')
            .eq(attempt.column, attempt.value)
            .order('created_at', { ascending: false })
            .limit(400);

          const response = await query;
          if (response.error) {
            if (isMissingColumnError(response.error, attempt.column)) {
              continue;
            }
            errors.push(response.error);
            continue;
          }

          anySuccessfulQuery = true;
          (response.data || []).forEach((row) => {
            const key = String(row?.id || '');
            if (!key) return;
            if (!collectedByOrderId.has(key)) {
              collectedByOrderId.set(key, row);
            }
          });
        }

        if (!anySuccessfulQuery && errors.length > 0) {
          throw errors[0];
        }

        const deliveredOrders = Array.from(collectedByOrderId.values()).filter(
          (order) => normalizeOrderStatus(order?.status) === 'delivered'
        );

        const dayTotalsMap = new Map();
        dayKeys.forEach((key) => dayTotalsMap.set(key, buildEmptyMacroTotals()));

        deliveredOrders.forEach((order) => {
          const orderDate = getOrderDate(order);
          if (!orderDate) return;
          const dayKey = formatDayKey(orderDate);
          const existing = dayTotalsMap.get(dayKey);
          if (!existing) return;

          const items = Array.isArray(order?.items) ? order.items : [];
          items.forEach((item) => {
            sumMacrosInto(existing, item);
          });
        });

        const todayKey = dayKeys[0];
        const today = dayTotalsMap.get(todayKey) || buildEmptyMacroTotals();

        const nextHistoryRows = dayKeys.map((key) => {
          const totals = dayTotalsMap.get(key) || buildEmptyMacroTotals();
          return {
            key,
            label: toDateLabel(key),
            kcal: safeRound(totals.kcal),
            protein: safeRound(totals.protein),
            carbs: safeRound(totals.carbs),
            fats: safeRound(totals.fats),
          };
        });

        if (!isMounted) return;
        setTodayTotals({
          kcal: safeRound(today.kcal),
          protein: safeRound(today.protein),
          carbs: safeRound(today.carbs),
          fats: safeRound(today.fats),
        });
        setHistoryRows(nextHistoryRows);
      } catch (err) {
        if (!isMounted) return;
        console.error('Tracker verisi alınamadı:', err);
        setError('Geçmiş tüketim bulunamadı.');
        setDailyActivity({ waterMl: 0, steps: 0 });
        setTodayTotals(buildEmptyMacroTotals());
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

  const todayDateText = useMemo(() => (
    new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
  ), []);

  const remainingKcal = Math.max(goals.kcal - todayTotals.kcal, 0);
  const overKcal = Math.max(todayTotals.kcal - goals.kcal, 0);

  return (
    <div className="min-h-screen bg-[#F0F0F0] text-[#202020]">
      <div className="mx-auto w-full max-w-[430px] min-h-screen px-4 pb-24">
        <div className="h-10 w-full" />

        <header className="sticky top-0 z-20 -mx-4 border-b border-[#82CD47] bg-[#F0F0F0]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#82CD47] bg-brand-white"
              aria-label="Geri"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-semibold text-[#202020]">Kalori Takibi</h1>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#82CD47] bg-brand-white">
              <CalendarDays size={18} />
            </div>
          </div>
        </header>

        <section className="mt-4 flex items-center justify-between rounded-2xl border border-[#82CD47] bg-brand-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-[#202020]">Merhaba, {userName}</p>
            <p className="mt-0.5 text-xs text-[#202020]/60 capitalize">{todayDateText}</p>
          </div>
          <div className="h-11 w-11 overflow-hidden rounded-full border border-[#82CD47] bg-brand-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#98CD00] text-sm font-bold text-brand-white">
                {(userName || 'K').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[#82CD47] bg-brand-white px-3 py-2.5 shadow-sm">
            <p className="mb-0 text-[11px] font-semibold text-[#202020]/65">Bugünkü Su</p>
            <p className="mt-1 mb-0 inline-flex items-center gap-1 text-sm font-bold text-[#202020]">
              <Droplet size={14} className="text-[#3B82F6]" />
              {safeRound(dailyActivity.waterMl)} ml
            </p>
          </div>
          <div className="rounded-2xl border border-[#82CD47] bg-brand-white px-3 py-2.5 shadow-sm">
            <p className="mb-0 text-[11px] font-semibold text-[#202020]/65">Bugünkü Adım</p>
            <p className="mt-1 mb-0 inline-flex items-center gap-1 text-sm font-bold text-[#202020]">
              <Footprints size={14} className="text-[#98CD00]" />
              {safeRound(dailyActivity.steps)}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-[#82CD47] bg-brand-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-[#202020]/60">BUGÜNKÜ HEDEF</p>
              <h2 className="mt-1 text-xl font-bold text-[#202020]">Kalan Kalori</h2>
            </div>
            <span className="rounded-full border border-[#82CD47] bg-brand-white px-2.5 py-1 text-[11px] font-bold text-[#202020]">
              Hedef: {goals.kcal} kcal
            </span>
          </div>

          <div className="mt-4 flex justify-center">
            <RingChart
              value={todayTotals.kcal}
              goal={goals.kcal}
              color={MACRO_CONFIG.kcal.color}
              size={210}
              stroke={16}
              centerTopText="Kalan"
              centerValueText={`${safeRound(remainingKcal)} kcal`}
              centerBottomText={overKcal > 0 ? `Hedef +${safeRound(overKcal)}` : `${safeRound(todayTotals.kcal)} / ${goals.kcal}`}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {(['protein', 'carbs', 'fats']).map((key) => {
              const cfg = MACRO_CONFIG[key];
              const Icon = cfg.icon;
              const amount = safeRound(todayTotals[key]);
              const goal = safeRound(goals[key]);

              return (
                <div key={key} className="rounded-2xl border border-[#82CD47] bg-brand-white p-2.5 text-center">
                  <div className="mb-2 flex justify-center">
                    <RingChart
                      value={amount}
                      goal={goal}
                      color={cfg.color}
                      size={62}
                      stroke={5}
                    />
                  </div>
                  <p className="mb-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#202020]/75">
                    <Icon size={12} style={{ color: cfg.color }} />
                    {cfg.label}
                  </p>
                  <p className="mb-0 mt-1 text-[11px] font-bold text-[#202020]">
                    {amount} / {goal}
                    {cfg.suffix}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-base font-bold text-[#202020]">Bugünkü Makro Özeti</h3>
          <MacroGrid values={todayTotals} goals={goals} />
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-[#202020]">Geçmiş Tüketim</h3>
            <span className="rounded-full border border-[#82CD47] bg-brand-white px-2 py-1 text-[11px] font-bold text-[#202020]">
              Son 7 gün
            </span>
          </div>

          <div className="space-y-2.5">
            {historyRows.length === 0 && !loading ? (
              <div className="rounded-2xl border border-[#82CD47] bg-brand-white p-4 text-center">
                <p className="mb-0 text-sm text-[#202020]/65">{error || 'Henüz veri yok.'}</p>
              </div>
            ) : (
              historyRows.map((row) => (
                <div key={row.key} className="rounded-2xl border border-[#82CD47] bg-brand-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="mb-0 text-sm font-bold text-[#202020]">{row.label}</p>
                    <p className="mb-0 text-sm font-extrabold text-[#202020]">{row.kcal} kcal</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[#202020]/75">
                    <p className="mb-0 rounded-lg bg-brand-bg px-2 py-1">Prot: {row.protein}g</p>
                    <p className="mb-0 rounded-lg bg-brand-bg px-2 py-1">Karb: {row.carbs}g</p>
                    <p className="mb-0 rounded-lg bg-brand-bg px-2 py-1">Yağ: {row.fats}g</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {loading && <p className="mt-4 text-center text-xs text-[#202020]/60">Veriler yükleniyor...</p>}
      </div>
    </div>
  );
}
