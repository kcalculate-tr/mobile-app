// Veri tasarrufu/düşük güç modunda otomatik oynatma kapalı — G8-S3.md m.2.
// expo-battery (düşük güç modu) ONAYLI PAKET DEĞİL (RULES.md); en yakın
// vekil NetInfo'nun isConnectionExpensive'i: iOS'ta "Düşük Veri Modu" ve
// taşıyıcı/Wi-Fi'nin "pahalı" işaretlediği ağları kapsar. Kesin düşük güç
// modu tespiti için SORULAR'a bakınız (docs/night/G8-S3-LOG.md).
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useAutoplayAllowed(): boolean {
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    let alive = true;
    const apply = (state: { details: unknown }) => {
      if (!alive) return;
      const details = state.details as { isConnectionExpensive?: boolean } | null;
      setAllowed(!details?.isConnectionExpensive);
    };
    void NetInfo.fetch().then(apply);
    const unsubscribe = NetInfo.addEventListener(apply);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return allowed;
}
