import React, { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CalendarBlank, ForkKnife, Info, Truck } from 'phosphor-react-native'
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme'
import {
  DELIVERIES_PER_DAY, DELIVERY_WINDOWS, DURATIONS, Duration, MEALS_PER_DAY,
  PerDay, SINGLE_MEAL_REFERENCE, formatTRY, mealDistribution, quote,
} from '../../lib/subscriptionPricing'

/**
 * Öğün aboneliği kurucu — İLK ŞABLON.
 *
 * Müşteri dört şeyi seçiyor: süre, günde kaç öğün, günde kaç teslimat,
 * hangi saatler. Altında canlı özet ve fiyat.
 *
 * Şu an yalnızca yerel state ile çalışıyor; satın alma akışı bağlı DEĞİL.
 * Fiyatlar src/lib/subscriptionPricing.ts içindeki ONAYLANMAMIŞ şablondan
 * geliyor. Kalıcı çözümde planlar ve teslimat pencereleri veritabanından
 * okunacak (bkz. proje dokümanı: OGUN_ABONELIGI_MIMARISI.md).
 */

type ChipProps = {
  label: string
  sub?: string
  active: boolean
  disabled?: boolean
  onPress: () => void
}

function Chip({ label, sub, active, disabled, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[s.chip, active && s.chipActive, disabled && s.chipDisabled]}
    >
      <Text style={[s.chipLabel, active && s.chipLabelActive, disabled && s.chipLabelDisabled]}>
        {label}
      </Text>
      {sub ? (
        <Text style={[s.chipSub, active && s.chipSubActive, disabled && s.chipLabelDisabled]}>
          {sub}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}

function Section({ icon, title, hint, children }: {
  icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={s.sectionIcon}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>{title}</Text>
          {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  )
}

export default function SubscriptionBuilder() {
  const [durationDays, setDurationDays] = useState<Duration>(10)
  const [mealsPerDay, setMealsPerDay] = useState<PerDay>(2)
  const [deliveriesPerDay, setDeliveriesPerDay] = useState<PerDay>(1)
  const [windows, setWindows] = useState<string[]>(['noon'])

  // Teslimat sayısı öğün sayısını aşamaz — öğün azalınca teslimatı da indir.
  useEffect(() => {
    if (deliveriesPerDay > mealsPerDay) setDeliveriesPerDay(mealsPerDay)
  }, [mealsPerDay, deliveriesPerDay])

  // Seçili pencere sayısı teslimat sayısına eşitlenir: eksikse sıradaki boş
  // pencere eklenir, fazlaysa sondan kırpılır.
  useEffect(() => {
    setWindows((prev) => {
      if (prev.length === deliveriesPerDay) return prev
      if (prev.length > deliveriesPerDay) return prev.slice(0, deliveriesPerDay)
      const eksik = DELIVERY_WINDOWS.map((w) => w.id).filter((id) => !prev.includes(id))
      return [...prev, ...eksik.slice(0, deliveriesPerDay - prev.length)]
    })
  }, [deliveriesPerDay])

  const q = useMemo(
    () => quote({ durationDays, mealsPerDay, deliveriesPerDay }),
    [durationDays, mealsPerDay, deliveriesPerDay],
  )
  const dagitim = useMemo(
    () => mealDistribution(mealsPerDay, deliveriesPerDay),
    [mealsPerDay, deliveriesPerDay],
  )

  const pencereSec = (id: string) => {
    setWindows((prev) => {
      if (prev.includes(id)) {
        // Son pencere kaldırılamaz — teslimat sayısı kadar seçili kalmalı.
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      if (prev.length >= deliveriesPerDay) {
        // Doluysa en eski seçimi düşür, yenisini al.
        return [...prev.slice(1), id]
      }
      return [...prev, id]
    })
  }

  const secilenPencereler = DELIVERY_WINDOWS.filter((w) => windows.includes(w.id))

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Öğün Aboneliği</Text>
        <View style={s.taslakRozet}><Text style={s.taslakRozetText}>Taslak</Text></View>
      </View>
      <Text style={s.headerSub}>
        Kaç gün, günde kaç öğün ve kaç teslimat istediğini seç. Sonrasında her günün
        öğünlerini kendi panelinden tek tek düzenleyebilirsin.
      </Text>

      <Section icon={<CalendarBlank size={16} color="#000" />} title="Kaç günlük?">
        <View style={s.chipRow}>
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              label={`${d}`}
              sub="gün"
              active={durationDays === d}
              onPress={() => setDurationDays(d)}
            />
          ))}
        </View>
      </Section>

      <Section icon={<ForkKnife size={16} color="#000" />} title="Günde kaç öğün?">
        <View style={s.chipRow}>
          {MEALS_PER_DAY.map((m) => (
            <Chip
              key={m}
              label={`${m}`}
              sub="öğün"
              active={mealsPerDay === m}
              onPress={() => setMealsPerDay(m)}
            />
          ))}
        </View>
      </Section>

      <Section
        icon={<Truck size={16} color="#000" />}
        title="Günde kaç teslimat?"
        hint={mealsPerDay === 1 ? 'Tek öğünde tek teslimat' : 'Öğünleri tek seferde almak en uygunu'}
      >
        <View style={s.chipRow}>
          {DELIVERIES_PER_DAY.map((d) => (
            <Chip
              key={d}
              label={`${d}`}
              sub="teslimat"
              active={deliveriesPerDay === d}
              disabled={d > mealsPerDay}
              onPress={() => setDeliveriesPerDay(d)}
            />
          ))}
        </View>

        {q.extraDeliveriesPerDay > 0 && (
          <View style={s.uyari}>
            <Info size={14} color="#B45309" weight="fill" />
            <Text style={s.uyariText}>
              {`+${q.extraDeliveriesPerDay} teslimat/gün · ${formatTRY(q.deliveryTotal)} — her ek teslimat ayrı kurye demek.`}
            </Text>
          </View>
        )}
      </Section>

      <Section
        icon={<CalendarBlank size={16} color="#000" />}
        title="Teslimat saatleri"
        hint={`${deliveriesPerDay} saat aralığı seç`}
      >
        <View style={s.windowCol}>
          {DELIVERY_WINDOWS.map((w) => {
            const idx = windows.indexOf(w.id)
            const active = idx >= 0
            const adet = active ? dagitim[windows.indexOf(w.id)] : 0
            return (
              <TouchableOpacity
                key={w.id}
                onPress={() => pencereSec(w.id)}
                activeOpacity={0.8}
                style={[s.windowRow, active && s.windowRowActive]}
              >
                <View style={[s.windowDot, active && s.windowDotActive]} />
                <Text style={[s.windowLabel, active && s.windowLabelActive]}>{w.label}</Text>
                <Text style={s.windowRange}>{w.range}</Text>
                {active && adet > 0 && (
                  <View style={s.windowCount}>
                    <Text style={s.windowCountText}>{`${adet} öğün`}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </Section>

      {/* ── Özet ── */}
      <View style={s.ozet}>
        <View style={s.ozetSatir}>
          <Text style={s.ozetEtiket}>Toplam öğün</Text>
          <Text style={s.ozetDeger}>{`${q.totalMeals} öğün`}</Text>
        </View>
        <View style={s.ozetSatir}>
          <Text style={s.ozetEtiket}>Toplam teslimat</Text>
          <Text style={s.ozetDeger}>
            {`${q.totalDeliveries} teslimat · ${secilenPencereler.map((w) => w.label).join(', ')}`}
          </Text>
        </View>
        <View style={s.ozetSatir}>
          <Text style={s.ozetEtiket}>Öğün başı</Text>
          <Text style={s.ozetDeger}>
            {`${formatTRY(q.perMeal)}`}
            <Text style={s.ozetUstuCizili}>{`  ${formatTRY(SINGLE_MEAL_REFERENCE)}`}</Text>
          </Text>
        </View>

        <View style={s.ozetAyrac} />

        <View style={s.ozetSatir}>
          <View>
            <Text style={s.toplamEtiket}>Toplam</Text>
            {q.savingPercent > 0 && (
              <Text style={s.tasarruf}>{`Tekil siparişe göre %${q.savingPercent} avantajlı`}</Text>
            )}
          </View>
          <Text style={s.toplamDeger}>{formatTRY(q.total)}</Text>
        </View>
      </View>

      <TouchableOpacity style={s.cta} activeOpacity={1} disabled>
        <Text style={s.ctaText}>Yakında</Text>
      </TouchableOpacity>
      <Text style={s.ctaNot}>
        Fiyatlar taslaktır. Abonelik satışa açıldığında buradan devam edeceksin.
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: SPACING.lg,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  taslakRozet: {
    backgroundColor: '#F1F1F1', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  taslakRozetText: {
    fontSize: 10, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  headerSub: {
    marginTop: -SPACING.md,
    fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.secondary, lineHeight: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  section: { gap: SPACING.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionIcon: {
    width: 28, height: 28, borderRadius: RADIUS.xs,
    backgroundColor: '#F2FBE8', alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  sectionHint: {
    fontSize: 11, color: COLORS.text.tertiary, marginTop: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  chipRow: { flexDirection: 'row', gap: SPACING.sm },
  chip: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
    backgroundColor: '#F6F6F6', borderWidth: 1, borderColor: 'transparent',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: COLORS.brand.green, borderColor: COLORS.brand.green },
  chipDisabled: { opacity: 0.35 },
  chipLabel: {
    fontSize: TYPOGRAPHY.size.md, color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },
  chipLabelActive: { color: '#000000' },
  chipLabelDisabled: { color: COLORS.text.tertiary },
  chipSub: {
    fontSize: 10, color: COLORS.text.tertiary, marginTop: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  chipSubActive: { color: 'rgba(0,0,0,0.55)' },

  uyari: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#FFF7E6', borderRadius: RADIUS.xs, padding: SPACING.sm,
  },
  uyariText: {
    flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
  },

  windowCol: { gap: 6 },
  windowRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm, backgroundColor: '#F6F6F6',
    borderWidth: 1, borderColor: 'transparent',
  },
  windowRowActive: { backgroundColor: '#F2FBE8', borderColor: COLORS.brand.green },
  windowDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)',
  },
  windowDotActive: { borderColor: COLORS.brand.green, backgroundColor: COLORS.brand.green },
  windowLabel: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.secondary,
    fontFamily: 'PlusJakartaSans_600SemiBold', fontWeight: '600',
  },
  windowLabelActive: { color: COLORS.text.primary, fontFamily: 'PlusJakartaSans_700Bold' },
  windowRange: {
    flex: 1, fontSize: 11, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  windowCount: {
    backgroundColor: COLORS.brand.green, borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  windowCountText: {
    fontSize: 10, color: '#000000',
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },

  ozet: {
    backgroundColor: '#0D0D0D', borderRadius: RADIUS.md,
    padding: SPACING.lg, gap: SPACING.sm,
  },
  ozetSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ozetEtiket: {
    fontSize: TYPOGRAPHY.size.xs, color: 'rgba(255,255,255,0.45)',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  ozetDeger: {
    fontSize: TYPOGRAPHY.size.xs, color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold', fontWeight: '600',
  },
  ozetUstuCizili: {
    color: 'rgba(255,255,255,0.3)', textDecorationLine: 'line-through',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  ozetAyrac: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 2 },
  toplamEtiket: {
    fontSize: TYPOGRAPHY.size.sm, color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  tasarruf: {
    marginTop: 2, fontSize: 11, color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_600SemiBold', fontWeight: '600',
  },
  toplamDeger: {
    fontSize: 24, color: COLORS.brand.green,
    fontFamily: 'PlusJakartaSans_800ExtraBold', fontWeight: '800',
  },

  cta: {
    height: 50, borderRadius: 100, backgroundColor: '#E9E9E9',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: {
    fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary,
    fontFamily: 'PlusJakartaSans_700Bold', fontWeight: '700',
  },
  ctaNot: {
    marginTop: -SPACING.md, textAlign: 'center',
    fontSize: 11, color: COLORS.text.tertiary, lineHeight: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
})
