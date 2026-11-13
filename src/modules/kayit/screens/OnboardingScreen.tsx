// G42-S1 md.2 / G43-S1 — Yeni onboarding: 5 ekran, mevcut karşılama ekranının düzeninde: üstte nötr zeminde
// görsel alanı, altta beyaz kart (başlık, metin, nokta göstergesi, Devam). Görsel alanı GERÇEK öğelerle:
// 1 maskot (küçük, sabit) · 2 gerçek bir öğün fotoğrafı + tarama çerçevesi + Çek / Anlat / Sor (sabit çipler) ·
// 3 eatkcal ürün kartı (mevcut ProductCard; canlı ürün, yoksa yerel ürün fotoğrafı) · 4 Keşfet gönderi kartı
// (mevcut PostCard, statik örnek) · 5 üç başlangıç satırı + "Beslenme profilini" Şimdi/Sonra segmenti
// (Şimdi = A, Sonra = B; `kisisel_plan` kapalıysa segment gizli, herkes B).
// Sayfa geçişi standart yatay pager (kaydırma ya da Devam); panorama, paralaks, maskot süzülmesi YOK.
// Atla yok; Android geri / VoiceOver geri bir önceki ekrana; uygulama kapatılıp açılınca kaldığı ekrandan devam.
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppText, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useFeature } from '../../../core/flags';
import { CameraIcon, ChatCircleDots, Microphone, ShoppingBag, Users } from '../../../components/icons';
import { ProductCard } from '../../eatkcal/v2/ui/home/cards';
import { PostCard } from '../../kesfet/ui/PostCard';
import type { PostCardModel } from '../../kesfet/ui/format';
import { loadEatkcalProducts } from '../../plan/actions';
import { FONT, KButton, Mascot, Segment } from '../ui/parts';
import { OptionRow } from '../ui/pickers';
import { useEdgeBack } from '../ui/edge';
import { useK } from '../ui/theme';
import { resolvePath, type KPath, type KStart } from '../model';
import { readOnb, writeOnb } from '../storage';
import { kv, useKayit } from '../store';
import { kTrack } from '../events';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

/* eslint-disable @typescript-eslint/no-require-imports */
const PHOTO = {
  meal: require('../../../../assets/kayit/ogun.webp'),
  product: require('../../../../assets/kayit/urun.webp'),
  post: require('../../../../assets/kayit/paylasim.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const STEPS = [1, 2, 3, 4, 5] as const;
const STARTS: readonly KStart[] = ['track', 'recipes', 'community'];
const START_ICON = { track: CameraIcon, recipes: ShoppingBag, community: Users } as const;
/** Alt kartın yüksekliği (güvenli alan hariç): başlık 2 satır + metin 2 satır + noktalar + Devam + giriş satırı. */
const CARD_H = 330;

function assetUri(src: number): string {
  return Image.resolveAssetSource(src)?.uri ?? '';
}

export default function OnboardingScreen({ vitrinStep }: { /** YALNIZ geliştirme vitrini. */ vitrinStep?: number } = {}) {
  const { t, lang } = useT();
  const P = useK();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const navigation = useNavigation<any>();
  const kisiselPlan = useFeature('kisisel_plan');
  const [step, setStep] = useState(__DEV__ && vitrinStep ? vitrinStep : 1);
  const [start, setStartLocal] = useState<KStart | null>(null);
  const [choice, setChoice] = useState<KPath>('a');
  const hydrated = useRef(!!(__DEV__ && vitrinStep));
  const pager = useRef<ScrollView>(null);
  const firstScroll = useRef(true);

  // Kaldığı yerden devam.
  useEffect(() => {
    if (hydrated.current) return;
    void readOnb(kv).then((s) => {
      hydrated.current = true;
      if (!s) return;
      setStep(s.step);
      setStartLocal(s.start);
      setChoice(s.path);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    kTrack.onbStep(step, lang === 'en' ? 'en' : 'tr');
    if (hydrated.current) void writeOnb(kv, { step, start, path: choice });
    pager.current?.scrollTo({ x: (step - 1) * W, animated: !reduced && !firstScroll.current });
    firstScroll.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, W]);

  useEffect(() => {
    if (hydrated.current) void writeOnb(kv, { step, start, path: choice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, choice]);

  const back = step > 1 ? () => setStep((s) => Math.max(1, s - 1)) : null;
  // Yalnız Android geri tuşu (yatay pager kenar kaydırmasını kendisi yapar).
  useEdgeBack(back, W);

  const onPageEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const s = Math.min(5, Math.max(1, Math.round(e.nativeEvent.contentOffset.x / W) + 1));
    if (s !== step) setStep(s);
  };

  const next = () => {
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    const path = resolvePath(choice, kisiselPlan);
    const st = start ?? 'track';
    kTrack.pathChoice(path, st);
    const k = useKayit.getState();
    k.reset(k.answers.units);
    k.setPath(path);
    k.setStart(st);
    navigation.navigate(path === 'a' ? 'KQuestions' : 'KSignup', path === 'a' ? undefined : { path: 'b' });
  };

  const cardH = CARD_H + Math.max(insets.bottom, 16);
  const visualH = Math.max(240, H - cardH - insets.top);

  return (
    <View style={[styles.root, { backgroundColor: P.bg }]} testID="kayit-onb" onAccessibilityEscape={back ?? undefined}>
      <StatusBar style={P.isDark ? 'light' : 'dark'} />
      {/* Beyaz alt kart (sabit zemin; içindeki metin sayfayla kayar). */}
      <View pointerEvents="none" style={[styles.card, { height: cardH, backgroundColor: P.surface }]} />
      <ScrollView
        {...SCROLL_KEYBOARD}
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPageEnd}
        scrollEventThrottle={16}
        contentOffset={{ x: (step - 1) * W, y: 0 }}
        testID="kayit-onb-pager"
      >
        {STEPS.map((s) => (
          <View key={s} style={{ width: W, height: H }} accessibilityElementsHidden={s !== step} importantForAccessibility={s === step ? 'auto' : 'no-hide-descendants'}>
            <View style={{ height: visualH, marginTop: insets.top, justifyContent: 'center' }}>
              <Visual
                s={s}
                W={W}
                h={visualH}
                start={start}
                onStart={setStartLocal}
                choice={choice}
                onChoice={setChoice}
                showSeg={kisiselPlan}
              />
            </View>
            <View style={styles.text}>
              <AppText accessibilityRole="header" maxFontSizeMultiplier={1.15} style={[styles.title, { color: P.ink }]}>
                {t(`kayit.onb.s${s}.title`)}
              </AppText>
              <AppText maxFontSizeMultiplier={1.2} style={[styles.sub, { color: P.sec }]}>
                {t(`kayit.onb.s${s}.sub`)}
              </AppText>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Kartın altı: noktalar + Devam (+ 5. ekranda Giriş yap). */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
        <View accessible accessibilityRole="progressbar" accessibilityLabel={t('kayit.onb.dots', { step })} accessibilityValue={{ min: 1, max: 5, now: step }} style={styles.dots}>
          {STEPS.map((i) => (
            <View key={i} style={[styles.dot, i === step ? { width: 20, backgroundColor: P.ink } : { backgroundColor: P.line2 }]} />
          ))}
        </View>
        <KButton testID="kayit-onb-next" label={t('kayit.onb.next')} onPress={next} />
        <View style={styles.loginRow}>
          {step === 5 ? (
            <>
              <AppText maxFontSizeMultiplier={1.3} style={[styles.loginQ, { color: P.sec }]}>
                {t('kayit.onb.login_q')}
              </AppText>
              <KButton testID="kayit-onb-login" variant="text" label={t('kayit.onb.login_a')} onPress={() => navigation.getParent()?.navigate('Login')} />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Görsel alanları ──────────────────────────────────────────────────────────
function Visual({
  s,
  W,
  h,
  start,
  onStart,
  choice,
  onChoice,
  showSeg,
}: {
  s: number;
  W: number;
  h: number;
  start: KStart | null;
  onStart: (k: KStart) => void;
  choice: KPath;
  onChoice: (p: KPath) => void;
  showSeg: boolean;
}) {
  const { t } = useT();
  const P = useK();
  if (s === 1) {
    return (
      <View style={styles.center}>
        <Mascot size={Math.min(140, h * 0.4)} />
      </View>
    );
  }
  if (s === 2) {
    const pw = Math.min(W - 64, 320);
    const ph = Math.min(pw * 0.86, h - 96);
    return (
      <View style={styles.center} accessible accessibilityLabel={t('kayit.onb.visual_scan')}>
        <View style={{ width: pw, height: ph }}>
          <Image source={PHOTO.meal} style={[styles.photo, { width: pw, height: ph }]} resizeMode="cover" />
          <ScanFrame w={pw} h={ph} />
        </View>
        <View style={styles.chips}>
          {(
            [
              ['chip_snap', CameraIcon],
              ['chip_describe', Microphone],
              ['chip_ask', ChatCircleDots],
            ] as const
          ).map(([k, Ico]) => (
            <View key={k} style={[styles.chip, { backgroundColor: P.surface, borderColor: P.line }]}>
              <Ico size={18} color={P.ink} />
              <AppText maxFontSizeMultiplier={1.3} style={[styles.chipText, { color: P.ink }]}>
                {t(`kayit.onb.${k}`)}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (s === 3) return <ProductVisual W={W} h={h} />;
  if (s === 4) return <PostVisual W={W} h={h} />;
  return (
    <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={styles.startWrap} showsVerticalScrollIndicator={false}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('kayit.onb.start_group')} style={{ gap: 10 }}>
        {STARTS.map((k) => (
          <OptionRow key={k} testID={`kayit-start-${k}`} icon={START_ICON[k]} label={t(`kayit.onb.card_${k}`)} sub={t(`kayit.onb.card_${k}_sub`)} selected={start === k} onPress={() => onStart(k)} />
        ))}
      </View>
      {showSeg ? (
        <View style={{ gap: 8, marginTop: 18 }}>
          <AppText nativeID="ob-profile-label" maxFontSizeMultiplier={1.3} style={[styles.segLabel, { color: P.sec }]}>
            {t('kayit.onb.seg_label')}
          </AppText>
          <Segment
            testID="kayit-seg"
            label={t('kayit.onb.seg_label')}
            labelledBy="ob-profile-label"
            value={choice}
            onChange={onChoice}
            options={[
              { key: 'a', label: t('kayit.onb.seg_now') },
              { key: 'b', label: t('kayit.onb.seg_later') },
            ]}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Tarama çerçevesi: dört beyaz köşe (Tara ekranındaki vizör dili). */
function ScanFrame({ w, h }: { w: number; h: number }) {
  const m = 18;
  const len = 28;
  const corner = (pos: object, edges: object) => <View style={[styles.corner, { width: len, height: len }, pos, edges]} />;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: w, height: h }]}>
      {corner({ left: m, top: m }, { borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 10 })}
      {corner({ right: m, top: m }, { borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 10 })}
      {corner({ left: m, bottom: m }, { borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 10 })}
      {corner({ right: m, bottom: m }, { borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 10 })}
    </View>
  );
}

type Shown = { name: string; img: string; calories: number | null; price: number; real: boolean };

/** 3. ekran: gerçek eatkcal öğünü (fotoğraflı, ≥ 250 kcal ilk ürün; sos/içecek değil); katalog gelmezse yerel ürün fotoğrafı (fiyatsız). */
function ProductVisual({ W, h }: { W: number; h: number }) {
  const { t } = useT();
  const fallback: Shown = { name: t('kayit.onb.product_fallback'), img: assetUri(PHOTO.product), calories: null, price: 0, real: false };
  const [shown, setShown] = useState<Shown>(fallback);
  useEffect(() => {
    let alive = true;
    void loadEatkcalProducts().then((list) => {
      const p = list.find((x) => !!x.img && Number(x.calories ?? x.cal) >= 250);
      if (alive && p) setShown({ name: p.name, img: p.img!, calories: Number(p.calories ?? p.cal), price: p.price, real: true });
    });
    return () => {
      alive = false;
    };
  }, []);
  const cw = Math.min(W - 120, 240);
  const ph = Math.min(cw * 0.95, h - 110);
  return (
    <View style={styles.center} accessible accessibilityLabel={`${t('kayit.onb.visual_product')}: ${shown.name}`}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ProductCard product={{ id: 'onb', name: shown.name, price: shown.price, img: shown.img, calories: shown.calories }} width={cw} photoHeight={ph} onPress={() => {}} hidePrice={!shown.real} />
      </View>
    </View>
  );
}

/** 4. ekran: Keşfet gönderi kartı (mevcut PostCard, statik örnek veri; etkileşimsiz). */
function PostVisual({ W, h }: { W: number; h: number }) {
  const { t } = useT();
  const P = useK();
  const model: PostCardModel = {
    id: 'onb-post',
    authorId: 'onb',
    authorName: t('kayit.onb.post_author'),
    handle: t('kayit.onb.post_handle'),
    verified: false,
    badgeKey: null,
    isOfficial: false,
    time: t('kayit.onb.post_time'),
    body: t('kayit.onb.post_body'),
    avatarUrl: null,
    media: [{ url: assetUri(PHOTO.post), width: 525, height: 435 }],
    meal: null,
    postType: 'serbest' as PostCardModel['postType'],
    activity: null,
    isMine: false,
    pending: false,
    stats: { likes: 128, saves: 34, adds: 12, comments: 9, did_it: 0 },
    me: { liked: false, saved: false, is_author: false },
    link: '',
  };
  const noop = () => {};
  return (
    <View style={styles.center} accessible accessibilityLabel={t('kayit.onb.visual_post')}>
      <View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[styles.post, { width: W - 40, maxHeight: h - 24, backgroundColor: P.surface }]}
      >
        <PostCard model={model} onLike={noop} onSave={noop} onOpenMenu={noop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  text: { paddingHorizontal: 24, paddingTop: 24, gap: 8 },
  title: { fontFamily: FONT.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  sub: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, gap: 14 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  loginRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: -10 },
  loginQ: { fontFamily: FONT.body, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { borderRadius: 20 },
  corner: { position: 'absolute', borderColor: '#FFFFFF' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, minHeight: 36 },
  chipText: { fontFamily: FONT.semi, fontSize: 14 },
  startWrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  segLabel: { fontFamily: FONT.semi, fontSize: 13, textAlign: 'center' },
  post: { borderRadius: 16, overflow: 'hidden' },
});

