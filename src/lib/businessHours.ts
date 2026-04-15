import { getSupabaseClient } from './supabase'

export interface BusinessHours {
  working_days: number[]      // 1=Pzt, 2=Sal, ... 7=Paz
  open_time: string           // '09:00'
  close_time: string          // '21:00'
  closed_dates: string[]      // ['2026-01-01', ...]
  closed_dates_note: Record<string, string> // {'2026-01-01': 'Yılbaşı'}
}

const DEFAULT: BusinessHours = {
  working_days: [1, 2, 3, 4, 5],
  open_time: '09:00',
  close_time: '21:00',
  closed_dates: [],
  closed_dates_note: {},
}

export async function fetchBusinessHours(): Promise<BusinessHours> {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('working_days, open_time, close_time, closed_dates, closed_dates_note')
    .eq('id', 1)
    .maybeSingle()
  if (!data) return DEFAULT
  return {
    working_days: data.working_days ?? DEFAULT.working_days,
    open_time:    data.open_time    ?? DEFAULT.open_time,
    close_time:   data.close_time   ?? DEFAULT.close_time,
    closed_dates: data.closed_dates ?? [],
    closed_dates_note: data.closed_dates_note ?? {},
  }
}

// JS Date → ISO hafta günü (1=Pzt, 7=Paz)
export function isoWeekday(date: Date): number {
  const d = date.getDay()
  return d === 0 ? 7 : d
}

export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
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
export function isDateAvailableForScheduled(date: Date, bh: BusinessHours): boolean {
  const day = isoWeekday(date)
  if (day === 6 || day === 7) return false              // Hafta sonu yasak
  if (!bh.working_days.includes(day)) return false     // Çalışma günü değil
  if (bh.closed_dates.includes(toDateStr(date))) return false // Tatil
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
