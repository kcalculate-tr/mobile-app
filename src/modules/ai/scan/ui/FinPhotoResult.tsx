/**
 * G12-S4 — Tarama sonucu (FinPhotoR1 paneli).
 *
 * Düzenlenebilir malzeme satırları (gram + porsiyon çipi + kaldır), öğün
 * tipi döngüsü ("{Öğün}'e logla") ve kaydet sonrası toast. Kaydetme HER ZAMAN
 * `saveAiScanEstimate`'i çağırır — burada yeni bir kaydetme mantığı YOK,
 * yalnız kaydedilecek porsiyon/gram düzeltmesi hesaplanır.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { Check, Plus, X, CaretDown } from '../../../../components/icons';
import { RollingNumber } from '../../../gun/ui';
import type { NumLang } from '../../../gun/motion';
import type { ClientMealType } from '../../../../core/meal/mealType';
import type { ScanEstimate, ScanIngredient } from '../types';
import {
  FinCard,
  FinPrimaryButton,
  FinChip,
  finExtras,
  body,
  bodyBold,
  bodyMedium,
  bodySemibold,
} from '../../../profil/ui/finUi';

const PORTIONS = [0.5, 1, 1.5];
const MEAL_CYCLE: ClientMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type Row = ScanIngredient & { portion: number; removed: boolean };

export default function FinPhotoResult({
  estimate,
  photoUri,
  mealType,
  saving,
  saved,
  lang,
  onChangeMealType,
  onSave,
  onRetry,
  onAddMissing,
}: {
  estimate: Omit<ScanEstimate, 'isEstimate'>;
  photoUri: string | null;
  mealType: ClientMealType;
  saving: boolean;
  saved: boolean;
  lang: NumLang;
  onChangeMealType: (next: ClientMealType) => void;
  onSave: (adjusted: Omit<ScanEstimate, 'isEstimate'>) => void;
  onRetry: () => void;
  onAddMissing?: () => void;
}) {
  const t = useTheme();
  const x = finExtras(t);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<Row[]>(() =>
    estimate.ingredients.map(ing => ({ ...ing, portion: 1, removed: false })),
  );

  const baseKcalSum = useMemo(
    () => estimate.ingredients.reduce((s, i) => s + (i.kcal ?? 0), 0),
    [estimate.ingredients],
  );

  const adjusted = useMemo(() => {
    const activeKcalSum = rows.reduce((s, r) => (r.removed ? s : s + (r.kcal ?? 0) * r.portion), 0);
    const scale = baseKcalSum > 0 ? activeKcalSum / baseKcalSum : 1;
    return {
      ...estimate,
      kcal: Math.max(0, Math.round(estimate.kcal * scale)),
      protein_g: Math.max(0, Math.round(estimate.protein_g * scale)),
      carbs_g: Math.max(0, Math.round(estimate.carbs_g * scale)),
      fat_g: Math.max(0, Math.round(estimate.fat_g * scale)),
      ingredients: rows
        .filter(r => !r.removed)
        .map(r => ({ name: r.name, grams: Math.round(r.grams * r.portion), kcal: r.kcal != null ? Math.round(r.kcal * r.portion) : undefined })),
    };
  }, [rows, baseKcalSum, estimate]);

  const mealLabel = tr(`meal.${mealType}`);
  const cycleMeal = () => {
    const idx = MEAL_CYCLE.indexOf(mealType);
    onChangeMealType(MEAL_CYCLE[(idx + 1) % MEAL_CYCLE.length]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: '100%', height: 220, borderRadius: 20 }} resizeMode="cover" />
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ backgroundColor: x.nested, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontFamily: bodySemibold, fontSize: 12, color: t.color.secondary }}>
              {tr('ai_scan.items_found', { count: adjusted.ingredients.length })}
            </Text>
          </View>
        </View>

        <FinCard style={{ gap: 4 }}>
          <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary }}>
            {tr('ai_scan.estimate_total')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            <RollingNumber value={adjusted.kcal} lang={lang} fontSize={32} weight="700" color={t.color.ink} />
            <Text style={{ fontFamily: bodySemibold, fontSize: 15, color: t.color.secondary, marginBottom: 4 }}>kcal</Text>
          </View>
          <Text style={{ fontFamily: body, fontSize: 12, color: t.color.secondary, marginTop: 2 }}>
            {tr('ai_scan.grams_hint')}
          </Text>
        </FinCard>

        <View style={{ gap: 10 }}>
          {rows.map((row, i) => (
            <FinCard key={`${row.name}-${i}`} style={{ opacity: row.removed ? 0.4 : 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: bodyBold, fontSize: 15, color: t.color.ink, flex: 1 }} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={{ fontFamily: bodyMedium, fontSize: 13, color: t.color.secondary, marginRight: 8 }}>
                  {Math.round(row.grams * row.portion)} g
                  {row.kcal != null ? ` · ${Math.round(row.kcal * row.portion)} kcal` : ''}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('ai_scan.remove_item', { name: row.name })}
                  hitSlop={8}
                  onPress={() =>
                    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, removed: !r.removed } : r)))
                  }
                >
                  <X size={16} color={t.color.secondary} />
                </Pressable>
              </View>
              {!row.removed ? (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={tr('ai_scan.portion_group', { name: row.name })}
                  style={{ flexDirection: 'row', gap: 8 }}
                >
                  {PORTIONS.map(p => (
                    <FinChip
                      key={p}
                      label={p === 0.5 ? '½' : p === 1 ? '1' : '1½'}
                      selected={row.portion === p}
                      onPress={() => setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, portion: p } : r)))}
                    />
                  ))}
                </View>
              ) : null}
            </FinCard>
          ))}
        </View>

        {onAddMissing ? (
          <Pressable
            onPress={onAddMissing}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}
          >
            <Plus size={18} color={t.color.ink} />
            <Text style={{ fontFamily: bodySemibold, fontSize: 14, color: t.color.ink }}>
              {tr('ai_scan.add_missing')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(16, insets.bottom + 8),
          backgroundColor: x.glass,
          borderTopWidth: 1,
          borderTopColor: t.color.line,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={cycleMeal}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text style={{ fontFamily: bodySemibold, fontSize: 13, color: x.glassText }}>{mealLabel}</Text>
          <CaretDown size={14} color={x.glassText} weight="bold" />
        </Pressable>
        <FinPrimaryButton
          label={
            saved
              ? tr('ai_scan.logged_to_meal', { meal: mealLabel })
              : tr('ai_scan.log_to_meal', { meal: mealLabel })
          }
          onPress={() => onSave(adjusted)}
          disabled={saving || saved}
          tone="lime"
          icon={
            saving ? (
              <ActivityIndicator color={t.color.onAccent} />
            ) : saved ? (
              <Check size={18} color={t.color.onAccent} weight="bold" />
            ) : undefined
          }
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
