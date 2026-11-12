// G21-S1 md.9 — sayfa içi geçişler (push) tek kaynak.
//
// Bir sekmenin İÇİNDE açılan sayfa sağdan kayar (FinMoTokens push: base 300 enter ·
// geri base 300 exit, iOS kenar jestiyle parmakla sürülür). Azaltılmış harekette
// yer değiştirme yok: 200 ms opaklık (REDUCED). Alt sekmeler arası geçiş ve
// alttan açılan modal/sheet'ler bu dosyanın konusu değil (bugünkü gibi).
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { PREMIUM, REDUCED } from '../core/design/motion';

export type PushTransition = Pick<NativeStackNavigationOptions, 'animation' | 'animationDuration' | 'gestureEnabled'>;

/** Normal: sağdan kayma. Azaltılmış: opaklık (200 ms). Geri jesti her iki hâlde açık. */
export function pushTransition(reduced: boolean): PushTransition {
  return reduced
    ? { animation: 'fade', animationDuration: REDUCED.duration, gestureEnabled: true }
    : { animation: 'slide_from_right', animationDuration: PREMIUM.push.enter, gestureEnabled: true };
}
