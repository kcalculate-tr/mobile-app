// eatkcal şehir kapısı — yerel kalıcılık (NATIVE). Testlerde import EDİLMEZ
// (bkz. cityGate.ts, saf katalog). "Bir kez sor" ilkesi: kapı geçilince bir
// daha hiç gösterilmez. "Haber ver" tercihleri SUNUCUYA gitmez, yalnız bu
// cihazda tutulur (G6-S4 md.2: "yalnız yerel tercih kaydı").
import AsyncStorage from '@react-native-async-storage/async-storage';

const PASSED_KEY = 'eatkcal-city-gate-passed';
const NOTIFY_KEY = 'eatkcal-city-notify';

export async function readCityGatePassed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PASSED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeCityGatePassed(): Promise<void> {
  try {
    await AsyncStorage.setItem(PASSED_KEY, '1');
  } catch {
    // yut — en kötü ihtimalle kapı bir kez daha sorulur
  }
}

export async function readNotifyCities(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function addNotifyCity(cityKey: string): Promise<string[]> {
  const current = await readNotifyCities();
  if (current.includes(cityKey)) return current;
  const next = [...current, cityKey];
  try {
    await AsyncStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
  } catch {
    // yut
  }
  return next;
}
