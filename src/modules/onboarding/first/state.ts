// G18-S1 — "İlk 60 saniye" SAF durum mantığı (RN importu yok → node:test).
//
// Kalıcı kullanıcı bayrakları (SON_HAL Tur 26, ORTAK #8):
//  · açılış görüldü          → YALNIZ cihaz (FinMoOpen: silip yeniden kurunca tekrar oynar)
//  · profil kartı            → open | dismissed | done  (cihaz + profil)
//  · oryantasyon adımları    → 1..4 görüldü, başladı, atlandı (cihaz + profil)
// Birleştirme kuralı: "daha ileri" durum kazanır (bir kez kapatılan kart bir daha
// zorla açılmaz; görülen ipucu bir daha gösterilmez).

export type ProfileCardState = 'open' | 'dismissed' | 'done';
export type OrientStep = 1 | 2 | 3 | 4;
export const ORIENT_STEPS: readonly OrientStep[] = [1, 2, 3, 4];

/** Oryantasyon hedef kimlikleri → adım (useOrientTarget(id)). */
export const ORIENT_TARGETS = {
  scan: 1, // Ana sayfa · tab bar Tara
  log: 2, // Tara sonucu · "…'e logla"
  ring: 3, // Ana sayfa · Gün halkası (ilk kayıttan sonra)
  kesfet: 4, // Keşfet · Sana Özel / Takip (ilk ziyaret)
} as const satisfies Record<string, OrientStep>;
export type OrientTargetId = keyof typeof ORIENT_TARGETS;

export interface OrientState {
  started: boolean;
  skipped: boolean;
  seen: Record<OrientStep, boolean>;
}

/** Cihazlar arası taşınan kısım (profiles.onboarding_state). */
export interface SyncedState {
  profileCard: ProfileCardState;
  orient: OrientState;
}

export const EMPTY_ORIENT: OrientState = {
  started: false,
  skipped: false,
  seen: { 1: false, 2: false, 3: false, 4: false },
};

export const EMPTY_SYNCED: SyncedState = { profileCard: 'open', orient: EMPTY_ORIENT };

const CARD_RANK: Record<ProfileCardState, number> = { open: 0, dismissed: 1, done: 2 };

function asCard(v: unknown): ProfileCardState {
  return v === 'dismissed' || v === 'done' ? v : 'open';
}

/** Bilinmeyen/bozuk girdiye dayanıklı ayrıştırma (AsyncStorage JSON ya da jsonb). */
export function parseSynced(raw: unknown): SyncedState {
  if (!raw || typeof raw !== 'object') return EMPTY_SYNCED;
  const r = raw as Record<string, unknown>;
  const o = (r.orient && typeof r.orient === 'object' ? r.orient : {}) as Record<string, unknown>;
  const seen = (o.seen && typeof o.seen === 'object' ? o.seen : {}) as Record<string, unknown>;
  return {
    profileCard: asCard(r.profileCard),
    orient: {
      started: o.started === true,
      skipped: o.skipped === true,
      seen: { 1: seen['1'] === true, 2: seen['2'] === true, 3: seen['3'] === true, 4: seen['4'] === true },
    },
  };
}

/** İki kaynağı birleştir: ileri durum kazanır (VEYA). */
export function mergeSynced(a: SyncedState, b: SyncedState): SyncedState {
  return {
    profileCard: CARD_RANK[a.profileCard] >= CARD_RANK[b.profileCard] ? a.profileCard : b.profileCard,
    orient: {
      started: a.orient.started || b.orient.started,
      skipped: a.orient.skipped || b.orient.skipped,
      seen: {
        1: a.orient.seen[1] || b.orient.seen[1],
        2: a.orient.seen[2] || b.orient.seen[2],
        3: a.orient.seen[3] || b.orient.seen[3],
        4: a.orient.seen[4] || b.orient.seen[4],
      },
    },
  };
}

export function sameSynced(a: SyncedState, b: SyncedState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Profil kartı görünür mü: kart açık VE kullanıcının hedefi yok. Hedef bilgisi
 * henüz gelmediyse (`undefined`) gösterilmez (yanıp sönme olmasın).
 */
export function showProfileCard(card: ProfileCardState, hasGoal: boolean | undefined): boolean {
  return card === 'open' && hasGoal === false;
}

/** Oryantasyon bitti mi (atlandı ya da 4 adım görüldü). */
export function orientDone(o: OrientState): boolean {
  return o.skipped || ORIENT_STEPS.every((s) => o.seen[s]);
}

/**
 * Şimdi gösterilecek ipucu. Kurallar (FinOrient1–4):
 *  - oryantasyon başlamadıysa / atlandıysa → yok
 *  - 1 (Tara) her zaman önce: görülmediyse yalnız hedefi ekrandaysa 1
 *  - sonra 2/3/4 hedefleri ekranda (ve hazır) oldukça, görülmemiş en küçük adım
 *    (2 Tara sonucu, 3 ilk kayıttan sonra Gün halkası, 4 Keşfet ilk ziyaret — sıra
 *    kullanıcının yoluna göre; numara sabit "n/4").
 */
export function nextOrientStep(o: OrientState, available: ReadonlySet<OrientStep>): OrientStep | null {
  if (!o.started || o.skipped) return null;
  if (!o.seen[1]) return available.has(1) ? 1 : null;
  for (const s of [2, 3, 4] as const) {
    if (!o.seen[s] && available.has(s)) return s;
  }
  return null;
}

/** Bir adımı görüldü say ("Sonraki"/"Tamam"). */
export function markSeen(o: OrientState, step: OrientStep): OrientState {
  return { ...o, seen: { ...o.seen, [step]: true } };
}

/** "Atla": kalan bütün ipuçları kapanır. */
export function skipAll(o: OrientState): OrientState {
  return { ...o, skipped: true };
}

/** Karşılama başlığı varyantı (`onb_welcome_variant`): B ve C birlikte açıksa B. */
export type WelcomeVariant = 'a' | 'b' | 'c';
export function welcomeVariant(flags: { b: boolean; c: boolean }): WelcomeVariant {
  if (flags.b) return 'b';
  if (flags.c) return 'c';
  return 'a';
}

// ── FinMoOpen zaman çizelgesi (ms) ─────────────────────────────────────────────
// Toplam 2300 = enter 900 → standard 500 → exit 900 (FinMoTokens story/slow/story).
export const OPEN_T = {
  /** 0–300 tabak + halka izi belirir (enter). */
  plateIn: 300,
  /** 300–900 cam kase tabağın yerine (enter). */
  enterEnd: 900,
  /** 900–1400 Enerji halkası 0→%100, nokta halka ucunda (standard). */
  ringEnd: 1400,
  /** 900–1000 nokta belirir. */
  dotIn: 100,
  /** 1400–1900 kase+halka 0.6'ya küçülüp söner, nokta logoya gider (exit 500). */
  shrinkEnd: 1900,
  /** 1600–1900 "kcal" belirir (enter 300). */
  wordStart: 1600,
  /** 2000–2300 katman Karşılama'ya erir (exit 300, yalnız opaklık). */
  outStart: 2000,
  total: 2300,
  /** Azaltılmış: durağan logo 900 ms + 200 ms opaklık. */
  reducedHold: 900,
  reducedFade: 200,
  /** Atla: o karede kesilir, 200 ms opaklık. */
  skipFade: 200,
} as const;
