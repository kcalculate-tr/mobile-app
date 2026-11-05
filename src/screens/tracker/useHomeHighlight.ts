// useHomeHighlight — Ana sayfa çapraz-sekme "Logla izi B" vurgusu (G13-S1 m.3).
//
// `kcal:logFlight` (Keşfet / Tara / eatkcal) gelince bugünün kayıtları tazelenir
// ve YENİ kayıt BİR KEZ vurgulanır, FinMoLogB sırasıyla:
//   'dot'  — lime nokta satıra iner                       (0 → TIMING.logTrail)
//   'row'  — satır yanar + success haptik ("satıra oturur") (+DURATION.base)
//   'ring' — imza halkası dolar (onRing → TrackerDayHeader logToken)
//   söner  — halka dolumu bitince vurgu kalkar             (+TIMING.dailyRing)
// `kcal:logUndo` vurguyu geri alır (aynı kayıt ya da id'siz geri al) ve
// bugünün kayıtlarını yeniden tazeler (halka geri çekilir).
//
// `enabled` false iken (yeni_kabuk kapalı) hiç abone OLMAZ → eski kabukta
// davranış değişmez. Azaltılmış harekette nokta evresi atlanır.
import { useCallback, useEffect, useRef, useState } from 'react';

import { DURATION, TIMING, haptic, useReducedMotion } from '../../core/design';
import { onLogFlight, onLogUndo, type LogFlightPayload } from '../../modules/shell/logEvents';
import {
  pickHighlightTarget,
  undoClearsHighlight,
  type HighlightPhase,
  type HighlightRow,
} from '../../modules/gun/homeHighlight';

export interface HomeHighlightState {
  id: string;
  phase: HighlightPhase;
}

export function useHomeHighlight({
  enabled,
  rows,
  refresh,
  onRing,
}: {
  enabled: boolean;
  /** Şu anki bugün kayıtları (uçuştan önceki kümeyi bilmek için). */
  rows: readonly HighlightRow[];
  /** Bugünün kayıtlarını sunucudan tazeler, yeni listeyi döner. */
  refresh: () => Promise<readonly HighlightRow[]>;
  /** 'ring' evresinde çağrılır (halka dolumu + zaman hapı). */
  onRing: (mealLabel: string | null) => void;
}) {
  const reduced = useReducedMotion();
  const [highlight, setHighlight] = useState<HomeHighlightState | null>(null);
  const highlightRef = useRef<HomeHighlightState | null>(null);
  highlightRef.current = highlight;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const onRingRef = useRef(onRing);
  onRingRef.current = onRing;
  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Her uçuş/geri al bir "nesil"; eski neslin geç gelen tazelemesi vurgu başlatmaz.
  const genRef = useRef(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const start = useCallback(
    (id: string, mealLabel: string | null = null) => {
      if (seenRef.current.has(id)) return;
      seenRef.current.add(id);
      clearTimers();
      const at = (ms: number, fn: () => void) => {
        timersRef.current.push(setTimeout(fn, ms));
      };
      const toRow = () => {
        setHighlight({ id, phase: 'row' });
        haptic('success');
      };
      const toRing = () => {
        setHighlight({ id, phase: 'ring' });
        onRingRef.current(mealLabel);
      };
      if (reduced) {
        toRow();
        toRing();
        at(TIMING.dailyRing, () => setHighlight(null));
        return;
      }
      setHighlight({ id, phase: 'dot' });
      at(TIMING.logTrail, toRow);
      at(TIMING.logTrail + DURATION.base, toRing);
      at(TIMING.logTrail + DURATION.base + TIMING.dailyRing, () => setHighlight(null));
    },
    [clearTimers, reduced],
  );

  const clear = useCallback(() => {
    clearTimers();
    setHighlight(null);
  }, [clearTimers]);

  useEffect(() => {
    if (!enabled) return;
    const onFlight = (p: LogFlightPayload) => {
      const gen = ++genRef.current;
      const prevIds = new Set(rowsRef.current.map((r) => r.id));
      void refreshRef
        .current()
        .then((fresh) => {
          if (gen !== genRef.current) return; // arada geri al / yeni uçuş geldi
          const id = pickHighlightTarget(fresh, prevIds, p.id ?? null, seenRef.current);
          if (id) start(id, p.mealLabel ?? null);
        })
        .catch(() => {
          /* tazeleme başarısız: vurgu yok (uydurma yok) */
        });
    };
    const onUndo = (p: { id: string }) => {
      const cur = highlightRef.current;
      if (undoClearsHighlight(cur ? cur.id : null, p?.id)) {
        genRef.current += 1; // bekleyen uçuş tazelemesi vurgu başlatmasın
        clear();
      }
      void refreshRef.current().catch(() => {});
    };
    const a = onLogFlight(onFlight);
    const b = onLogUndo(onUndo);
    return () => {
      a.remove();
      b.remove();
    };
  }, [enabled, start, clear]);

  useEffect(() => clearTimers, [clearTimers]);

  return { highlight, start, clear };
}
