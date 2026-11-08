// G18-S1 md.6 — `useOrientTarget(id)`: hedef ekranlara tek temas.
//
//   const orientScan = useOrientTarget('scan', { ready: onHome });
//   <View {...orientScan} style={…}>
//
// Hedef yalnız ekran ODAKTAYKEN ve `ready` iken kaydolur (sekmeler bağlı kalsa da
// arka plandaki ekranın ipucu açılmaz). OrientHost görünür adımın hedefini
// `measureInWindow` ile ölçer. Bayrak/oryantasyon kapalıysa hiçbir şey çizilmez;
// hook yalnız ref döndürür (davranış değişmez).
import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { create } from 'zustand';

import { useFeature } from '../../../../core/flags';

import { ORIENT_TARGETS, type OrientStep, type OrientTargetId } from '../state';

export interface OrientTargetEntry {
  id: OrientTargetId;
  step: OrientStep;
  ref: RefObject<View | null>;
}

interface TargetStore {
  targets: Partial<Record<OrientTargetId, OrientTargetEntry>>;
  register: (e: OrientTargetEntry) => void;
  unregister: (id: OrientTargetId, ref: RefObject<View | null>) => void;
}

export const useOrientTargets = create<TargetStore>((set) => ({
  targets: {},
  register: (e) => set((s) => ({ targets: { ...s.targets, [e.id]: e } })),
  unregister: (id, ref) =>
    set((s) => {
      if (s.targets[id]?.ref !== ref) return s;
      const next = { ...s.targets };
      delete next[id];
      return { targets: next };
    }),
}));

// Gezinme modülü bağlamı vermiyorsa (test kopyaları) boş bağlam → "odakta".
const NoNav = createContext<undefined>(undefined);
const NavCtx = (NavigationContext ?? NoNav) as typeof NavigationContext;

/** Gezinme bağlamı yoksa (ör. sekme çubuğu dışı) odakta say. */
function useSafeFocused(): boolean {
  const nav = useContext(NavCtx);
  const [focused, setFocused] = useState(() => (nav ? nav.isFocused() : true));
  useEffect(() => {
    if (!nav) return;
    setFocused(nav.isFocused());
    const a = nav.addListener('focus', () => setFocused(true));
    const b = nav.addListener('blur', () => setFocused(false));
    return () => {
      a();
      b();
    };
  }, [nav]);
  return focused;
}

export type OrientTargetProps = { ref?: RefObject<View | null>; collapsable?: false };
const NO_PROPS: OrientTargetProps = {};

export function useOrientTarget(id: OrientTargetId, opts?: { ready?: boolean }): OrientTargetProps {
  // Bayrak kapalıyken hiçbir prop eklenmez (bayt bayt parite) ve kayıt yapılmaz.
  const enabled = useFeature('yeni_onboarding');
  const ref = useRef<View | null>(null);
  const focused = useSafeFocused();
  const ready = opts?.ready ?? true;
  useEffect(() => {
    if (!enabled || !focused || !ready) return;
    const entry: OrientTargetEntry = { id, step: ORIENT_TARGETS[id], ref };
    useOrientTargets.getState().register(entry);
    return () => useOrientTargets.getState().unregister(id, ref);
  }, [id, enabled, focused, ready]);
  return enabled ? { ref, collapsable: false } : NO_PROPS;
}
