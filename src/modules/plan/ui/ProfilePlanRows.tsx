// G33-S1 md.1 — Profil › Kcalculate AI: "Alışveriş listesi" ve "Öğün planı" satırları (`ogun_plani`
// bayrağı arkasında). Değerler sabit DEĞİL, bu haftanın planından: "[N] malzeme" · "[N] / 28 öğün".
import React, { useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { useFeature } from '../../../core/flags';
import { CalendarBlank, ShoppingCart } from '../../../components/icons';
import { FinRow } from '../../profil/ui/finUi';
import { dayKey } from '../../gun/track/dayClock';
import { usePlanStore } from '../store';
import { buildShoppingList, groupShopping } from '../shopping';
import { weekStartOf } from '../week';

export function ProfilePlanRows({ onOpen }: { onOpen: (route: 'ShoppingList' | 'MealPlan') => void }) {
  const on = useFeature('ogun_plani');
  return on ? <Rows onOpen={onOpen} /> : null;
}

function Rows({ onOpen }: { onOpen: (route: 'ShoppingList' | 'MealPlan') => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();
  const ws = weekStartOf(dayKey());
  const setUser = usePlanStore((s) => s.setUser);
  const loadWeek = usePlanStore((s) => s.loadWeek);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const entry = usePlanStore((s) => s.weeks[ws]);
  const catalog = usePlanStore((s) => s.catalog);
  useEffect(() => {
    setUser(user?.id ?? null);
  }, [user?.id, setUser]);
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) void loadWeek(ws);
      void loadCatalog();
    }, [user?.id, ws, loadWeek, loadCatalog]),
  );
  const items = entry?.items ?? [];
  const meals = items.length;
  const remaining = useMemo(
    () => (catalog ? groupShopping(buildShoppingList(items, catalog.recipeMap, catalog.ingredients, entry?.shopState ?? [], entry?.manual ?? [])).remaining : 0),
    [catalog, items, entry?.shopState, entry?.manual],
  );
  return (
    <>
      <FinRow
        icon={<ShoppingCart size={18} color={t.color.ink} />}
        label={tr('plan.profile_shop')}
        sub={tr('plan.profile_shop_sub')}
        value={tr('plan.profile_shop_value', { n: remaining })}
        onPress={() => onOpen('ShoppingList')}
        testID="profile-shopping-row"
      />
      <FinRow
        icon={<CalendarBlank size={18} color={t.color.ink} />}
        label={tr('plan.profile_plan')}
        sub={tr('plan.profile_plan_sub')}
        value={tr('plan.profile_plan_value', { n: meals })}
        onPress={() => onOpen('MealPlan')}
        testID="profile-plan-row"
      />
    </>
  );
}
