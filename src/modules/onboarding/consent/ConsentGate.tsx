// G20-S1 md.1–3 — Açılış rıza kapısı (App.tsx › AppContent).
//
// Bayrak kapalı (yeni_onboarding ve yeni_kabuk ikisi de kapalı): bugünkü davranış
// AYNEN — Meta SDK + ATT açılışta (`initFBSDK()`).
// Bayrak açık: ATT ve Meta YALNIZ politika bloğundan SONRA (sıra: politika → ATT;
// ATT reddi = Meta kapalı, user_consents'e yazılır):
//   • hesap yok, kayıt yok          → bekle (ATT sorulmaz)
//   • kabul tamam                   → initFBSDK (iOS ATT burada)
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
  recordAtt,
  rememberAccepted,
} from '../../../lib/consent/store';
import { ConsentSheet } from './ConsentSheet';

const startMeta = (withConsent: boolean) =>
  initFBSDK(
    withConsent
      ? {
          onAtt: ({ status, asked }) => {
            if (asked) void recordAtt(status === 'granted');
          },
        }
      : undefined,
  ).catch((err) => {
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
      void startMeta(false);
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
        void startMeta(true);
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
