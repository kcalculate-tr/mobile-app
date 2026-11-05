// autoLogStore — yeni kabukta otomatik loglanan dolap kopyalarının kalıcı
// kümesi (AsyncStorage `@kcal_autolog_pantry_v1`). Kullanıcı otomatik kaydı
// "Kaldır"dıysa aynı kopya bir daha loglanmasın diye tutulur (G13-S1 m.1).
// Depolama okunamaz/yazılamazsa sessizce boş küme ile devam eder.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@kcal_autolog_pantry_v1';
/** Sınırsız büyümesin: en yeni N kayıt tutulur (dolap penceresi 30 gün). */
const MAX = 500;

export async function loadAutoLogged(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function markAutoLogged(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const cur = await loadAutoLogged();
    for (const id of ids) {
      cur.delete(id);
      cur.add(id);
    }
    const arr = Array.from(cur).slice(-MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    // yazılamadı — bir sonraki açılışta `consumed` kümesi yine korur
  }
}
