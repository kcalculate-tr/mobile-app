// eatkcal v2 (G15-S5 md.5) — "Sipariş değişikliği" (iptal / tarih / adres talebi).
//
// Bugün bu talepler 1.0.7 OrderDetailScreen'de (eski BottomSheet + COLORS);
// v2 detaydan oraya gidiliyordu. Final'de ayrı panosu yok → Final diliyle
// yeniden giydirildi (EkCard + ortak Sheet). MANTIK AYNI:
//  - kurallar: model/changeRequest.ts (OrderDetailScreen:311-331 birebir)
//  - servis: createOrderModification / getOrderModifications (src/lib/orders.ts)
//  - tarih: en erken +48 sa, bölgenin teslimat günleri (isDeliveryDay) —
//    OrderDetailScreen:250-300 ile aynı sorgu (addresses.district → delivery_zones)
//  - adres: kullanıcının adresleri (aynı select), seçilince address_change talebi
//  - hemen teslimde 30 dk sonra: destek (ProfileSupport)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../../../core/design/components/FinText';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Sheet, haptic } from '../../../../../core/design';
import { CalendarBlank, MapPin, XCircle, Headset } from '../../../../../components/icons';
import { getSupabaseClient } from '../../../../../core/supabase';
import {
  createOrderModification,
  getOrderModifications,
  type OrderModification,
  type OrderModificationType,
} from '../../../../../lib/orders';
import { mapSupabaseErrorToUserMessage } from '../../../../../lib/supabaseErrors';
import { formatDeliveryDaysFull, isDeliveryDay, DAY_NAMES_FULL } from '../../../../../utils/deliveryDays';
import { changeOptions, isoDay, parseDeliveryDays } from '../../model/changeRequest';
import { EkCard, ekType, useEk } from '../kit';
import { EkInkButton } from './OrdersParts';

type OrderLike = {
  id: number;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  created_at: string;
  address_id: string | null;
};

type AddressRow = { id: string; title: string; full_address: string };

const MIN_AHEAD_MS = 48 * 60 * 60 * 1000;

export function ChangeRequestCard({
  order,
  userId,
  onSupport,
}: {
  order: OrderLike;
  userId: string | null;
  onSupport: () => void;
}) {
  const { c, t, lang } = useEk();
  const [mods, setMods] = useState<OrderModification[]>([]);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState<number[] | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateValue, setDateValue] = useState<Date>(new Date(Date.now() + MIN_AHEAD_MS));
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrs, setAddrs] = useState<AddressRow[]>([]);
  const [addrsLoading, setAddrsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setMods(await getOrderModifications(String(order.id)));
    } catch {
      /* sessiz — bugünkü ekranla aynı */
    }
  }, [order.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Bölgenin randevulu teslimat günleri (OrderDetailScreen:250-300 ile aynı sorgu).
  useEffect(() => {
    if (!order.address_id) {
      setDays(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: a } = await supabase.from('addresses').select('district').eq('id', order.address_id).maybeSingle();
        const district = String((a as Record<string, unknown> | null)?.district ?? '').trim();
        if (!district) return;
        const { data: z } = await supabase
          .from('delivery_zones')
          .select('delivery_days_scheduled, delivery_days')
          .eq('district', district)
          .limit(1);
        const row = Array.isArray(z) && z.length > 0 ? (z[0] as Record<string, unknown>) : null;
        if (mounted) setDays(parseDeliveryDays(row ? row.delivery_days_scheduled ?? row.delivery_days : null));
      } catch {
        if (mounted) setDays(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [order.address_id]);

  const opts = useMemo(() => changeOptions(order), [order]);
  const latest = mods[0] ?? null;
  const pending = mods.find((m) => m.status === 'pending') ?? null;
  const any = opts.canCancel || opts.canChangeDate || opts.canChangeAddress || opts.showSupportFallback;

  const submit = async (type: OrderModificationType, extra: Record<string, string | undefined>, failKey: string) => {
    setBusy(true);
    try {
      await createOrderModification({ orderId: String(order.id), type, ...extra });
      await load();
      haptic('success');
      Alert.alert(t('eatkcal.v2.change.done_title'), t(`eatkcal.v2.change.done_${type}`));
    } catch (err: unknown) {
      Alert.alert(t('eatkcal.v2.cards.error_title'), mapSupabaseErrorToUserMessage(err, t(failKey)));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = () =>
    Alert.alert(t('eatkcal.v2.change.cancel_title'), t('eatkcal.v2.change.cancel_body'), [
      { text: t('eatkcal.v2.cards.cancel'), style: 'cancel' },
      { text: t('eatkcal.v2.change.cancel_confirm'), style: 'destructive', onPress: () => void submit('cancel', {}, 'eatkcal.v2.change.cancel_failed') },
    ]);

  const pickDate = (d: Date) => {
    if (!isDeliveryDay(d, days)) {
      Alert.alert(
        t('eatkcal.v2.change.no_delivery_title'),
        t('eatkcal.v2.change.no_delivery_body', { day: DAY_NAMES_FULL[d.getDay()], days: formatDeliveryDaysFull(days) }),
      );
      return;
    }
    void submit('date_change', { newScheduledDate: isoDay(d), newScheduledTime: order.scheduled_time ?? undefined }, 'eatkcal.v2.change.date_failed');
  };

  const openDate = () => {
    const base = order.scheduled_date ? new Date(order.scheduled_date) : new Date();
    base.setDate(base.getDate() + 1);
    setDateValue(base);
    setDateOpen(true);
  };

  const openAddresses = async () => {
    if (!userId) return;
    setAddrOpen(true);
    setAddrsLoading(true);
    try {
      const { data, error } = await getSupabaseClient()
        .from('addresses')
        .select('id, title, full_address, district')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAddrs(
        (Array.isArray(data) ? data : [])
          .map((r) => {
            const row = r as Record<string, unknown>;
            return { id: String(row.id ?? ''), title: String(row.title ?? ''), full_address: String(row.full_address ?? '') };
          })
          .filter((r) => r.id),
      );
    } catch (err: unknown) {
      Alert.alert(t('eatkcal.v2.cards.error_title'), mapSupabaseErrorToUserMessage(err, t('eatkcal.v2.change.addresses_failed')));
    } finally {
      setAddrsLoading(false);
    }
  };

  if (!latest && !any) return null;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long' });
  };

  return (
    <EkCard style={{ gap: 10 }} testID="ek-order-change">
      <Text style={[ekType.h20, { color: c.ink }]} accessibilityRole="header">
        {t('eatkcal.v2.change.title')}
      </Text>

      {latest ? (
        <View style={[styles.banner, { backgroundColor: latest.status === 'approved' ? c.accent : c.line }]} accessibilityRole="summary">
          <Text style={[ekType.b15s, { color: latest.status === 'approved' ? c.onAccent : latest.status === 'rejected' ? c.danger : c.ink }]}>
            {t(`eatkcal.v2.change.status_${latest.type}_${latest.status}`)}
          </Text>
          {latest.status === 'rejected' && latest.reject_reason ? (
            <Text style={[ekType.c13, { color: c.ink }]}>{t('eatkcal.v2.change.reason', { reason: latest.reject_reason })}</Text>
          ) : null}
          {latest.type === 'date_change' && latest.new_scheduled_date ? (
            <Text style={[ekType.c13, { color: c.ink }]}>
              {t('eatkcal.v2.change.new_date', {
                date: `${fmtDate(latest.new_scheduled_date)}${latest.new_scheduled_time ? `, ${latest.new_scheduled_time.slice(0, 5)}` : ''}`,
              })}
            </Text>
          ) : null}
          {latest.type === 'address_change' && latest.new_address_text ? (
            <Text style={[ekType.c13, { color: c.ink }]}>{t('eatkcal.v2.change.new_address', { address: latest.new_address_text })}</Text>
          ) : null}
        </View>
      ) : null}

      {pending || !any ? null : (
        <View style={{ gap: 8 }}>
          {opts.canChangeDate ? <Action icon={<CalendarBlank size={20} color={c.ink} />} label={t('eatkcal.v2.change.date')} onPress={openDate} disabled={busy} /> : null}
          {opts.canChangeAddress ? <Action icon={<MapPin size={20} color={c.ink} />} label={t('eatkcal.v2.change.address')} onPress={openAddresses} disabled={busy} /> : null}
          {opts.canCancel ? <Action icon={<XCircle size={20} color={c.danger} />} label={t('eatkcal.v2.change.cancel')} onPress={onCancel} disabled={busy} danger /> : null}
          {opts.showSupportFallback ? <Action icon={<Headset size={20} color={c.ink} />} label={t('eatkcal.v2.change.support')} onPress={onSupport} /> : null}
        </View>
      )}
      {busy ? <ActivityIndicator color={c.ink} /> : null}

      {/* Tarih: Android sistem seçicisi; iOS ortak Sheet içinde döndürücü */}
      {dateOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          mode="date"
          display="default"
          value={dateValue}
          minimumDate={new Date(Date.now() + MIN_AHEAD_MS)}
          onChange={(_e: unknown, d?: Date) => {
            setDateOpen(false);
            if (d) pickDate(d);
          }}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet visible={dateOpen} onClose={() => setDateOpen(false)} title={t('eatkcal.v2.change.date_title')} product="eat">
          <DateTimePicker
            mode="date"
            display="spinner"
            value={dateValue}
            minimumDate={new Date(Date.now() + MIN_AHEAD_MS)}
            onChange={(_e: unknown, d?: Date) => {
              if (d) setDateValue(d);
            }}
          />
          <EkInkButton
            label={t('eatkcal.v2.change.confirm')}
            onPress={() => {
              setDateOpen(false);
              pickDate(dateValue);
            }}
          />
        </Sheet>
      ) : null}

      <Sheet visible={addrOpen} onClose={() => setAddrOpen(false)} title={t('eatkcal.v2.change.address_title')} product="eat">
        {addrsLoading ? (
          <ActivityIndicator color={c.ink} style={{ padding: 24 }} />
        ) : addrs.length === 0 ? (
          <Text style={[ekType.b15, { color: c.secondary, paddingVertical: 16 }]}>{t('eatkcal.v2.change.no_addresses')}</Text>
        ) : (
          <View>
            {addrs.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  setAddrOpen(false);
                  void submit('address_change', { newAddressId: a.id, newAddressText: a.full_address }, 'eatkcal.v2.change.address_failed');
                }}
                accessibilityRole="button"
                style={[styles.addrRow, { borderBottomColor: c.line }]}
              >
                <MapPin size={20} color={c.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={[ekType.b15s, { color: c.ink }]}>{a.title}</Text>
                  <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
                    {a.full_address}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>
    </EkCard>
  );
}

function Action({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { c } = useEk();
  return (
    <Pressable
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, { borderColor: c.line }, (pressed || disabled) && { opacity: 0.6 }]}
    >
      {icon}
      <Text style={[ekType.b15s, { color: danger ? c.danger : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 14, padding: 12, gap: 2 },
  action: { minHeight: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56 },
});
