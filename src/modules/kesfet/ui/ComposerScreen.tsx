// Composer — G8 (yalnız `kesfet_paylasim` açıkken; AppNavigator). HERKES paylaşır.
// Tür: Serbest / Öğün / Etkinlik. Metin + en fazla 4 fotoğraf (video YOK).
// Öğün kartı: elle ad + kcal + P/K/Y (ürün arama / AI sonucu sonraki tur).
// Etkinlik kartı: tür, süre, mesafe (ops.), CANLI tahmini kcal. Gönder →
// create_post → moderate-content → "Paylaşılıyor… / İnceleniyor". Hatalar:
// hız sınırı, ağ, reddedildi.
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';

import { getKesfetClient } from '../client';
import { useKesfetStore } from '../store';
import {
  ACTIVITY_TYPES,
  type ActivityType,
  type CreatePostMedia,
  type PostType,
} from '../types';
import {
  activityDraftCard,
  buildCreateInput,
  validateComposer,
  type ActivityDraft,
  type ComposerDraft,
  type MealDraft,
} from '../composer';
import { MAX_PHOTOS, pickPhotos, uploadPhotos, currentUserId, type LocalPhoto } from '../media';
import { Icon } from './icons';

const POST_TYPES: PostType[] = ['serbest', 'ogun', 'etkinlik'];

const emptyMeal = (): MealDraft => ({
  name: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '', portionLabel: '', productId: null,
});
const emptyActivity = (): ActivityDraft => ({ type: 'kosu', minutes: '', distanceKm: '', note: '' });

type SubmitState = 'idle' | 'uploading' | 'publishing' | 'done';

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="secondary" style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.color.secondary}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        style={[styles.input, { color: t.color.ink, backgroundColor: t.color.surface, borderColor: t.color.line }, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function ComposerScreen({ navigation }: { navigation?: { goBack: () => void } }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr, fmt, lang } = useT();

  const [type, setType] = useState<PostType>('ogun');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [meal, setMeal] = useState<MealDraft>(emptyMeal);
  const [activity, setActivity] = useState<ActivityDraft>(emptyActivity);
  const [submit, setSubmit] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const draft: ComposerDraft = useMemo(
    () => ({ type, body, photoCount: photos.length, meal: type === 'ogun' ? meal : null, activity: type === 'etkinlik' ? activity : null }),
    [type, body, photos.length, meal, activity],
  );
  const validation = validateComposer(draft);
  const canSubmit = validation == null && submit === 'idle';

  const livePreview = type === 'etkinlik' ? activityDraftCard(activity) : null;

  const addPhotos = useCallback(async () => {
    const picked = await pickPhotos(MAX_PHOTOS - photos.length);
    if (picked.length) setPhotos((p) => [...p, ...picked].slice(0, MAX_PHOTOS));
  }, [photos.length]);

  const onSubmit = useCallback(async () => {
    if (validateComposer(draft) != null) return;
    setError(null);
    haptic('light');
    try {
      // 1) Fotoğrafları yükle.
      let media: CreatePostMedia[] = [];
      if (photos.length) {
        setSubmit('uploading');
        const uid = await currentUserId();
        if (uid) media = await uploadPhotos(uid, photos);
      }
      // 2) create_post.
      setSubmit('publishing');
      const key = `composer-${type}-${body.length}-${photos.length}-${Date.now()}`;
      const input = buildCreateInput(draft, media, lang, key);
      const res = await getKesfetClient().createPost(input);
      if ('error' in res) {
        setSubmit('idle');
        setError(tr('kesfet.compose.err_rate'));
        return;
      }
      // 3) moderate-content (ateşle-unut).
      getKesfetClient().moderateContent({ targetType: 'post', targetId: res.post_id }).catch(() => {});
      // 4) Yazar kendi pending gönderisini görsün.
      void useKesfetStore.getState().refresh();
      setSubmit('done');
      setTimeout(() => navigation?.goBack(), 900);
    } catch {
      setSubmit('idle');
      setError(tr('kesfet.compose.err_network'));
    }
  }, [draft, photos, type, body.length, lang, tr, navigation]);

  const statusLabel =
    submit === 'uploading' || submit === 'publishing'
      ? tr('kesfet.compose.publishing')
      : submit === 'done'
      ? tr('kesfet.compose.reviewing')
      : null;

  return (
    <View style={[styles.screen, { backgroundColor: t.color.bg, paddingTop: insets.top }]}>
      {/* Başlık */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation?.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={styles.headerBtn}>
          <Icon name="x" size={24} color={t.color.ink} />
        </Pressable>
        <AppText variant="heading">{tr('kesfet.compose.title')}</AppText>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.compose.share')}
          style={({ pressed }) => [styles.shareBtn, { backgroundColor: canSubmit ? t.color.ink : t.color.line, opacity: pressed ? 0.9 : 1 }]}
        >
          <AppText variant="caption" style={{ color: canSubmit ? t.color.surface : t.color.secondary, fontWeight: '700' }}>
            {tr('kesfet.compose.share')}
          </AppText>
        </Pressable>
      </View>

      {statusLabel ? (
        <View style={[styles.statusBar, { backgroundColor: t.color.accent }]}>
          <AppText variant="caption" style={{ color: t.color.onAccent, fontWeight: '700' }}>{statusLabel}</AppText>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.statusBar, { backgroundColor: t.color.danger }]}>
          <AppText variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>{error}</AppText>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* Tür seçimi */}
        <View style={[styles.segment, { borderColor: t.color.line }]} accessibilityRole="radiogroup">
          {POST_TYPES.map((pt) => {
            const active = type === pt;
            return (
              <Pressable
                key={pt}
                onPress={() => { haptic('selection'); setType(pt); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tr(`kesfet.compose.type.${pt}`)}
                style={[styles.segmentItem, active && { backgroundColor: t.color.ink }]}
              >
                <AppText variant="caption" style={{ fontWeight: '700', color: active ? t.color.surface : t.color.ink }}>
                  {tr(`kesfet.compose.type.${pt}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Metin */}
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={tr('kesfet.compose.body_placeholder')}
          placeholderTextColor={t.color.secondary}
          multiline
          style={[styles.body, { color: t.color.ink, backgroundColor: t.color.surface, borderColor: t.color.line }]}
          accessibilityLabel={tr('kesfet.compose.body_placeholder')}
        />

        {/* Fotoğraflar */}
        <View style={styles.photoRow}>
          {photos.map((p, i) => (
            <View key={`${p.uri}-${i}`} style={styles.thumb}>
              <Image source={{ uri: p.uri }} style={styles.thumbImg} />
              <Pressable
                onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                style={[styles.thumbRemove, { backgroundColor: t.color.ink }]}
                accessibilityRole="button"
                accessibilityLabel={tr('common.delete')}
              >
                <Icon name="x" size={12} color={t.color.surface} />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable onPress={addPhotos} style={[styles.addPhoto, { borderColor: t.color.line }]} accessibilityRole="button" accessibilityLabel={tr('kesfet.compose.add_photo')}>
              <Icon name="image" size={22} color={t.color.secondary} />
              <AppText variant="caption" tone="secondary">{photos.length}/{MAX_PHOTOS}</AppText>
            </Pressable>
          ) : null}
        </View>

        {/* Öğün kartı */}
        {type === 'ogun' ? (
          <View style={styles.cardBox}>
            <AppText variant="caption" tone="secondary" style={styles.cardTitle}>{tr('kesfet.compose.meal_section')}</AppText>
            <Field label={tr('kesfet.compose.meal_name')} value={meal.name} onChange={(v) => setMeal((m) => ({ ...m, name: v }))} placeholder={tr('kesfet.compose.meal_name_ph')} />
            <View style={styles.grid2}>
              <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.kcal')} value={meal.kcal} onChange={(v) => setMeal((m) => ({ ...m, kcal: v }))} keyboardType="numeric" placeholder="0" /></View>
              <View style={styles.gridCell}><Field label={tr('kesfet.compose.portion_label')} value={meal.portionLabel} onChange={(v) => setMeal((m) => ({ ...m, portionLabel: v }))} placeholder="1 porsiyon" /></View>
            </View>
            <View style={styles.grid3}>
              <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.protein')} value={meal.protein_g} onChange={(v) => setMeal((m) => ({ ...m, protein_g: v }))} keyboardType="numeric" placeholder="0" /></View>
              <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.carbs')} value={meal.carbs_g} onChange={(v) => setMeal((m) => ({ ...m, carbs_g: v }))} keyboardType="numeric" placeholder="0" /></View>
              <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.fat')} value={meal.fat_g} onChange={(v) => setMeal((m) => ({ ...m, fat_g: v }))} keyboardType="numeric" placeholder="0" /></View>
            </View>
          </View>
        ) : null}

        {/* Etkinlik kartı */}
        {type === 'etkinlik' ? (
          <View style={styles.cardBox}>
            <AppText variant="caption" tone="secondary" style={styles.cardTitle}>{tr('kesfet.compose.activity_section')}</AppText>
            <View style={styles.chipWrap} accessibilityRole="radiogroup">
              {ACTIVITY_TYPES.map((at: ActivityType) => {
                const active = activity.type === at;
                return (
                  <Pressable
                    key={at}
                    onPress={() => setActivity((a) => ({ ...a, type: at }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={tr(`kesfet.activity.type.${at}`)}
                    style={[styles.chip, { borderColor: active ? t.color.ink : t.color.line, backgroundColor: active ? t.color.ink : 'transparent' }]}
                  >
                    <AppText variant="caption" style={{ color: active ? t.color.surface : t.color.ink, fontWeight: '600' }}>
                      {tr(`kesfet.activity.type.${at}`)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.grid2}>
              <View style={styles.gridCell}><Field label={tr('kesfet.compose.minutes')} value={activity.minutes} onChange={(v) => setActivity((a) => ({ ...a, minutes: v }))} keyboardType="numeric" placeholder="0" /></View>
              <View style={styles.gridCell}><Field label={tr('kesfet.compose.distance')} value={activity.distanceKm} onChange={(v) => setActivity((a) => ({ ...a, distanceKm: v }))} keyboardType="numeric" placeholder="0" /></View>
            </View>
            <View style={[styles.kcalLive, { borderColor: t.color.line }]}>
              <Icon name="fire" size={16} color={t.color.accentLine} />
              <AppText variant="body" style={{ fontWeight: '700' }}>
                {livePreview ? tr('kesfet.activity.kcal_est', { kcal: fmt(livePreview.kcal_est) }) : tr('kesfet.compose.kcal_hint')}
              </AppText>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default ComposerScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { minHeight: 36, paddingHorizontal: 18, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusBar: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 3, gap: 3 },
  segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  body: { marginTop: 14, minHeight: 100, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 72, height: 72, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  cardBox: { marginTop: 16, gap: 4 },
  cardTitle: { fontWeight: '700', marginBottom: 4 },
  field: { marginBottom: 8 },
  fieldLabel: { marginBottom: 4, fontWeight: '600' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
  grid2: { flexDirection: 'row', gap: 10 },
  grid3: { flexDirection: 'row', gap: 10 },
  gridCell: { flex: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kcalLive: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
});
