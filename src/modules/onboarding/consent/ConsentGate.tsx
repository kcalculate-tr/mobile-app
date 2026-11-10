// G20-S1 md.1–3 — Açılış rıza kapısı (App.tsx › AppContent).
//
// G26-S1: iOS ATT KALDIRILDI — Apple izleme sorusu hiç gösterilmez (analytics.ts).
// Bayrak kapalı (yeni_onboarding ve yeni_kabuk ikisi de kapalı): bugünkü davranış
// AYNEN — Meta SDK açılışta (`initFBSDK()`).
// Bayrak açık: Meta YALNIZ politika bloğundan SONRA:
//   • hesap yok, kayıt yok          → bekle
//   • kabul tamam                   → initFBSDK
//   • mevcut kullanıcı, kayıt yok   → bir kez bilgilendirme sheet'i (notice)
//   • yeni belge sürümü             → tekrar kabul sheet'i (reconsent)
// Sunucu (my_consent_status) okunamazsa yalnız cihaz kaydına bakılır (fail-open).
import React, { useEffect, useRef, useState } from 'react';

import { useAuth } from '../../../core/AuthContext';
import { useFeature, useFlagsContext } from '../../../core/flags';
import { getConsent, initFBSDK } from '../../../lib/analytics';
import { acceptedFromStatus, decideGate, versionsFromStatus, type DocVersions, type ServerStatus } from '../../../lib/consent/policy';
import {
  acceptPolicies,
  fetchServerStatus,
  flushPending,
  gateHeld,
  onConsentChange,
  readPolicyRecord,
  rememberAccepted,
} from '../../../lib/consent/store';
import { ConsentSheet } from './ConsentSheet';

// G26-S1: ATT yok → başlatma rızadan bağımsız tek yol.
const startMeta = () =>
  initFBSDK().catch((err) => {
    console.warn('[App] FB SDK init failed:', err);
  });

export function ConsentGate({ suppressed = false }: { suppressed?: boolean }) {
  const ready = useFlagsContext()?.ready ?? true;
  const yeniOnb = useFeature('yeni_onboarding');
  const yeniKabuk = useFeature('yeni_kabuk');
  const flagsOn = yeniOnb || yeniKabuk;
  const { session, loading } = useAuth();
  const uid = session?.user?.id ?? null;
  const [sheet, setSheet] = useState<'notice' | 'reconsent' | null>(null);
  const [open, setOpen] = useState(false);
  const [adOn, setAdOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  // Kabulde yazılacak sürüm = kapının gördüğü sunucu sürümü (ayrı okuma başarısız
  // olursa eski sürüm yazılıp tekrar kabul sheet'i döngüye girmesin).
  const serverRef = useRef<ServerStatus | null>(null);

  useEffect(() => onConsentChange(() => setTick((x) => x + 1)), []);

  useEffect(() => {
    if (!ready || loading) return;
    if (!flagsOn) {
      void startMeta();
      return;
    }
    let cancelled = false;
    void (async () => {
      if (gateHeld()) return;
      const local = await readPolicyRecord();
      let server = null;
      if (uid) {
        await flushPending(uid);
        server = await fetchServerStatus();
      }
      serverRef.current = server;
      if (cancelled || gateHeld()) return;
      const d = decideGate({ flagsOn, signedIn: !!uid, local, server });
      if (d === 'ready') {
        const acc = acceptedFromStatus(server);
        if (acc && (!local || acc.terms > local.v.terms || acc.privacy > local.v.privacy)) {
          const best: DocVersions = {
            terms: Math.max(acc.terms, local?.v.terms ?? 0),
            privacy: Math.max(acc.privacy, local?.v.privacy ?? 0),
          };
          void rememberAccepted(best);
        }
        setOpen(false);
        void startMeta();
      } else if (d === 'notice' || d === 'reconsent') {
        setAdOn(server?.ad_measurement ?? getConsent().adConsent !== 'denied');
        setSheet(d);
        setOpen(true);
      } else {
        setOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, loading, flagsOn, uid, tick]);

  if (!sheet || suppressed) return null;
  return (
    <ConsentSheet
      visible={open}
      mode={sheet}
      adOn={adOn}
      onAdChange={setAdOn}
      busy={busy}
      onConfirm={async () => {
        setBusy(true);
        try {
          await acceptPolicies({ source: sheet, adOn, versions: versionsFromStatus(serverRef.current) ?? undefined });
          setOpen(false);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
