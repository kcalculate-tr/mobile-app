// Tabak koleksiyonu — yerel kalıcılık (AsyncStorage). Katalog numarası atamaları
// (yemek adı → no) ve "kazanılmış" kart kimlikleri tutulur.
// Dalga 2'de sunucuya taşınacak (yerel depo).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@kcal_collection_v1';

export interface CollectionState {
  // yemek adı → kalıcı katalog numarası
  assignments: Record<string, number>;
  // kazanılmış kart kimlikleri
  won: string[];
}

const EMPTY: CollectionState = { assignments: {}, won: [] };

// Tüm durumu oku (bozuk/eksik veride güvenli boş döner).
export async function loadCollection(): Promise<CollectionState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<CollectionState> | null;
    return {
      assignments: parsed?.assignments ?? {},
      won: Array.isArray(parsed?.won) ? parsed!.won : [],
    };
  } catch {
    // Test/parse/native hatasında sessizce boş durum.
    return { ...EMPTY };
  }
}

async function persist(state: CollectionState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Yazma başarısızsa sessiz geç (yerel depo; kritik değil).
  }
}

// Bir yemek adına katalog numarası ata (kalıcılaştır).
export async function saveAssignment(name: string, no: number): Promise<void> {
  const state = await loadCollection();
  state.assignments[name] = no;
  await persist(state);
}

// Bir kartı "kazanıldı" olarak işaretle (yinelenmez).
export async function markWon(id: string): Promise<void> {
  const state = await loadCollection();
  if (!state.won.includes(id)) {
    state.won.push(id);
    await persist(state);
  }
}
