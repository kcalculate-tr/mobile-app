// G34-S1 — Kişisel plan ↔ uygulama köprüsü (G33 öğün planı, rıza, erişilebilirlik). Ekranlar
// başka modüllerin iç ayrıntısına buradan bağlanır.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAuth } from '../../core/AuthContext';
import { recordAllergenConsent } from '../../lib/consent/store';
import { userInIzmir } from '../plan/actions';

/** İzmir'de mi (eatkcal öğün anahtarı yalnız orada görünür; varsayılan kapalı). */
export function useInIzmir(): boolean {
  const { user } = useAuth();
  const [v, setV] = useState(false);
  useEffect(() => {
    let alive = true;
    void userInIzmir(user?.id ?? null)
      .then((r) => alive && setV(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user?.id]);
  return v;
}

/** Alerji açık rızası — G33 altyapısı (kind 'health_data', source 'meal_plan'; ayrı satır). */
export async function recordAllergyConsent(granted: boolean): Promise<void> {
  try {
    await recordAllergenConsent(granted);
  } catch {
    /* yan kuyruk sonra yazar */
  }
}

/** "Saydamlığı azalt" açık mı (kilitli günlerde bulanıklık yerine düz örtü). */
export function useReduceTransparency(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((r) => alive && setV(!!r))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (r: boolean) => setV(!!r));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return v;
}
