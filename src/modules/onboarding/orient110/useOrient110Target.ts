// G54-S1 md.3 — 1.1.0 ipucu hedefi: `<View {...useOrient110Target('scan')}>`. Hedef yalnız ekran ODAKTAYKEN ve
// `ready` iken kaydolur; bayrak (`yeni_kayit`) kapalıyken hiçbir prop eklenmez (davranış aynı).
// Ana sayfa hedefi ('home') aynı zamanda "Ana sayfa odakta" sinyalidir (Orient110Host başlama koşulu).
import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useFeature } from '../../../core/flags';
import { useOrient110 } from './store';
import type { Orient110Tip } from './logic';

const NoNav = createContext<undefined>(undefined);
const NavCtx = (NavigationContext ?? NoNav) as typeof NavigationContext;

function useFocusedSafe(): boolean {
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

export type Orient110TargetProps = { ref?: RefObject<View | null>; collapsable?: false };
const NONE: Orient110TargetProps = {};

export function useOrient110Target(id: Orient110Tip, opts?: { ready?: boolean; /** Ana sayfa: profilsiz kart / profilli halka. */ variant?: 'card' | 'ring' }): Orient110TargetProps {
  const enabled = useFeature('yeni_kayit');
  const ref = useRef<View | null>(null);
  const focused = useFocusedSafe();
  const ready = opts?.ready ?? true;
  useEffect(() => {
    if (!enabled || !focused || !ready) return;
    if (opts?.variant) useOrient110.setState({ homeVariant: opts.variant });
    useOrient110.getState().register(id, ref);
    return () => useOrient110.getState().unregister(id, ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, focused, ready, opts?.variant]);
  return enabled ? { ref, collapsable: false } : NONE;
}
