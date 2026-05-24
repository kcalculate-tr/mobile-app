import { getSupabaseClient } from './supabase'

export interface BusinessHours {
  working_days: number[]      // 1=Pzt, 2=Sal, ... 7=Paz
  open_time: string           // '09:00'
  close_time: string          // '21:00'
  closed_dates: string[]      // ['2026-01-01', ...]
  closed_dates_note: Record<string, string> // {'2026-01-01': 'Yılbaşı'}
  holiday_banner_active: boolean
  holiday_banner_message: string | null
}

const DEFAULT: BusinessHours = {
  working_days: [1, 2, 3, 4, 5],
  open_time: '09:00',
  close_time: '21:00',
  closed_dates: [],
  closed_dates_note: {},
  holiday_banner_active: false,
  holiday_banner_message: null,
}

export async function fetchBusinessHours(): Promise<BusinessHours> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('working_days, open_time, close_time, closed_dates, closed_dates_note, holiday_banner_active, holiday_banner_message')
    .eq('id', 1)
    .maybeSingle()
  if (!data) return DEFAULT
  return {
    working_days: data.working_days ?? DEFAULT.working_days,
    open_time:    data.open_time    ?? DEFAULT.open_time,
    close_time:   data.close_time   ?? DEFAULT.close_time,
    closed_dates: data.closed_dates ?? [],
    closed_dates_note: data.closed_dates_note ?? {},
    holiday_banner_active: data.holiday_banner_active ?? false,
    holiday_banner_message: data.holiday_banner_message ?? null,
  }
}

// JS Date → ISO hafta günü (1=Pzt, 7=Paz)
export function isoWeekday(date: Date): number {
  const d = date.getDay()
  return d === 0 ? 7 : d
}

// Local-timezone YYYY-MM-DD. Use this for any DATE column or local-day match
// (closed_dates, scheduled_date, etc.). Avoid toISOString() — it shifts to UTC
// and rolls back one day for local-midnight Date instances in UTC+3.
export function toLocalDateStr(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** @deprecated Use toLocalDateStr — toDateStr now aliases to it for backwards compat. */
export function toDateStr(date: Date): string {
  return toLocalDateStr(date)
}

// Şu an mağaza açık mı? (hemen/gel-al için)
export function isShopOpenNow(bh: BusinessHours): boolean {
  const now = new Date()
  const day = isoWeekday(now)
  if (!bh.working_days.includes(day)) return false
  if (bh.closed_dates.includes(toDateStr(now))) return false

  const [oh, om] = bh.open_time.split(':').map(Number)
  const [ch, cm] = bh.close_time.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const openMins = oh * 60 + om
  const closeMins = ch * 60 + cm
  return nowMins >= openMins && nowMins < closeMins
}

// Belirli bir tarih randevulu teslimat için geçerli mi?
// working_days (settings.working_days, ISO 1=Pzt..7=Paz) tek otorite — admin
// hafta sonunu açabilir. Tatil günleri closed_dates'ten kontrol edilir.
export function isDateAvailableForScheduled(date: Date, bh: BusinessHours): boolean {
  const day = isoWeekday(date)
  if (!bh.working_days.includes(day)) return false           // Çalışma günü değil
  if (bh.closed_dates.includes(toLocalDateStr(date))) return false // Tatil
  return true
}

// Önümüzdeki N gün içinde randevulu teslimat için geçerli tarihler
export function getAvailableScheduledDates(bh: BusinessHours, daysAhead = 14): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    if (isDateAvailableForScheduled(d, bh)) dates.push(d)
  }
  return dates
}

// Kapalı saatlere kalan süre (dk) — negatifse açık
export function minutesUntilOpen(bh: BusinessHours): number | null {
  const now = new Date()
  const [oh, om] = bh.open_time.split(':').map(Number)
  const openMins = oh * 60 + om
  const nowMins = now.getHours() * 60 + now.getMinutes()
  if (nowMins < openMins) return openMins - nowMins
  return null
}

export function formatTime(t: string): string {
  return t.slice(0, 5)
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba',
  4: 'Perşembe', 5: 'Cuma', 6: 'Cumartesi', 7: 'Pazar',
}
