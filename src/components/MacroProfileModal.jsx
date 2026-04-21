import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, HeartPulse, Ruler, Scale, UserRound, X } from 'lucide-react';

const GOAL_OPTIONS = [
  {
    key: 'lose_weight',
    label: 'Kilo Ver',
    helper: 'Kalori açığı oluştur',
    calorieAdjustment: -400,
    proteinMultiplier: 2.0,
  },
  {
    key: 'maintain',
    label: 'Korumaya Al',
    helper: 'Dengeyi koru',
    calorieAdjustment: 0,
    proteinMultiplier: 1.6,
  },
  {
    key: 'gain_weight',
    label: 'Kas / Kilo Al',
    helper: 'Kontrollü fazlalık',
    calorieAdjustment: 300,
    proteinMultiplier: 1.8,
  },
];

const DEFAULT_FORM = {
  gender: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 70,
  goal: 'maintain',
  targets: {
    kcal: 2200,
    protein: 120,
    carbs: 240,
    fats: 70,
  },
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findGoalConfig(goalKey) {
  return GOAL_OPTIONS.find((item) => item.key === goalKey) || GOAL_OPTIONS[1];
}

function calculateTargets({ gender, age, heightCm, weightKg, goal }) {
  const safeAge = clamp(Math.round(toNumber(age, 30)), 14, 100);
  const safeHeight = clamp(Math.round(toNumber(heightCm, 175)), 120, 230);
  const safeWeight = clamp(Math.round(toNumber(weightKg, 70)), 35, 300);
  const goalConfig = findGoalConfig(goal);

  const baseBmr = (10 * safeWeight) + (6.25 * safeHeight) - (5 * safeAge);
  const bmr = gender === 'female' ? baseBmr - 161 : baseBmr + 5;
  const estimatedTdee = bmr * 1.35;
  const kcal = clamp(Math.round(estimatedTdee + goalConfig.calorieAdjustment), 1200, 5000);

  const protein = clamp(Math.round(safeWeight * goalConfig.proteinMultiplier), 45, 350);
  const fats = clamp(Math.round(Math.max(40, safeWeight * 0.8)), 35, 220);
  const carbsFromMath = (kcal - (protein * 4) - (fats * 9)) / 4;
  const carbs = clamp(Math.round(carbsFromMath), 50, 700);

  return { kcal, protein, carbs, fats };
}

function normalizeInitialValues(values) {
  const source = values && typeof values === 'object' ? values : {};
  const normalized = {
    gender: source.gender === 'female' ? 'female' : 'male',
    age: clamp(Math.round(toNumber(source.age, DEFAULT_FORM.age)), 14, 100),
    heightCm: clamp(Math.round(toNumber(source.heightCm, DEFAULT_FORM.heightCm)), 120, 230),
    weightKg: clamp(Math.round(toNumber(source.weightKg, DEFAULT_FORM.weightKg)), 35, 300),
    goal: findGoalConfig(source.goal || DEFAULT_FORM.goal).key,
  };

  const autoTargets = calculateTargets(normalized);

  return {
    ...normalized,
    targets: {
      kcal: clamp(Math.round(toNumber(source.targets?.kcal, autoTargets.kcal)), 1200, 5000),
      protein: clamp(Math.round(toNumber(source.targets?.protein, autoTargets.protein)), 40, 400),
      carbs: clamp(Math.round(toNumber(source.targets?.carbs, autoTargets.carbs)), 40, 800),
      fats: clamp(Math.round(toNumber(source.targets?.fats, autoTargets.fats)), 30, 300),
    },
  };
}

function hasSavedTargets(values) {
  const source = values && typeof values === 'object' ? values : {};
  const targets = source.targets && typeof source.targets === 'object' ? source.targets : null;
  if (!targets) return false;

  const keys = ['kcal', 'protein', 'carbs', 'fats'];
  return keys.some((key) => (
    Object.prototype.hasOwnProperty.call(targets, key)
    && targets[key] !== undefined
    && targets[key] !== null
    && String(targets[key]).trim() !== ''
  ));
}

export default function MacroProfileModal({
  open,
  initialData,
  initialValues,
  saving = false,
  error = '',
  onSave,
  onClose,
}) {
  const [gender, setGender] = useState(DEFAULT_FORM.gender);
  const [age, setAge] = useState(DEFAULT_FORM.age);
  const [heightCm, setHeightCm] = useState(DEFAULT_FORM.heightCm);
  const [weightKg, setWeightKg] = useState(DEFAULT_FORM.weightKg);
  const [goal, setGoal] = useState(DEFAULT_FORM.goal);
  const [targets, setTargets] = useState(DEFAULT_FORM.targets);
  const [autoApplyTargets, setAutoApplyTargets] = useState(false);

  useEffect(() => {
    if (!open) return;
    const sourceValues = initialData || initialValues;
    const normalized = normalizeInitialValues(sourceValues);
    const noSavedTargets = !hasSavedTargets(sourceValues);
    setGender(normalized.gender);
    setAge(normalized.age);
    setHeightCm(normalized.heightCm);
    setWeightKg(normalized.weightKg);
    setGoal(normalized.goal);
    setTargets(normalized.targets);
    setAutoApplyTargets(noSavedTargets);
  }, [initialData, initialValues, open]);

  const autoTargets = useMemo(() => (
    calculateTargets({ gender, age, heightCm, weightKg, goal })
  ), [gender, age, goal, heightCm, weightKg]);

  useEffect(() => {
    if (!open || !autoApplyTargets) return;
    setTargets(autoTargets);
  }, [autoApplyTargets, autoTargets, open]);

  const summary = useMemo(() => (
    `${targets.kcal} kcal | ${targets.protein}g Protein | ${targets.carbs}g Karb. | ${targets.fats}g Yağ`
  ), [targets]);

  const handleTargetChange = (key, value) => {
    const parsed = Number(value);
    setAutoApplyTargets(false);
    setTargets((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0,
    }));
  };

  const handleAutoCalculate = () => {
    setAutoApplyTargets(true);
    setTargets(autoTargets);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || typeof onSave !== 'function') return;

    const saved = await onSave({
      gender,
      age: Math.round(toNumber(age, DEFAULT_FORM.age)),
      heightCm: Math.round(toNumber(heightCm, DEFAULT_FORM.heightCm)),
      weightKg: Math.round(toNumber(weightKg, DEFAULT_FORM.weightKg)),
      goal,
      targets: {
        kcal: Math.round(toNumber(targets.kcal, autoTargets.kcal)),
        protein: Math.round(toNumber(targets.protein, autoTargets.protein)),
        carbs: Math.round(toNumber(targets.carbs, autoTargets.carbs)),
        fats: Math.round(toNumber(targets.fats, autoTargets.fats)),
      },
    });

    if (saved !== false && typeof onClose === 'function') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-[#202020]/60 sm:items-center sm:justify-center">
      <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-brand-secondary bg-brand-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl sm:border sm:p-6">
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-widest text-brand-primary">PROFİL AYARLARI</p>
              <h2 className="mt-1 text-xl font-bold text-brand-dark">Kişisel Beslenme Profilin</h2>
              <p className="mt-1 text-xs text-brand-dark/65">
                Günlük hedeflerini hesaplamak için bilgilerini güncelleyebilirsin.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-secondary/60 bg-brand-white text-brand-dark"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-brand-dark/75">Cinsiyet</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  gender === 'male'
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-dark'
                    : 'border-brand-secondary/50 bg-brand-white text-brand-dark/75'
                }`}
              >
                Erkek
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  gender === 'female'
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-dark'
                    : 'border-brand-secondary/50 bg-brand-white text-brand-dark/75'
                }`}
              >
                Kadın
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark/70">
                <UserRound size={12} />
                Yaş
              </span>
              <input
                type="number"
                min="14"
                max="100"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-xl border border-brand-secondary/60 bg-brand-bg px-3 py-2 text-sm text-brand-dark"
              />
            </label>
            <label className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark/70">
                <Ruler size={12} />
                Boy (cm)
              </span>
              <input
                type="number"
                min="120"
                max="230"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full rounded-xl border border-brand-secondary/60 bg-brand-bg px-3 py-2 text-sm text-brand-dark"
              />
            </label>
            <label className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark/70">
                <Scale size={12} />
                Kilo (kg)
              </span>
              <input
                type="number"
                min="35"
                max="300"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full rounded-xl border border-brand-secondary/60 bg-brand-bg px-3 py-2 text-sm text-brand-dark"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-brand-dark/75">Hedef</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {GOAL_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setGoal(option.key)}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                    goal === option.key
                      ? 'border-brand-primary bg-brand-primary/10'
                      : 'border-brand-secondary/50 bg-brand-white'
                  }`}
                >
                  <p className="mb-0 text-sm font-semibold text-brand-dark">{option.label}</p>
                  <p className="mt-0.5 mb-0 text-[11px] text-brand-dark/65">{option.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-brand-secondary/70 bg-brand-bg px-3 py-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="mb-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark/70">
                <Calculator size={13} />
                Günlük Hedeflerin
              </p>
              <button
                type="button"
                onClick={handleAutoCalculate}
                className="rounded-full border border-brand-secondary/60 bg-brand-white px-2.5 py-1 text-[10px] font-semibold text-brand-dark/75 transition hover:bg-brand-bg"
              >
                Otomatik Hesapla
              </button>
            </div>
            <p className="mb-0 text-sm font-bold text-brand-dark">{summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-brand-dark/70">Kalori (kcal)</span>
              <input
                type="number"
                min="0"
                value={targets.kcal}
                onChange={(e) => handleTargetChange('kcal', e.target.value)}
                className="w-full rounded-xl border border-brand-secondary/60 bg-brand-bg px-3 py-2 text-sm text-brand-dark"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-brand-dark/70">Protein (g)</span>
              <input
                type="number"
                min="0"
                value={targets.protein}
                onChange={(e) => handleTargetChange('protein', e.target.value)}
                className="w-full rounded-xl border border-brand-secondary/60 bg-brand-bg px-3 py-2 text-sm text-brand-dark"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-brand-dark/70">Karbonhidrat (g)</span>
              <input
                type="number"
                min="0"
                value={targets.carbs}
                onChange={(e) => handleTargetChange('carbs', e.target.value)}
                className="w-full rounded-xl border border-brand-secondary/60 bg-brand-bg px-3 py-2 text-sm text-brand-dark"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-brand-dark/70">Yağ (g)</span>
              <input
                type="number"
                min="0"
                value={targets.fats}
                onChange={(e) => handleTargetChange('fats', e.target.value)}
                className="w-full rounded-xl border border-brand-secondary/60 bg-brand-bg px-3 py-2 text-sm text-brand-dark"
              />
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-3 text-sm font-medium text-brand-white disabled:opacity-60"
          >
            <HeartPulse size={16} />
            {saving ? 'Kaydediliyor...' : 'Hedefleri Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
