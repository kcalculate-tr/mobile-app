// Mevcut müşteriye tanıtım "bir kez" bayrağı — AsyncStorage (NATIVE).
// Yeni kabuk (yeni_kabuk) ilk açılışında tanıtım bir kez gösterilir; görülünce
// bu anahtar yazılır ve bir daha açılmaz.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'g12-intro-seen-v1';

export async function readIntroSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Okunamazsa tanıtımı göstermeyi tercih etme (tekrar tekrar açılmasın).
    return true;
  }
}

export async function writeIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // yut
  }
}
