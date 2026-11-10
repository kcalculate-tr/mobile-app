// G22-S1 md.2 (İlter 10 Kas) — "Elle gir" katmanı BELİRME geçişi (aşağıdan kayma YOK).
// Açılış: zemin opaklık 0 → 0,4, katman opaklık 0 → 1 ve ölçek 0,96 → 1 (FinMoTokens base 300,
// enter eğrisi). Kapanış tersi (fast 200, exit). Azaltılmış harekette yalnız opaklık (200 ms).
// SAF spesifikasyon (Node testi) + Reanimated kancası (useManualAppear.ts).

export const MANUAL_SCRIM_OPACITY = 0.4;
export const MANUAL_SCALE_FROM = 0.96;

export interface AppearSpec {
  duration: number;
  curve: 'enter' | 'exit' | 'standard';
  scrim: { from: number; to: number };
  opacity: { from: number; to: number };
  /** null → ölçek animasyonu yok (azaltılmış hareket). */
  scale: { from: number; to: number } | null;
  /** Kayma (translateY) HİÇBİR durumda yok. */
  translateY: 0;
}

/** Süreler FinMoTokens'tan (core/design/motion: DURATION.base/fast, REDUCED.duration) verilir. */
export interface AppearTokens {
  base: number;
  fast: number;
  reduced: number;
}

export function manualAppearSpec(open: boolean, reduced: boolean, tk: AppearTokens): AppearSpec {
  if (reduced) {
    return {
      duration: tk.reduced,
      curve: 'standard',
      scrim: open ? { from: 0, to: MANUAL_SCRIM_OPACITY } : { from: MANUAL_SCRIM_OPACITY, to: 0 },
      opacity: open ? { from: 0, to: 1 } : { from: 1, to: 0 },
      scale: null,
      translateY: 0,
    };
  }
  return open
    ? {
        duration: tk.base,
        curve: 'enter',
        scrim: { from: 0, to: MANUAL_SCRIM_OPACITY },
        opacity: { from: 0, to: 1 },
        scale: { from: MANUAL_SCALE_FROM, to: 1 },
        translateY: 0,
      }
    : {
        duration: tk.fast,
        curve: 'exit',
        scrim: { from: MANUAL_SCRIM_OPACITY, to: 0 },
        opacity: { from: 1, to: 0 },
        scale: { from: 1, to: MANUAL_SCALE_FROM },
        translateY: 0,
      };
}
