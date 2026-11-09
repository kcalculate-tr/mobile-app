// G20-S3 md.6 (B-11) — bildirim tercihleri, saf kısım (RN/ağ yok → tsx --test).
// Pazarlama varsayılanı KAPALI (açık onay = opt-in); diğer kategoriler açık.

export const MARKETING_DEFAULT = false;

export type NotifyPrefs = {
  transactional_enabled: boolean;
  marketing_enabled: boolean;
  reminder_enabled: boolean;
  behavioral_enabled: boolean;
};

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  transactional_enabled: true,
  marketing_enabled: MARKETING_DEFAULT,
  reminder_enabled: true,
  behavioral_enabled: true,
};

/** Sunucu satırı → tercih (eksik alan: pazarlama KAPALI, diğerleri açık). */
export function prefsFromRow(row: Partial<Record<keyof NotifyPrefs, unknown>> | null | undefined): NotifyPrefs {
  const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    transactional_enabled: b(row?.transactional_enabled, true),
    marketing_enabled: b(row?.marketing_enabled, MARKETING_DEFAULT),
    reminder_enabled: b(row?.reminder_enabled, true),
    behavioral_enabled: b(row?.behavioral_enabled, true),
  };
}
