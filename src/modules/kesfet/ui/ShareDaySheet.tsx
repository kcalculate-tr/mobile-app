// G22-S2 md.5 (Tur 26j, G21 T2 — FinShareDay) — "Günümü Keşfet’te paylaş" sheet'i.
// Keşfet'teki "Günüme paylaş" eylemi açar. İçerik (Final sırası): başlık + açıklama +
// Kapat · önizleme kartı (Sen · Bugün, halka %, "N / N kcal", P·K·Y çipleri, günün
// etkinliği, öğün kutucukları) · [seçenekler] · Paylaş. Paylaşınca sheet kapanır,
// Keşfet'te "Günün … paylaşıldı" bildirimi çıkar (FinShareDaySuccess, çağıranda).
//
// Gönderim: bugünün öğünleri Günüm halkasına (share_meal_to_day — bkz. gun/shareDay).
// Hata: satır içi uyarı + "Tekrar dene" (sheet açık kalır, seçimler kaybolmaz).
// Seçenekler (makro göster / Kimler görebilir / Not) sunucu alanı gelene kadar
// gizli (`SHARE_DAY_SERVER_OPTIONS`); vitrin `options` ile tasarım karesini çizer.
// Hareket: BottomSheet (SPRING.sheet, azaltılmış harekete uyar) + FinErrorReveal.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  AppText,
  Button,
  FinErrorReveal,
  FinSkeletonBlock,
  ProgressRing,
  fontFamily,
  haptic,
  useTheme,
} from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import { Globe } from '../../../components/icons';
import { getGunClient } from '../../gun/client';
import { getTodayConsumptions } from '../../gun/todayConsumptions';
import {
  SHARE_DAY_SERVER_OPTIONS,
  SHARE_NOTE_MAX,
  buildShareDayCard,
  canShareDay,
  clampShareNote,
  submitShareDay,
  type ShareAudience,
  type ShareDayCard,
  type ShareDaySummary,
} from '../../gun/shareDay';
import { getKesfetClient } from '../client';
import { Avatar } from './Avatar';
import { BottomSheet } from './BottomSheet';
import { Icon } from './icons';

// Phosphor WarningCircle (regular) — satır içi hata ikonu.
const WARNING =
  'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z';

type LoadState = { kind: 'loading' } | { kind: 'ready'; card: ShareDayCard } | { kind: 'error' };

/** Varsayılan yükleyici: bugünkü öğünler + etkinlik (+ çağıranın sunucu özeti). */
async function defaultLoad(summary: ShareDaySummary | null | undefined): Promise<ShareDayCard> {
  const [meals, activity] = await Promise.all([
    getTodayConsumptions(),
    getKesfetClient()
      .getMyDayActivity()
      .catch(() => null), // etkinlik isteğe bağlı — yoksa satır gizli
  ]);
  return buildShareDayCard({ meals, summary, activity });
}

async function defaultSubmit(ids: string[]): Promise<void> {
  await submitShareDay(getGunClient(), ids);
}

export interface ShareDaySheetProps {
  visible: boolean;
  onClose: () => void;
  /** Başarı — çağıran sheet'i kapatır ve FinShareDaySuccess bildirimini gösterir. */
  onShared: (audience: ShareAudience) => void;
  /** `useNutritionSummary` (gün toplamı + hedef). Yoksa öğün toplamı, yüzde yok. */
  summary?: ShareDaySummary | null;
  avatarUrl?: string | null;
  displayName?: string;
  /** Seçenekler bölümü (varsayılan SHARE_DAY_SERVER_OPTIONS). Vitrin true geçer. */
  options?: boolean;
  /** Test / vitrin: veri yükleyici ve gönderici enjeksiyonu. */
  load?: () => Promise<ShareDayCard>;
  submit?: (consumptionIds: string[]) => Promise<void>;
  /** YALNIZ vitrin: gönderim hatası karesi. */
  initialError?: boolean;
}

export function ShareDaySheet({
  visible,
  onClose,
  onShared,
  summary,
  avatarUrl = null,
  displayName = '',
  options = SHARE_DAY_SERVER_OPTIONS,
  load,
  submit = defaultSubmit,
  initialError = false,
}: ShareDaySheetProps) {
  const t = useTheme();
  const { t: tr } = useT();
  const { height: screenH } = useWindowDimensions();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(initialError);
  const [macros, setMacros] = useState(true);
  const [audience, setAudience] = useState<ShareAudience>('followers');
  const [note, setNote] = useState('');

  const reload = useCallback(() => {
    setState({ kind: 'loading' });
    const run = load ?? (() => defaultLoad(summary));
    run()
      .then((card) => setState({ kind: 'ready', card }))
      .catch(() => setState({ kind: 'error' }));
  }, [load, summary]);

  // Her açılışta taze veri; seçimler varsayılana döner.
  useEffect(() => {
    if (!visible) return;
    setSendError(initialError);
    setSending(false);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const card = state.kind === 'ready' ? state.card : null;
  const canShare = canShareDay(card) && !sending;

  const share = async () => {
    if (!card || !canShare) return;
    haptic('light');
    setSending(true);
    setSendError(false);
    try {
      await submit(card.consumptionIds);
      haptic('success');
      setSending(false);
      // Seçenekler kapalıyken görünürlük profil gizliliğinden gelir → genel metin.
      onShared(options ? audience : 'public');
    } catch {
      setSending(false);
      setSendError(true);
    }
  };

  const showMacros = !options || macros;

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={tr('share_day.title')}>
      {/* Başlık + Kapat (44 pt dokunma, 32 pt daire) */}
      <View style={styles.head}>
        <View style={styles.headText}>
          <AppText accessibilityRole="header" style={[styles.title, { color: t.color.ink }]}>
            {tr('share_day.title')}
          </AppText>
          <AppText style={[styles.sub, { color: t.color.secondary }]}>{tr('share_day.sub')}</AppText>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={tr('share_day.close')}
          testID="share-day-close"
          style={styles.closeHit}
        >
          <View style={[styles.closeDot, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,10,0.06)' }]}>
            <Icon name="x" size={16} color={t.color.ink} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={{ maxHeight: screenH * 0.62 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {state.kind === 'loading' ? (
          <View accessible accessibilityRole="progressbar" accessibilityLabel={tr('share_day.loading')} testID="share-day-loading">
            <FinSkeletonBlock height={232} radius={20} />
          </View>
        ) : state.kind === 'error' ? (
          <InlineError message={tr('share_day.load_error')} onRetry={reload} testID="share-day-load-error" />
        ) : card && !canShareDay(card) ? (
          <AppText style={[styles.empty, { color: t.color.secondary }]} testID="share-day-empty">
            {tr('share_day.empty')}
          </AppText>
        ) : card ? (
          <PreviewCard
            card={card}
            showMacros={showMacros}
            audience={options ? audience : null}
            note={options ? note.trim() : ''}
            avatarUrl={avatarUrl}
            displayName={displayName}
          />
        ) : null}

        {options && card && canShareDay(card) ? (
          <>
            <View style={[styles.switchRow, { borderBottomColor: t.color.line }]}>
              <AppText style={[styles.switchLabel, { color: t.color.ink }]}>{tr('share_day.show_macros')}</AppText>
              <Switch
                value={macros}
                onValueChange={setMacros}
                accessibilityLabel={tr('share_day.show_macros')}
                trackColor={{ true: t.color.accent, false: t.isDark ? '#48484A' : '#C3C7CC' }}
                ios_backgroundColor={t.isDark ? '#48484A' : '#C3C7CC'}
                testID="share-day-macros"
              />
            </View>

            <AppText style={[styles.groupLabel, { color: t.color.secondary }]}>{tr('share_day.who')}</AppText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={tr('share_day.who')}
              style={[styles.radioCard, { backgroundColor: t.color.surfaceRaised, borderColor: t.color.line }]}
            >
              {(['public', 'followers'] as const).map((opt, i) => {
                const on = audience === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      haptic('selection');
                      setAudience(opt);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${tr(opt === 'public' ? 'share_day.pub' : 'share_day.fol')}, ${tr(opt === 'public' ? 'share_day.pub_sub' : 'share_day.fol_sub')}`}
                    testID={`share-day-aud-${opt}`}
                    style={[styles.radioRow, i > 0 && { borderTopWidth: 1, borderTopColor: t.color.line }]}
                  >
                    {opt === 'public' ? <Globe size={22} color={t.color.ink} /> : <Icon name="users" size={22} color={t.color.ink} />}
                    <View style={styles.radioText}>
                      <AppText style={[styles.radioTitle, { color: t.color.ink }]}>
                        {tr(opt === 'public' ? 'share_day.pub' : 'share_day.fol')}
                      </AppText>
                      <AppText style={[styles.radioSub, { color: t.color.secondary }]}>
                        {tr(opt === 'public' ? 'share_day.pub_sub' : 'share_day.fol_sub')}
                      </AppText>
                    </View>
                    <View
                      style={[
                        styles.radioDot,
                        on
                          ? { backgroundColor: t.color.accent }
                          : { borderWidth: 2, borderColor: t.isDark ? '#48484A' : '#C3C7CC' },
                      ]}
                    >
                      {on ? <Icon name="check" size={12} color={t.color.onAccent} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.noteHead}>
              <AppText style={[styles.groupLabel, styles.noteLabel, { color: t.color.secondary }]}>
                {tr('share_day.note_label')}
              </AppText>
              <AppText style={[styles.noteCount, { color: t.color.secondary }]} importantForAccessibility="no">
                {`${note.length}/${SHARE_NOTE_MAX}`}
              </AppText>
            </View>
            <TextInput
              value={note}
              onChangeText={(v) => setNote(clampShareNote(v))}
              maxLength={SHARE_NOTE_MAX}
              placeholder={tr('share_day.note_ph')}
              placeholderTextColor={t.color.secondary}
              accessibilityLabel={tr('share_day.note_label')}
              style={[
                styles.note,
                { color: t.color.ink, backgroundColor: t.color.surfaceRaised, borderColor: t.isDark ? '#48484A' : '#C3C7CC' },
              ]}
              testID="share-day-note"
            />
          </>
        ) : null}

        {sendError ? (
          <InlineError message={tr('share_day.error')} onRetry={() => void share()} testID="share-day-send-error" />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={tr('share_day.share')}
          onPress={() => void share()}
          disabled={!canShare}
          haptic={null}
          testID="share-day-submit"
        />
      </View>
    </BottomSheet>
  );
}

/** Önizleme kartı (Final: radius 20, iç 1 px çizgi, dolgu 14). */
function PreviewCard({
  card,
  showMacros,
  audience,
  note,
  avatarUrl,
  displayName,
}: {
  card: ShareDayCard;
  showMacros: boolean;
  audience: ShareAudience | null;
  note: string;
  avatarUrl: string | null;
  displayName: string;
}) {
  const t = useTheme();
  const { t: tr, fmt, lang } = useT();
  const chip = t.isDark ? '#3A3A3C' : '#F3F4F6';
  const track = t.isDark ? '#48484A' : '#DCDEE2';
  const pctText = card.pct != null ? tr('share_day.ring_a11y', { pct: fmt(card.pct) }) : undefined;

  return (
    <View
      accessibilityLabel={tr('share_day.preview')}
      testID="share-day-preview"
      style={[styles.card, { backgroundColor: t.color.surfaceRaised, borderColor: t.color.line }]}
    >
      <View style={styles.cardTop}>
        <Avatar name={displayName || tr('share_day.you')} url={avatarUrl} size={28} />
        <AppText style={[styles.you, { color: t.color.ink }]}>{tr('share_day.you')}</AppText>
        <AppText style={[styles.today, { color: t.color.secondary }]}>{tr('share_day.today')}</AppText>
        {audience ? (
          <View style={[styles.audChip, { backgroundColor: chip }]}>
            {audience === 'public' ? <Globe size={14} color={t.color.ink} /> : <Icon name="users" size={14} color={t.color.ink} />}
            <AppText style={[styles.chipText, { color: t.color.ink }]}>
              {tr(audience === 'public' ? 'share_day.pub' : 'share_day.fol')}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.cardMid}>
        <View accessible accessibilityRole="image" accessibilityLabel={pctText} importantForAccessibility={pctText ? 'yes' : 'no'}>
          <ProgressRing progress={showMacros ? card.progress : 0} size={76} strokeWidth={7} color={t.color.accentLine} trackColor={track}>
            {showMacros && card.pct != null ? (
              <AppText style={[styles.pct, { color: t.color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                {lang === 'en' ? `${fmt(card.pct)}%` : `%${fmt(card.pct)}`}
              </AppText>
            ) : null}
          </ProgressRing>
        </View>
        <View style={styles.cardStats}>
          {showMacros ? (
            <>
              <AppText style={[styles.kcal, { color: t.color.ink }]} testID="share-day-kcal">
                {card.targetKcal
                  ? tr('share_day.kcal_of', { kcal: fmt(card.kcal), target: fmt(card.targetKcal) })
                  : tr('share_day.kcal_only', { kcal: fmt(card.kcal) })}
              </AppText>
              {card.macros ? (
                <View style={styles.chips}>
                  {(
                    [
                      ['share_day.macro_p', card.macros.p],
                      ['share_day.macro_c', card.macros.c],
                      ['share_day.macro_f', card.macros.f],
                    ] as const
                  ).map(([key, g]) => (
                    <View key={key} style={[styles.macroChip, { backgroundColor: chip }]}>
                      <AppText style={[styles.chipText, { color: t.color.ink }]}>{tr(key, { g: fmt(g) })}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <AppText style={[styles.hidden, { color: t.color.secondary }]}>{tr('share_day.hidden')}</AppText>
          )}
          {card.activity ? (
            <View style={styles.activity}>
              <Icon name="run" size={16} color={t.color.ink} />
              <AppText style={[styles.activityText, { color: t.color.ink }]}>
                {`${tr(`kesfet.activity.type.${card.activity.type}`)} ${tr('kesfet.activity.minutes', { n: fmt(card.activity.minutes) })}`}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {card.meals.length > 0 ? (
        <View accessibilityLabel={tr('share_day.meals')} style={styles.meals}>
          {card.meals.slice(0, 4).map((m) => (
            <View key={m.meal} style={[styles.mealTile, { backgroundColor: chip }]}>
              <View style={[styles.mealThumb, { backgroundColor: track }]}>
                {m.photo_url ? <CachedImage uri={m.photo_url} style={styles.mealImg} /> : null}
              </View>
              <AppText style={[styles.mealLabel, { color: t.color.ink }]} numberOfLines={1}>
                {tr(`meal.${m.meal}`)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {note ? <AppText style={[styles.noteText, { color: t.color.ink }]}>{note}</AppText> : null}
    </View>
  );
}

/** Satır içi hata + "Tekrar dene" (sheet içinde; kırmızı yok, sakin). */
function InlineError({ message, onRetry, testID }: { message: string; onRetry: () => void; testID?: string }) {
  const t = useTheme();
  const { t: tr } = useT();
  return (
    <FinErrorReveal>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        testID={testID}
        style={[styles.err, { backgroundColor: t.color.surfaceRaised, borderColor: t.isDark ? '#48484A' : '#C3C7CC' }]}
      >
        <Svg width={20} height={20} viewBox="0 0 256 256" accessible={false}>
          <Path d={WARNING} fill={t.color.ink} />
        </Svg>
        <AppText style={[styles.errText, { color: t.color.ink }]}>{message}</AppText>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={tr('share_day.retry')}
          style={({ pressed }) => [styles.errBtn, { borderColor: t.color.ink, opacity: pressed ? 0.85 : 1 }]}
        >
          <AppText style={[styles.errBtnText, { color: t.color.ink }]}>{tr('share_day.retry')}</AppText>
        </Pressable>
      </View>
    </FinErrorReveal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 4 },
  headText: { flex: 1, minWidth: 0, paddingTop: 6 },
  title: { fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 26 },
  sub: { marginTop: 4, fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  closeHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  closeDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 12, paddingBottom: 4, gap: 0 },
  empty: { paddingVertical: 24, fontFamily: fontFamily.bodyRegular, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  card: { padding: 14, borderRadius: 20, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  you: { fontFamily: fontFamily.bodyBold, fontSize: 14 },
  today: { fontFamily: fontFamily.bodyRegular, fontSize: 14 },
  audChip: { marginLeft: 'auto', minHeight: 24, paddingHorizontal: 9, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  cardMid: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  pct: { fontFamily: fontFamily.headingBold, fontSize: 17, maxWidth: 56 },
  cardStats: { flex: 1, minWidth: 0, gap: 6 },
  kcal: { fontFamily: fontFamily.headingBold, fontSize: 20, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  macroChip: { minHeight: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: 'center' },
  hidden: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityText: { fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  meals: { marginTop: 12, flexDirection: 'row', gap: 8 },
  mealTile: { flex: 1, minWidth: 0, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  mealThumb: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  mealImg: { width: '100%', height: '100%' },
  mealLabel: { fontFamily: fontFamily.bodyBold, fontSize: 12, textAlign: 'center' },
  noteText: { marginTop: 10, fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20 },
  switchRow: { marginTop: 8, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  switchLabel: { flex: 1, minWidth: 0, fontFamily: fontFamily.bodySemibold, fontSize: 15 },
  groupLabel: { marginTop: 14, fontFamily: fontFamily.bodyBold, fontSize: 13 },
  radioCard: { marginTop: 6, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  radioRow: { minHeight: 60, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioText: { flex: 1, minWidth: 0 },
  radioTitle: { fontFamily: fontFamily.bodySemibold, fontSize: 15 },
  radioSub: { fontFamily: fontFamily.bodyRegular, fontSize: 13 },
  radioDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  noteHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  noteLabel: { flexShrink: 1 },
  noteCount: { fontFamily: fontFamily.bodyRegular, fontSize: 12 },
  note: { marginTop: 6, minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: fontFamily.bodyRegular },
  err: { marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  errText: { flex: 1, minWidth: 160, fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 20 },
  errBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  errBtnText: { fontFamily: fontFamily.bodyBold, fontSize: 15 },
  footer: { paddingTop: 14 },
});
