// G22-S2 md.4 — Son aramalar YEREL (cihazda) saklanır; sunucuya gitmez.
// Hata → sessiz (liste boş görünür / yazılamazsa oturum içinde kalır).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseRecent, type RecentSearch } from './logic';

export const RECENT_SEARCH_KEY = 'kcal:kesfet:recent_searches:v1';

export async function loadRecentSearches(): Promise<RecentSearch[]> {
  try {
    return parseRecent(await AsyncStorage.getItem(RECENT_SEARCH_KEY));
  } catch {
    return [];
  }
}

export async function saveRecentSearches(list: RecentSearch[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(RECENT_SEARCH_KEY);
    else await AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list));
  } catch {
    /* yut */
  }
}
