// G48-S1 md.1 — Vitrin (YALNIZ __DEV__ ekran vitrini) gerçek kalıcı depoya yazmaz.
// `enterStoreSandbox()` sepet ve seçili adres depolarının kalıcılığını bellek içi bir depoya çevirir:
// vitrin sahnesinin eklediği ürünler / adres AsyncStorage'daki gerçek kayda (`kcal-cart`,
// `kcal-selected-address`) hiç ulaşmaz; uygulama yeniden yüklenince gerçek oturum kendi sepetini görür.
// Üretim paketinde çağıran yok (vitrinSetup yalnız VitrinGate'ten, o da `if (__DEV__) require`).
import { createJSONStorage } from 'zustand/middleware';

const mem = new Map<string, string>();
const memoryStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, v);
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
};

let sandboxed = false;

export const isStoreSandboxed = () => sandboxed;

type WithPersist = { persist: { setOptions: (o: { storage: unknown }) => void } };

/** Verilen depoların kalıcılığını belleğe çevir (geri dönüş yok; vitrin oturumu yeniden yüklemeyle biter). */
export function enterStoreSandbox(stores: readonly unknown[]): void {
  sandboxed = true;
  for (const s of stores) (s as WithPersist).persist.setOptions({ storage: createJSONStorage(() => memoryStorage) });
}

/** Yalnız test: bellek deposunu ve bayrağı sıfırla. */
export function __resetStoreSandboxForTest(): void {
  sandboxed = false;
  mem.clear();
}
