// settings TABLOSU (id=1) TEK ÇEKİCİ — S2 performans
//
// `forceUpdate.checkForceUpdate` ve `businessHours.fetchBusinessHours` aynı
// `settings` satırını (id=1) AYRI AYRI sorguluyordu → soğuk açılışta iki ağ
// isteği. İkisi de aynı satırı okuduğu için sütun birleşimini tek sorguda
// çekip kısa bir coalesce penceresinde paylaşıyoruz. Her çağıran kendi
// alanlarını okur; davranış birebir korunur (hata/eksik satır → null).

import { getSupabaseClient } from '../core/supabase';
import { coalesce } from './requestCoalesce';

// forceUpdate + businessHours'un ihtiyaç duyduğu tüm sütunların birleşimi.
const SETTINGS_COLUMNS =
  'min_supported_version, force_update_message, working_days, open_time, close_time, closed_dates, closed_dates_note, holiday_banner_active, holiday_banner_message';

export type SettingsRow = Record<string, unknown> | null;

// Açılışta App (forceUpdate) ile HomeScreen (businessHours) mount'ları
// birbirine çok yakın tetiklendiği için 5 sn'lik pencere ikisini birleştirir;
// sonraki bağımsız çağrılar (ör. yeniden açılan ekran) taze çeker.
const SETTINGS_TTL_MS = 5000;

export function fetchSettingsRow(): Promise<SettingsRow> {
  return coalesce('settings:1', SETTINGS_TTL_MS, async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('settings')
        .select(SETTINGS_COLUMNS)
        .eq('id', 1)
        .maybeSingle();
      if (error) return null;
      return (data as SettingsRow) ?? null;
    } catch {
      return null;
    }
  });
}
