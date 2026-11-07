// Composer — G8 (yalnız `kesfet_paylasim` açıkken; AppNavigator). HERKES paylaşır.
// Tasarım: Final FinCompose (G15-S3) — "İptal" + siyah "Paylaş" hapı, Serbest /
// Öğün / Etkinlik bölmeli seçici, avatar + metin, medya kareleri (✕ + "n / 4"),
// Öğün: "Öğün kartı" kaynakları (Ürün ara / Elle gir / Tara sonucundan) + kart
// önizlemesi; Etkinlik: 4×3 tür ızgarası + Süre / Mesafe + canlı kcal tahmini;
// altta kural notu + "Fotoğraf · Video · En fazla 4 foto veya 60 sn video" çubuğu.
//
// Mantık G8/G11 ile AYNI (composer.ts değişmedi): metin + en fazla 4 fotoğraf;
// öğün kartı elle / search_products (RPC yoksa döşeme gizli) — kullanıcı seçilen
// değerleri "Elle gir" ile düzeltebilir; etkinlik kartı CANLI tahmini kcal. Gönder
// → (ilk sefer FinRules) → create_post → moderate-content → "Paylaşılıyor… /
// İnceleniyor". Hatalar: hız sınırı, ağ (sakin metin, kırmızı yok).
// Video (Final "Video"): `kesfet_video` açıkken 1 video (≤60 sn) — G8-S3 video
// modülüyle (pickVideo → extractFrames → uploadVideoPost) p_media'ya eklenir.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SCREEN_KEYBOARD_BEHAVIOR } from '../../../core/design/keyboard';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, fontFamily, useTheme, haptic } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';

import { getKesfetClient } from '../client';
import { useKesfetStore } from '../store';
import { usePostingStore } from '../postingStore';
import {
  ACTIVITY_TYPES,
  type ActivityType,
  type CreatePostMedia,
  type PostType,
  type ProductSearchItem,
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
import { inferMealTypeFromHour } from '../../ai/scan/mealTypeFromHour';
import { RulesSheet, rulesSeen } from './RulesSheet';
import { ComposeIcon, type ComposeIconName } from './compose/icons';
import { X } from '../../../components/icons';
import { ActivityTile, F, MealPreview, SourceTile, composeTones } from './compose/pieces';
import { fetchLastScanMeal } from './compose/lastScan';

const POST_TYPES: PostType[] = ['serbest', 'ogun', 'etkinlik'];

const emptyMeal = (): MealDraft => ({
  name: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '', portionLabel: '', productId: null,
});
const emptyActivity = (): ActivityDraft => ({ type: 'kosu', minutes: '', distanceKm: '', note: '' });

type SubmitState = 'idle' | 'uploading' | 'publishing' | 'done';
type MealSource = 'search' | 'manual' | 'scan' | null;

/** Seçilmiş video (kesfet_video). Tip G8-S3 video modülünden (lazy import). */
interface PickedVideoLite {
  uri: string;
  width: number;
  height: number;
  durationMs: number;
  fileSizeBytes: number;
  mimeType: string | null;
}

/**
 * YALNIZ __DEV__ vitrini (G15): FinCompose karelerini Final örnek içeriğiyle açar.
 * Üretimde rota bu parametreleri hiç taşımaz; `__DEV__` false → hep undefined.
 */
interface VitrinPrefill {
  body?: string;
  photos?: LocalPhoto[];
  meal?: { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; photo_url?: string | null };
  activity?: { type: ActivityType; minutes: number; distanceKm?: number };
}

const num = (v: number) => String(v).replace('.', ',');

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <AppText style={[styles.fieldLabel, F.semibold]} tone="secondary">{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.color.secondary}
        keyboardType={keyboardType ?? 'default'}
        style={[styles.input, { color: t.color.ink, backgroundColor: t.color.surface, borderColor: t.color.line }]}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function ComposerScreen({
  navigation,
  route,
}: {
  navigation?: { goBack: () => void };
  route?: { params?: { vitrinKind?: PostType; vitrinPrefill?: VitrinPrefill } };
}) {
  const t = useTheme();
  const tone = composeTones(t);
  const insets = useSafeAreaInsets();
  const { t: tr, fmt, lang } = useT();
  const videoEnabled = useFeature('kesfet_video');

  const vitrinKind = __DEV__ ? route?.params?.vitrinKind : undefined;
  const pre = __DEV__ ? route?.params?.vitrinPrefill : undefined;

  const [type, setType] = useState<PostType>(vitrinKind ?? 'ogun');
  const [body, setBody] = useState(pre?.body ?? '');
  const [photos, setPhotos] = useState<LocalPhoto[]>(pre?.photos ?? []);
  const [video, setVideo] = useState<PickedVideoLite | null>(null);
  const [meal, setMeal] = useState<MealDraft>(() =>
    pre?.meal
      ? {
          name: pre.meal.name,
          kcal: String(pre.meal.kcal),
          protein_g: String(pre.meal.protein_g),
          carbs_g: String(pre.meal.carbs_g),
          fat_g: String(pre.meal.fat_g),
          portionLabel: '',
          productId: null,
        }
      : emptyMeal(),
  );
  // Önizleme görseli (yalnız arayüz): ürünün görseli, yoksa ilk fotoğraf.
  const [mealThumb, setMealThumb] = useState<string | null>(pre?.meal?.photo_url ?? null);
  const [mealSource, setMealSource] = useState<MealSource>(null);
  const [scanNone, setScanNone] = useState(false);
  const [activity, setActivity] = useState<ActivityDraft>(() =>
    pre?.activity
      ? { type: pre.activity.type, minutes: String(pre.activity.minutes), distanceKm: pre.activity.distanceKm != null ? num(pre.activity.distanceKm) : '', note: '' }
      : emptyActivity(),
  );
  const [submit, setSubmit] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rulesVisible, setRulesVisible] = useState(false);

  // G11 — ürün arama (search_products). RPC canlıda yoksa döşeme gizlenir
  // (ilk aramada { available:false } dönerse). Seçilen ürün öğün kartını doldurur.
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchOpen = mealSource === 'search';

  useEffect(() => {
    const q = searchQ.trim();
    if (!searchOpen || q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let alive = true;
    setSearchLoading(true);
    const id = setTimeout(() => {
      void getKesfetClient()
        .searchProducts({ q })
        .then((res) => {
          if (!alive) return;
          if (!res.available) {
            // RPC canlıda yok → özelliği gizle (sakin; kırmızı/uyarı yok).
            setSearchAvailable(false);
            setMealSource(null);
            return;
          }
          setSearchResults(res.items);
        })
        .catch(() => {
          if (alive) setSearchResults([]);
        })
        .finally(() => {
          if (alive) setSearchLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [searchQ, searchOpen]);

  const pickProduct = useCallback((p: ProductSearchItem) => {
    haptic('light');
    setMeal((m) => ({
      ...m,
      name: p.name,
      kcal: String(p.kcal),
      protein_g: String(p.protein_g),
      carbs_g: String(p.carbs_g),
      fat_g: String(p.fat_g),
      productId: p.id,
    }));
    setMealThumb(p.image_url ?? null);
    setMealSource(null);
    setSearchQ('');
  }, []);

  // "Tara sonucundan" — bugünkü son AI tarama kaydı öğün kartını doldurur.
  const fromScan = useCallback(async () => {
    haptic('selection');
    setMealSource('scan');
    setScanNone(false);
    const last = await fetchLastScanMeal();
    if (!last) {
      setScanNone(true);
      return;
    }
    setMeal((m) => ({
      ...m,
      name: last.name,
      kcal: String(Math.round(last.kcal)),
      protein_g: String(last.protein_g),
      carbs_g: String(last.carbs_g),
      fat_g: String(last.fat_g),
      productId: null,
    }));
    setMealThumb(null);
    setMealSource(null);
  }, []);

  // Doğrulama: video da medya sayılır (serbest gönderi "boş" değil); fotoğraf sınırı aynı.
  const mediaCount = Math.min(MAX_PHOTOS, photos.length + (video ? 1 : 0));
  const draft: ComposerDraft = useMemo(
    () => ({ type, body, photoCount: mediaCount, meal: type === 'ogun' ? meal : null, activity: type === 'etkinlik' ? activity : null }),
    [type, body, mediaCount, meal, activity],
  );
  const validation = validateComposer(draft);
  const canSubmit = validation == null && submit === 'idle';

  const livePreview = type === 'etkinlik' ? activityDraftCard(activity) : null;

  const addPhotos = useCallback(async () => {
    const picked = await pickPhotos(MAX_PHOTOS - photos.length);
    if (picked.length) setPhotos((p) => [...p, ...picked].slice(0, MAX_PHOTOS));
  }, [photos.length]);

  const addVideo = useCallback(async () => {
    setError(null);
    try {
      const { pickVideo } = require('../../media/video') as typeof import('../../media/video');
      const picked = await pickVideo();
      if (picked) setVideo(picked);
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      setError(
        name === 'VideoTooLargeError' ? tr('kesfet.compose.video_too_large') : tr('kesfet.compose.video_too_long'),
      );
    }
  }, [tr]);

  // G15 (Final FinPosting): "Paylaş" → composer kapanır, gönderim arka planda sürer
  // ve akışta durum satırı görünür (paylaşılıyor → inceleniyor → yayında / sakin
  // ret kartı). Sıra AYNI: yükle → create_post → moderate-content → refresh. Hata
  // olursa akışta sakin satır + "Tekrar dene" (aynı taslakla yeniden dener).
  const runPost = useCallback(async () => {
    const posting = usePostingStore.getState();
    posting.set('uploading', { postId: null, error: null, retry: null });
    const retry = () => void runPost();
    try {
      // 1) Fotoğrafları (+ varsa videoyu) yükle.
      let media: CreatePostMedia[] = [];
      if (photos.length || video) {
        setSubmit('uploading');
        posting.set('uploading');
        const uid = await currentUserId();
        if (uid && photos.length) media = await uploadPhotos(uid, photos);
        if (uid && video) {
          const v = require('../../media/video') as typeof import('../../media/video');
          const frames = await v.extractFrames(video.uri, video.durationMs);
          const vm = await v.uploadVideoPost(uid, video, frames, { sort: media.length });
          // create_post p_media: { url|path, kind:'video', duration_s, thumb_path, frame_paths }.
          media = [...media, vm as unknown as CreatePostMedia];
        }
      }
      // 2) create_post.
      setSubmit('publishing');
      posting.set('publishing');
      const key = `composer-${type}-${body.length}-${photos.length}-${Date.now()}`;
      const input = buildCreateInput(draft, media, lang, key);
      const res = await getKesfetClient().createPost(input);
      if ('error' in res) {
        setSubmit('idle');
        setError(tr('kesfet.compose.err_rate'));
        posting.set('error', { error: tr('kesfet.compose.err_rate'), retry: null });
        return;
      }
      // 3) moderate-content (ateşle-unut).
      getKesfetClient().moderateContent({ targetType: 'post', targetId: res.post_id }).catch(() => {});
      // 4) Yazar kendi pending gönderisini görsün.
      void useKesfetStore.getState().refresh();
      setSubmit('done');
      posting.set(res.status === 'published' ? 'published' : 'reviewing', { postId: res.post_id });
    } catch {
      setSubmit('idle');
      setError(tr('kesfet.compose.err_network'));
      posting.set('error', { error: tr('kesfet.compose.err_network'), retry });
    }
  }, [draft, photos, video, type, body.length, lang, tr]);

  const onSubmit = useCallback(async () => {
    if (validateComposer(draft) != null) return;
    setError(null);
    haptic('light');
    void runPost();
    navigation?.goBack();
  }, [draft, runPost, navigation]);

  // İlk gönderiden önce bir kez Topluluk kuralları (FinRules) — kabul edilmemişse
  // "Paylaş" bu sayfayı açar; kabul edince bayrak işaretlenir ve asıl gönderim sürer.
  const handleSharePress = useCallback(async () => {
    if (!canSubmit) return;
    if (!(await rulesSeen())) {
      setRulesVisible(true);
      return;
    }
    void onSubmit();
  }, [canSubmit, onSubmit]);

  const onAcceptRules = useCallback(() => {
    setRulesVisible(false);
    void onSubmit();
  }, [onSubmit]);

  const statusLabel =
    submit === 'uploading' || submit === 'publishing'
      ? tr('kesfet.compose.publishing')
      : submit === 'done'
      ? tr('kesfet.compose.reviewing')
      : null;

  const mealKcal = Number(String(meal.kcal).replace(',', '.'));
  const mealReady = meal.name.trim().length > 0 && Number.isFinite(mealKcal) && mealKcal > 0;
  const mealN = (v: string) => {
    const x = Number(String(v).replace(',', '.'));
    return Number.isFinite(x) ? x : 0;
  };
  const quickMealLabel = tr(`meal.${inferMealTypeFromHour(new Date().getHours())}`);

  const activityIcon = (at: ActivityType): ComposeIconName => at as ComposeIconName;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: t.color.bg, paddingTop: insets.top }]}
      behavior={SCREEN_KEYBOARD_BEHAVIOR}
    >
      {/* Koyu temada durum çubuğu açık renk (App geneli 'dark'). */}
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      {/* Üst çubuk (G17-S1 md.7: modal → kapat X SAĞDA): Paylaş · X */}
      <View style={styles.header}>
        <Pressable
          onPress={handleSharePress}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          accessibilityLabel={tr('kesfet.compose.post_btn')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.shareBtn,
            { backgroundColor: canSubmit ? t.color.ink : t.color.line, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <AppText style={[styles.shareText, F.semibold, { color: canSubmit ? tone.onInk : t.color.secondary }]}>
            {tr('kesfet.compose.post_btn')}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => navigation?.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.compose.cancel')}
          style={styles.cancel}
          testID="composer-close"
        >
          <X size={22} color={t.color.ink} />
        </Pressable>
      </View>

      {statusLabel ? (
        <View style={[styles.statusBar, { backgroundColor: t.color.accent }]}>
          <AppText style={[styles.statusText, F.bold, { color: t.color.onAccent }]}>{statusLabel}</AppText>
        </View>
      ) : null}
      {error ? (
        // Olumsuz an sessiz (motion §2): kırmızı/alarm yok, sakin metin.
        <View style={[styles.statusBar, { backgroundColor: t.color.surface }]}>
          <AppText style={[styles.statusText, F.semibold]} tone="secondary">{error}</AppText>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {/* Tür seçimi — bölmeli seçici */}
        <View style={[styles.segment, { backgroundColor: t.color.line }]} accessibilityRole="radiogroup">
          {POST_TYPES.map((pt) => {
            const active = type === pt;
            return (
              <Pressable
                key={pt}
                onPress={() => {
                  haptic('selection');
                  setType(pt);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tr(`kesfet.compose.type.${pt}`)}
                hitSlop={4}
                style={[styles.segmentItem, active && [styles.segmentActive, { backgroundColor: t.color.surface }]]}
              >
                <AppText
                  style={[styles.segmentText, active ? F.bold : F.medium]}
                  tone={active ? 'ink' : 'secondary'}
                >
                  {tr(`kesfet.compose.type.${pt}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Avatar + metin */}
        <View style={styles.bodyRow}>
          <View style={[styles.avatar, { backgroundColor: tone.avatar }]} />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={tr('kesfet.compose.body_placeholder')}
            placeholderTextColor={t.color.secondary}
            multiline
            style={[styles.body, { color: t.color.ink }]}
            accessibilityLabel={tr('kesfet.compose.body_placeholder')}
          />
        </View>

        {/* Medya kareleri */}
        {photos.length > 0 || video ? (
          <View style={styles.mediaRow}>
            {photos.map((p, i) => (
              <View key={`${p.uri}-${i}`} style={[styles.thumb, { backgroundColor: tone.photoPh }]}>
                <Image source={{ uri: p.uri }} style={styles.thumbImg} contentFit="cover" />
                <Pressable
                  onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  style={styles.thumbRemove}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={tr('kesfet.compose.remove_media')}
                >
                  <ComposeIcon name="x" size={12} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {video ? (
              <View style={[styles.thumb, { backgroundColor: tone.photoPh }]}>
                <ComposeIcon name="video" size={22} color={t.color.secondary} />
                <AppText style={[styles.addText, F.semibold]} tone="secondary">
                  {`0:${String(Math.round(video.durationMs / 1000)).padStart(2, '0')}`}
                </AppText>
                <Pressable
                  onPress={() => setVideo(null)}
                  style={styles.thumbRemove}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={tr('kesfet.compose.remove_media')}
                >
                  <ComposeIcon name="x" size={12} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}
            {photos.length < MAX_PHOTOS ? (
              <Pressable
                onPress={addPhotos}
                style={[styles.addTile, { borderColor: tone.outline }]}
                accessibilityRole="button"
                accessibilityLabel={tr('kesfet.compose.add_photo')}
              >
                <ComposeIcon name="plus" size={20} color={t.color.secondary} />
                <AppText style={[styles.addText, F.semibold]} tone="secondary">
                  {tr('kesfet.compose.add_tile', { n: photos.length, max: MAX_PHOTOS })}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Öğün kartı */}
        {type === 'ogun' ? (
          <View style={styles.mealBox}>
            <AppText style={[styles.sectionLabel, F.semibold]} tone="secondary">
              {tr('kesfet.compose.meal_section')}
            </AppText>
            <View style={styles.sourceRow}>
              {searchAvailable ? (
                <SourceTile
                  icon="search"
                  label={tr('kesfet.compose.product_search')}
                  active={mealSource === 'search'}
                  onPress={() => {
                    haptic('selection');
                    setMealSource((s) => (s === 'search' ? null : 'search'));
                  }}
                />
              ) : null}
              <SourceTile
                icon="pencil"
                label={tr('kesfet.compose.meal_manual')}
                active={mealSource === 'manual'}
                onPress={() => {
                  haptic('selection');
                  setMealSource((s) => (s === 'manual' ? null : 'manual'));
                }}
              />
              <SourceTile
                icon="scan"
                label={tr('kesfet.compose.meal_from_scan')}
                active={mealSource === 'scan'}
                onPress={() => void fromScan()}
              />
            </View>

            {searchOpen && searchAvailable ? (
              <View style={[styles.searchPanel, { borderColor: t.color.line, backgroundColor: t.color.surface }]}>
                <TextInput
                  value={searchQ}
                  onChangeText={setSearchQ}
                  placeholder={tr('kesfet.compose.product_search_ph')}
                  placeholderTextColor={t.color.secondary}
                  autoFocus
                  style={[styles.searchInput, { color: t.color.ink, borderColor: t.color.line }]}
                  accessibilityLabel={tr('kesfet.compose.product_search')}
                />
                {searchQ.trim().length < 2 ? (
                  <AppText style={styles.searchHint} tone="secondary">{tr('kesfet.compose.product_search_min')}</AppText>
                ) : searchLoading ? (
                  <AppText style={styles.searchHint} tone="secondary">{tr('kesfet.ui.loading')}</AppText>
                ) : searchResults.length === 0 ? (
                  <AppText style={styles.searchHint} tone="secondary">{tr('kesfet.compose.product_search_empty')}</AppText>
                ) : (
                  searchResults.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => pickProduct(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${fmt(p.kcal)} kcal`}
                      style={({ pressed }) => [styles.searchRow, { borderTopColor: t.color.line }, pressed && { opacity: 0.85 }]}
                    >
                      <AppText style={[styles.searchName, F.bold]} numberOfLines={1}>{p.name}</AppText>
                      <AppText style={styles.searchHintInline} tone="secondary">
                        {tr('kesfet.ui.meal_card.macro', { kcal: fmt(p.kcal), protein: fmt(Math.round(p.protein_g)) })}
                      </AppText>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {mealSource === 'scan' && scanNone ? (
              <AppText style={styles.searchHint} tone="secondary">{tr('kesfet.compose.meal_scan_none')}</AppText>
            ) : null}

            {mealSource === 'manual' ? (
              <View style={styles.manual}>
                <Field label={tr('kesfet.compose.meal_name')} value={meal.name} onChange={(v) => setMeal((m) => ({ ...m, name: v }))} placeholder={tr('kesfet.compose.meal_name_ph')} />
                <View style={styles.grid}>
                  <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.kcal')} value={meal.kcal} onChange={(v) => setMeal((m) => ({ ...m, kcal: v }))} keyboardType="numeric" placeholder="0" /></View>
                  <View style={styles.gridCell}><Field label={tr('kesfet.compose.portion_label')} value={meal.portionLabel} onChange={(v) => setMeal((m) => ({ ...m, portionLabel: v }))} placeholder="1 porsiyon" /></View>
                </View>
                <View style={styles.grid}>
                  <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.protein')} value={meal.protein_g} onChange={(v) => setMeal((m) => ({ ...m, protein_g: v }))} keyboardType="numeric" placeholder="0" /></View>
                  <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.carbs')} value={meal.carbs_g} onChange={(v) => setMeal((m) => ({ ...m, carbs_g: v }))} keyboardType="numeric" placeholder="0" /></View>
                  <View style={styles.gridCell}><Field label={tr('kesfet.ui.sheet.fat')} value={meal.fat_g} onChange={(v) => setMeal((m) => ({ ...m, fat_g: v }))} keyboardType="numeric" placeholder="0" /></View>
                </View>
              </View>
            ) : null}

            {mealReady ? (
              <MealPreview
                mealLabel={quickMealLabel}
                data={{
                  name: meal.name.trim(),
                  kcal: mealKcal,
                  protein_g: mealN(meal.protein_g),
                  carbs_g: mealN(meal.carbs_g),
                  fat_g: mealN(meal.fat_g),
                  thumbUri: mealThumb ?? photos[0]?.uri ?? null,
                }}
              />
            ) : null}
          </View>
        ) : null}

        {/* Etkinlik kartı */}
        {type === 'etkinlik' ? (
          <View style={styles.activityBox}>
            <View style={styles.activityGrid} accessibilityRole="radiogroup">
              {[0, 1, 2].map((row) => (
                <View key={row} style={styles.activityRow}>
                  {ACTIVITY_TYPES.slice(row * 4, row * 4 + 4).map((at) => (
                    <ActivityTile
                      key={at}
                      icon={activityIcon(at)}
                      label={tr(`kesfet.activity.type.${at}`)}
                      active={activity.type === at}
                      onPress={() => {
                        haptic('selection');
                        setActivity((a) => ({ ...a, type: at }));
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
            <View style={styles.statRow}>
              <View style={[styles.statBox, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
                <AppText style={styles.statLabel} tone="secondary">{tr('kesfet.compose.duration')}</AppText>
                <View style={styles.statValueRow}>
                  <TextInput
                    value={activity.minutes}
                    onChangeText={(v) => setActivity((a) => ({ ...a, minutes: v }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={t.color.secondary}
                    style={[styles.statInput, F.bold, { color: t.color.ink }]}
                    accessibilityLabel={tr('kesfet.compose.minutes')}
                  />
                  <AppText style={[styles.statUnit, F.medium]} tone="secondary">{tr('kesfet.compose.min_unit')}</AppText>
                </View>
              </View>
              <View style={[styles.statBox, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
                <AppText style={styles.statLabel} tone="secondary">{tr('kesfet.compose.distance_label')}</AppText>
                <View style={styles.statValueRow}>
                  <TextInput
                    value={activity.distanceKm}
                    onChangeText={(v) => setActivity((a) => ({ ...a, distanceKm: v }))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={t.color.secondary}
                    style={[styles.statInput, F.bold, { color: t.color.ink }]}
                    accessibilityLabel={tr('kesfet.compose.distance')}
                  />
                  <AppText style={[styles.statUnit, F.medium]} tone="secondary" numberOfLines={1}>
                    {tr('kesfet.compose.km_optional')}
                  </AppText>
                </View>
              </View>
            </View>
            <View style={styles.kcalLine}>
              <View style={[styles.kcalDot, { backgroundColor: t.color.accentLine }]} />
              {livePreview ? (
                <AppText style={[styles.kcalText, F.semibold]}>
                  {tr('kesfet.compose.kcal_est_line', { kcal: fmt(livePreview.kcal_est) })}{' '}
                  <AppText style={styles.kcalText} tone="secondary">
                    {tr('kesfet.compose.kcal_est_note')}
                  </AppText>
                </AppText>
              ) : (
                <AppText style={styles.kcalText} tone="secondary">{tr('kesfet.compose.kcal_hint')}</AppText>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Alt: kural notu + Fotoğraf / Video çubuğu */}
      <View style={styles.ruleNote}>
        <ComposeIcon name="shield" size={16} color={t.color.secondary} />
        <AppText style={styles.ruleText} tone="secondary">{tr('kesfet.compose.rule_note')}</AppText>
      </View>
      <View style={[styles.bar, { borderTopColor: t.color.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable
          onPress={addPhotos}
          disabled={photos.length >= MAX_PHOTOS}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.compose.add_photo')}
          style={({ pressed }) => [styles.barBtn, (pressed || photos.length >= MAX_PHOTOS) && { opacity: 0.5 }]}
        >
          <ComposeIcon name="photo" size={22} color={t.color.ink} />
          <AppText style={[styles.barText, F.semibold]}>{tr('kesfet.compose.add_photo')}</AppText>
        </Pressable>
        {videoEnabled ? (
          <Pressable
            onPress={() => void addVideo()}
            disabled={video != null}
            accessibilityRole="button"
            accessibilityLabel={tr('kesfet.compose.video')}
            style={({ pressed }) => [styles.barBtn, (pressed || video != null) && { opacity: 0.5 }]}
          >
            <ComposeIcon name="video" size={22} color={t.color.ink} />
            <AppText style={[styles.barText, F.semibold]}>{tr('kesfet.compose.video')}</AppText>
          </Pressable>
        ) : null}
        <AppText style={styles.barHint} tone="secondary">
          {tr('kesfet.compose.media_limit')}
        </AppText>
      </View>

      <RulesSheet visible={rulesVisible} onAccept={onAcceptRules} onClose={() => setRulesVisible(false)} />
    </KeyboardAvoidingView>
  );
}

export default ComposerScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingLeft: 16, paddingRight: 6 },
  cancel: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, lineHeight: 20 },
  shareBtn: { height: 36, paddingHorizontal: 18, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  shareText: { fontSize: 15, lineHeight: 20 },
  statusBar: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  statusText: { fontSize: 13, lineHeight: 18 },
  segment: { marginHorizontal: 16, height: 36, padding: 2, borderRadius: 18, flexDirection: 'row' },
  segmentItem: { flex: 1, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  segmentActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, lineHeight: 19 },
  bodyRow: { flexDirection: 'row', gap: 12, paddingTop: 12, paddingHorizontal: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  body: { flex: 1, minHeight: 40, fontSize: 17, lineHeight: 24, paddingTop: 6, paddingBottom: 0, textAlignVertical: 'top', fontFamily: fontFamily.bodyRegular },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12, paddingRight: 16, paddingLeft: 68 },
  thumb: { width: 72, height: 92, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(10,10,10,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: { width: 72, height: 92, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addText: { fontSize: 13, lineHeight: 17 },
  mealBox: { paddingTop: 14, paddingRight: 16, paddingLeft: 68 },
  sectionLabel: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  sourceRow: { flexDirection: 'row', gap: 8 },
  manual: { marginTop: 10 },
  searchPanel: { borderWidth: 1, borderRadius: 12, padding: 8, marginTop: 10, gap: 2 },
  searchInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 15 },
  searchHint: { paddingVertical: 10, textAlign: 'center', fontSize: 13, lineHeight: 18 },
  searchHintInline: { fontSize: 13, lineHeight: 18 },
  searchName: { flex: 1, fontSize: 13, lineHeight: 18 },
  searchRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  field: { marginBottom: 8 },
  fieldLabel: { marginBottom: 4, fontSize: 13, lineHeight: 18 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
  grid: { flexDirection: 'row', gap: 8 },
  gridCell: { flex: 1 },
  activityBox: { paddingTop: 12, paddingHorizontal: 16 },
  activityGrid: { gap: 6 },
  activityRow: { flexDirection: 'row', gap: 6 },
  statRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, minHeight: 56, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  statLabel: { fontSize: 13, lineHeight: 18 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statInput: { fontSize: 18, lineHeight: 24, padding: 0, minWidth: 24 },
  statUnit: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  kcalLine: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  kcalDot: { width: 8, height: 8, borderRadius: 4 },
  kcalText: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
  ruleNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  barBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  barText: { fontSize: 13, lineHeight: 18 },
  barHint: { marginLeft: 'auto', flexShrink: 1, fontSize: 13, lineHeight: 18 },
});
