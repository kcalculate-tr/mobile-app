// T20GunEmpty — "Günün henüz boş". İkinci CTA bugünkü `meal_consumptions`
// listesinden seçip `share_meal_to_day` çağırır (bkz. ../shareMealToDay).
// Birincil CTA ("İlk öğününü paylaş") bugün hiç kayıt yoksa kullanıcıyı
// öğün loglamaya yönlendirir — bu ekran navigasyonu bilmez, `onLogMeal` ile
// dışarıdan verilir.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Sheet, useTheme, FinListSkeleton } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Plus, User } from '../../../components/icons';
import { getTodayConsumptions, type TodayConsumption } from '../todayConsumptions';
import { shareMealToDay } from '../index';

const MEAL_I18N: Record<string, string> = {
  breakfast: 'meal.breakfast',
  lunch: 'meal.lunch',
  dinner: 'meal.dinner',
  snack: 'meal.snack',
};

export interface GunEmptyProps {
  onLogMeal?: () => void;
  onShared?: () => void;
}

export function GunEmpty({ onLogMeal, onShared }: GunEmptyProps) {
  const t = useTheme();
  const { t: tt } = useT();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={[styles.ringPlaceholder, { borderColor: t.color.line }]}>
        <User size={48} color={t.color.secondary} weight="fill" />
      </View>
      <AppText variant="title" style={styles.title}>
        {tt('gun.empty_title')}
      </AppText>
      <AppText variant="body" tone="secondary" style={styles.subtitle}>
        {tt('gun.empty_subtitle')}
      </AppText>

      <Pressable
        onPress={onLogMeal}
        style={[styles.primaryBtn, { backgroundColor: t.color.accent }]}
        accessibilityRole="button"
      >
        <Plus size={18} color={t.color.onAccent} weight="bold" />
        <AppText variant="body" tone="onAccent" style={styles.btnText}>
          {tt('gun.empty_share_first')}
        </AppText>
      </Pressable>

      <Pressable
        onPress={() => setPickerOpen(true)}
        style={[styles.secondaryBtn, { borderColor: t.color.line }]}
        accessibilityRole="button"
      >
        <AppText variant="body" style={styles.btnText}>
          {tt('gun.empty_pick_today')}
        </AppText>
      </Pressable>

      <TodayPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onShared={() => {
          setPickerOpen(false);
          onShared?.();
        }}
      />
    </View>
  );
}

function TodayPickerSheet({
  visible,
  onClose,
  onShared,
}: {
  visible: boolean;
  onClose: () => void;
  onShared: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TodayConsumption[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    getTodayConsumptions()
      .then((res) => {
        if (alive) setItems(res);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible]);

  const handlePick = useCallback(
    async (id: string) => {
      if (sharingId) return;
      setSharingId(id);
      try {
        await shareMealToDay(id);
        onShared();
      } finally {
        setSharingId(null);
      }
    },
    [sharingId, onShared],
  );

  return (
    // G15-S3 — eski 1.0.7 BottomSheet yerine Final Sheet (28 köşe, tutamaç, kapat, tema).
    <Sheet visible={visible} onClose={onClose} title={tt('gun.picker_title')}>
      {loading ? (
        <FinListSkeleton rows={3} style={{ paddingHorizontal: 0 }} />
      ) : items.length === 0 ? (
        <AppText variant="body" tone="secondary" style={styles.pickerEmpty}>
          {tt('gun.picker_empty')}
        </AppText>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePick(item.id)}
              disabled={sharingId !== null}
              style={[styles.pickerRow, { borderBottomColor: t.color.line }]}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="body">{item.name}</AppText>
                <AppText variant="caption" tone="secondary">
                  {item.meal_type ? `${tt(MEAL_I18N[item.meal_type] ?? 'meal.snack')}, ` : ''}{item.kcal} kcal
                </AppText>
              </View>
              {sharingId === item.id ? <ActivityIndicator /> : null}
            </Pressable>
          )}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 6 },
  ringPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 28 },
  primaryBtn: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnText: { fontWeight: '600' },
  loader: { paddingVertical: 24 },
  pickerEmpty: { paddingVertical: 24, textAlign: 'center' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
});
