// FinShareSheet — paylaş sayfası (G61-S1 md.2; tasarım docs/g61/design/FinShareSheet.dc.html).
//
// Hikâye 9:16 / Gönderi 4:5 seçimi · 3 şablon (Açık / Koyu / Fotoğraflı — fotoğraf yoksa 2) ·
// QR anahtarı · gizlilik satırı · hedefler. Hâller: varsayılan / bağlantı kopyalandı (2,4 sn) /
// görsel hazırlanıyor (iskelet; görsel gerektiren hedefler pasif, bağlantı açık) / hata
// (Tekrar dene; bağlantı ve Diğer açık). Şablon + ölçü kart türü başına hatırlanır.
//
// Önizleme = gerçek ShareCard'ın küçültülmüşü (viewBox). Paylaşılan PNG gizli tam boy
// (1080 px) ShareCard'dan `toDataURL` ile alınır (src/lib/shareCard.ts zinciri).
// Bayraklar ÇAĞIRANDA: `paylasim_karti` kapalıyken bu sayfa hiç mount edilmez;
// `linkEnabled` = `paylasim_baglanti` (kapalıysa bağlantı / QR / X / kopyala yok).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  InteractionManager,
  Linking,
  PixelRatio,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { AppText, Sheet, useTheme } from '../../core/design';
import { SCROLL_KEYBOARD } from '../../core/design/keyboard';
import { FinSkeletonBlock } from '../../core/design/components/FinSkeleton';
import { REDUCED, RN_CURVE, SHARE_MOTION, useReducedMotion, haptic } from '../../core/design/motion';
import { useT } from '../../core/i18n';
import { track } from '../../lib/analytics';
import { captureSvgToPngBase64, shareImageUri, writePngBase64, type SvgCaptureRef } from '../../lib/shareCard';
import { cardTitle, isSnapshotKind, type ShareCardInput } from '../../lib/share/cardModel';
import { displayLink, shareLink, type ShareKind } from '../../lib/share/links';
import { createShareSnapshot } from '../../lib/share/snapshotApi';
import {
  isTargetDisabled,
  runTarget,
  visibleTargets,
  type ShareDeps,
  type TargetKey,
} from '../../lib/share/targets';
import ShareCard, { cardPhoto } from './cards/ShareCard';
import { CARD_W, cardHeight, type CardBg, type CardSize } from './cards/cardTheme';

export type SharePhase = 'default' | 'copied' | 'loading' | 'error';

export type ShareSheetProps = {
  visible: boolean;
  onClose: () => void;
  input: ShareCardInput | null;
  /** Bağlantı kimliği (gönderi id, kullanıcı adı, tarif, davet kodu, hikâye UUID). Öğün/gün/röntgen için boş → anlık görüntü. */
  linkId?: string | null;
  /** `paylasim_baglanti` bayrağı. */
  linkEnabled: boolean;
  /** Analitik yüzeyi (post_menu, profile_header, meal_detail, day_card, invite, story_viewers, xray). */
  surface: string;
  /** YALNIZ __DEV__ vitrini: hâli sabitle. */
  forcePhase?: SharePhase;
  /** YALNIZ vitrin / test: anlık görüntü kimliği sabit. */
  presetSnapshotId?: string | null;
  testID?: string;
};

const PREF_KEY = '@kcal_share_pref_v1';
type Pref = { size: CardSize; bg: CardBg };
const memPref: Partial<Record<ShareKind, Pref>> = {};

async function readPref(kind: ShareKind): Promise<Pref | null> {
  if (memPref[kind]) return memPref[kind] as Pref;
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    const all = raw ? (JSON.parse(raw) as Partial<Record<ShareKind, Pref>>) : {};
    Object.assign(memPref, all);
    return all[kind] ?? null;
  } catch {
    return null;
  }
}
function writePref(kind: ShareKind, p: Pref) {
  memPref[kind] = p;
  void AsyncStorage.setItem(PREF_KEY, JSON.stringify(memPref)).catch(() => undefined);
}

// Tasarım renkleri (FinShareSheet `t`): açık / koyu.
const PAL = {
  light: {
    text: '#0A0A0A', sec: '#6B6B70', line: '#E9EBEE', card: '#FFFFFF', track: 'rgba(118,118,128,0.12)', segOn: '#FFFFFF',
    tile: '#FFFFFF', tileRing: '#E9EBEE', ink: '#0A0A0A', onInk: '#FFFFFF', err: '#C62828', errBg: 'rgba(198,40,40,0.10)', swOff: '#C3C7CC',
  },
  dark: {
    text: '#F5F5F5', sec: '#A1A1A6', line: '#38383A', card: '#2C2C2E', track: 'rgba(118,118,128,0.24)', segOn: '#636366',
    tile: '#2C2C2E', tileRing: '#38383A', ink: '#F5F5F5', onInk: '#0A0A0A', err: '#FF6961', errBg: 'rgba(255,105,97,0.16)', swOff: '#48484A',
  },
};
const LIME = '#B9EF14';

// Tasarımdaki hedef ikonları (24×24, stroke 1.8).
const TARGET_ICON: Record<TargetKey, string> = {
  ig_story: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z M12 8.5v7 M8.5 12h7',
  ig_post: 'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M17 7h.01',
  whatsapp: 'M4 20l1.2-3.8A8 8 0 1 1 8 19l-4 1Z M9.2 8.8c-.4 3.2 2.8 6.4 6 6',
  x: 'M4.5 4.5h4L19.5 19.5h-4Z M19 4.5l-6 6.6 M5 19.5l6-6.6',
  copy: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1 M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  save: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  other: 'M6 12h.01 M12 12h.01 M18 12h.01',
};
const TARGET_LABEL: Record<TargetKey, string> = {
  ig_story: 'share_kit.ig_story',
  ig_post: 'share_kit.ig_post',
  whatsapp: 'share_kit.wa',
  x: 'share_kit.x',
  copy: 'share_kit.copy',
  save: 'share_kit.save',
  other: 'share_kit.more',
};

function Icon({ d, size, color, sw = 1.8 }: { d: string; size: number; color: string; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const THUMB_W = 150;
// toDataURL yerel piksel ölçeğinde çizer (iOS 3×) → çıktı tam 1080 px olsun diye pt genişliği 1080 / ölçek.
const CAPTURE_W = CARD_W / PixelRatio.get();
const LEGACY_SHARE_TARGET: Partial<Record<ShareKind, 'post' | 'day' | 'meal'>> = { post: 'post', day: 'day', meal: 'meal', xray: 'meal' };

export function ShareSheet({
  visible,
  onClose,
  input,
  linkId: linkIdProp,
  linkEnabled,
  surface,
  forcePhase,
  presetSnapshotId,
  testID = 'share-sheet',
}: ShareSheetProps) {
  const theme = useTheme();
  const c = theme.isDark ? PAL.dark : PAL.light;
  const { t, lang } = useT();
  const cardLang = lang === 'en' ? 'en' : 'tr';
  const reduced = useReducedMotion();
  const kind = input?.kind ?? 'meal';
  const photo = input ? cardPhoto(input) : null;
  const bgs: CardBg[] = photo ? ['light', 'dark', 'photo'] : ['light', 'dark'];

  const [size, setSize] = useState<CardSize>('story');
  const [bg, setBg] = useState<CardBg>('light');
  const [qr, setQr] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [toast, setToast] = useState<{ title: string; sub?: string } | null>(null);
  const [snapId, setSnapId] = useState<string | null>(presetSnapshotId ?? null);
  const [snapPending, setSnapPending] = useState(false);
  const [busy, setBusy] = useState<TargetKey | null>(null);
  const snapPromise = useRef<Promise<string | null> | null>(null);
  const storyRef = useRef<SvgCaptureRef | null>(null);
  const postRef = useRef<SvgCaptureRef | null>(null);
  const cache = useRef(new Map<string, string>());
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsSnapshot = !!input && linkEnabled && isSnapshotKind(kind) && !linkIdProp;
  const linkId = linkEnabled ? (linkIdProp ?? snapId) : null;
  const hasLink = linkEnabled && (!!linkId || snapPending);
  const effectivePhase: SharePhase = forcePhase ?? (toast ? 'copied' : phase === 'ready' ? 'default' : phase);
  const imageReady = effectivePhase === 'default' || effectivePhase === 'copied';
  const short = linkId ? displayLink(kind, linkId) : 'l.eatkcal.com';
  const qrValue = linkId ? shareLink(kind, linkId) : null;
  const qrOn = kind === 'invite' ? !!qrValue : qr && !!qrValue;

  // Açılış: tercih + analitik + anlık görüntü + ilk görsel hazırlığı.
  useEffect(() => {
    if (!visible || !input) return;
    let alive = true;
    cache.current.clear();
    setPhase('loading');
    track('share_open', { kind: input.kind, surface });
    void readPref(input.kind).then((p) => {
      if (!alive || !p) return;
      setSize(p.size);
      setBg(p.bg === 'photo' && !cardPhoto(input) ? 'light' : p.bg);
    });
    if (needsSnapshot && !presetSnapshotId) {
      setSnapPending(true);
      const pr = createShareSnapshot(input.kind as 'meal' | 'day' | 'xray', input.data as Record<string, unknown>);
      snapPromise.current = pr;
      void pr.then((id) => {
        if (!alive) return;
        setSnapId(id);
        setSnapPending(false);
      });
    }
    const task = InteractionManager.runAfterInteractions(() => {
      // İlk karede ShareCard çizilsin; sonra yakalanabilir mi dene (yazı tipi / görsel hazır).
      requestAnimationFrame(() => {
        void captureSvgToPngBase64(storyRef.current)
          .then(() => alive && setPhase('ready'))
          .catch(() => alive && setPhase('error'));
      });
    });
    return () => {
      alive = false;
      task.cancel?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, input]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback(
    (title: string, sub?: string) => {
      setToast({ title, sub });
      AccessibilityInfo.announceForAccessibility(title);
      toastAnim.setValue(0);
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: reduced ? REDUCED.duration : SHARE_MOTION.toastIn,
        easing: reduced ? RN_CURVE.linear : RN_CURVE.enter,
        useNativeDriver: true,
      }).start();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), SHARE_MOTION.toastHold);
    },
    [reduced, toastAnim],
  );

  const pickSize = (z: CardSize) => {
    haptic('selection');
    setSize(z);
    writePref(kind, { size: z, bg });
  };
  const pickBg = (b: CardBg) => {
    haptic('selection');
    setBg(b);
    writePref(kind, { size, bg: b });
  };

  const getImage = useCallback(
    async (z: CardSize): Promise<string> => {
      const key = `${z}|${bg}|${qrOn ? 1 : 0}|${linkId ?? ''}`;
      const hit = cache.current.get(key);
      if (hit) return hit;
      const b64 = await captureSvgToPngBase64(z === 'post' ? postRef.current : storyRef.current);
      const uri = await writePngBase64(b64, `${kind}-${z}`, `${bg}${qrOn ? 'q' : ''}${(linkId ?? '').slice(0, 8)}`);
      cache.current.set(key, uri);
      return uri;
    },
    [bg, qrOn, linkId, kind],
  );

  const resolveLinkId = useCallback(async (): Promise<string | null> => {
    if (linkId) return linkId;
    if (snapPromise.current) return snapPromise.current;
    return null;
  }, [linkId]);

  const message = useMemo(() => {
    if (!input) return '';
    const name = cardTitle(input);
    return t(`share_kit.msg.${kind}`, { name, code: input.kind === 'invite' ? input.data.code : '' });
  }, [input, kind, t]);

  const onTarget = async (target: TargetKey) => {
    if (!input || busy) return;
    if (isTargetDisabled(target, imageReady)) return;
    setBusy(target);
    const deps: ShareDeps = {
      openURL: (url) => Linking.openURL(url).then(() => undefined),
      copy: (text) => Clipboard.setStringAsync(text).then(() => undefined),
      shareImage: (uri) => shareImageUri(uri, t('share_kit.title')),
      shareText: (msg, url) => Share.share(url ? { message: `${msg} ${url}`, url } : { message: msg }).then(() => undefined),
      getImage,
    };
    const id = linkEnabled ? await resolveLinkId() : null;
    const res = await runTarget(target, { kind, linkId: id, text: message, size }, deps);
    setBusy(null);
    track('share_target', { kind, target, size: target === 'ig_story' ? 'story' : target === 'ig_post' ? 'post' : size, bg, ok: res.ok });
    if (res.ok) {
      const legacy = LEGACY_SHARE_TARGET[kind] ?? 'app';
      track('share', { target: legacy, surface });
      if (res.outcome === 'copied') {
        haptic('success');
        const full = id ? displayLink(kind, id) : short;
        showToast(t('share_kit.copied'), full);
      }
    } else if (res.error !== 'no_link') {
      showToast(t('share_kit.failed'));
    }
  };

  const retry = () => {
    setPhase('loading');
    requestAnimationFrame(() => {
      void captureSvgToPngBase64(storyRef.current)
        .then(() => setPhase('ready'))
        .catch(() => setPhase('error'));
    });
  };

  if (!input) return null;

  const cardName = t(`share_kit.names.${kind}`);
  const thumbH = (THUMB_W * cardHeight(size)) / CARD_W;
  const targets = visibleTargets({ hasLink, canSaveToLibrary: false });
  const showPreviews = effectivePhase === 'default' || effectivePhase === 'copied';
  const loading = effectivePhase === 'loading';
  const error = effectivePhase === 'error';
  const imgOff = loading || error;
  const sizes: { z: CardSize; label: string }[] = [
    { z: 'story', label: t('share_kit.story') },
    { z: 'post', label: t('share_kit.post') },
  ];
  const toastTitle = forcePhase === 'copied' ? t('share_kit.copied') : toast?.title;
  const toastSub = forcePhase === 'copied' ? short : toast?.sub;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('share_kit.title')} product="share" scroll contentStyle={styles.body} testID={testID}>
      <AppText style={[styles.cardName, { color: c.sec }]}>{cardName}</AppText>

      {/* Ölçü */}
      <View accessibilityRole="radiogroup" accessibilityLabel={t('share_kit.size_a11y')} style={[styles.seg, { backgroundColor: c.track }]}>
        {sizes.map(({ z, label }) => {
          const on = size === z;
          return (
            <Pressable
              key={z}
              onPress={() => pickSize(z)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.segBtn, on && { backgroundColor: c.segOn, ...styles.segOnShadow }]}
              testID={`share-size-${z}`}
            >
              <AppText style={[styles.segText, { color: c.text }]}>{label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Şablonlar */}
      {showPreviews ? (
        <ScrollView
          {...SCROLL_KEYBOARD}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={THUMB_W + 12}
          decelerationRate="fast"
          contentContainerStyle={styles.tplRow}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('share_kit.tpl_a11y')}
          testID="share-templates"
        >
          {bgs.map((b) => {
            const on = bg === b;
            const label = t(`share_kit.${b}`);
            return (
              <Pressable
                key={b}
                onPress={() => pickBg(b)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t('share_kit.tpl_item_a11y', { tpl: label, size: size === 'post' ? t('share_kit.post') : t('share_kit.story') })}
                style={styles.tpl}
                testID={`share-tpl-${b}`}
              >
                <View
                  style={[
                    styles.thumb,
                    { height: thumbH, borderColor: on ? LIME : c.line, borderWidth: on ? 3 : 1 },
                    on && { shadowColor: c.text },
                  ]}
                >
                  <ShareCard input={input} bg={b} size={size} qr={qrOn} lang={cardLang} link={short} qrValue={qrValue} width={THUMB_W - (on ? 6 : 2)} />
                </View>
                <View style={styles.tplLabelRow}>
                  {on ? (
                    <View style={styles.tplCheck}>
                      <Icon d="M5 12.5l4.5 4.5L19 7.5" size={11} color="#0A0A0A" sw={3} />
                    </View>
                  ) : null}
                  <AppText style={[styles.tplLabel, { color: c.text, fontFamily: on ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' }]}>{label}</AppText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel={t('share_kit.loading_a11y')} testID="share-loading">
          <View style={styles.tplRow}>
            {bgs.map((b) => (
              <View key={b} style={styles.tpl}>
                <FinSkeletonBlock width={THUMB_W} height={thumbH} radius={14} />
                <FinSkeletonBlock width={56} height={12} radius={6} style={styles.skLabel} />
              </View>
            ))}
          </View>
          <AppText style={[styles.loadingText, { color: c.sec }]}>{t('share_kit.loading')}</AppText>
        </View>
      ) : null}

      {error ? (
        <View
          accessibilityRole="alert"
          style={[styles.err, { minHeight: size === 'post' ? 213 : 292, backgroundColor: c.card, borderColor: c.line }]}
          testID="share-error"
        >
          <View style={[styles.errIcon, { backgroundColor: c.errBg }]}>
            <Icon d="M12 4 2.5 20h19Z M12 10v4 M12 17h.01" size={24} color={c.err} sw={2} />
          </View>
          <AppText textRole="sheetTitle" style={[styles.errTitle, { color: c.text }]}>{t('share_kit.err_title')}</AppText>
          <AppText style={[styles.errBody, { color: c.sec }]}>{t('share_kit.err_body')}</AppText>
          <Pressable onPress={retry} accessibilityRole="button" style={[styles.retry, { backgroundColor: c.text }]} testID="share-retry">
            <Icon d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3 M19.5 4.5v4h-4" size={18} color={theme.color.bg} sw={2.2} />
            <AppText style={[styles.retryText, { color: theme.color.bg }]}>{t('share_kit.retry')}</AppText>
          </Pressable>
        </View>
      ) : null}

      {/* QR + gizlilik */}
      <View style={styles.opts}>
        {hasLink ? (
          <View style={[styles.qrRow, { opacity: imgOff ? 0.38 : 1 }]}>
            <Icon d="M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2.5v2.5H14z M17.5 17.5H20V20h-2.5z" size={20} color={c.text} sw={1.9} />
            <AppText style={[styles.qrText, { color: c.text }]}>{t('share_kit.qr')}</AppText>
            <Switch
              value={kind === 'invite' ? true : qr}
              onValueChange={(v) => {
                haptic('selection');
                setQr(v);
              }}
              disabled={imgOff || kind === 'invite' || !qrValue}
              trackColor={{ false: c.swOff, true: LIME }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={c.swOff}
              accessibilityLabel={t('share_kit.qr')}
              testID="share-qr"
            />
          </View>
        ) : null}
        <View style={styles.privRow}>
          <View style={styles.privIcon}>
            <Icon d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3 M5.5 11h13v9h-13z" size={15} color={c.sec} sw={2} />
          </View>
          <AppText style={[styles.priv, { color: c.sec }]}>{t(`share_kit.priv.${kind}`)}</AppText>
        </View>
      </View>

      {/* Hedefler */}
      <View accessibilityRole="list" accessibilityLabel={t('share_kit.targets_a11y')} style={styles.grid} testID="share-targets">
        {targets.map((k) => {
          const dis = isTargetDisabled(k, !imgOff);
          const isCopy = k === 'copy';
          return (
            <View key={k} style={styles.cell}>
              <Pressable
                onPress={() => void onTarget(k)}
                disabled={dis || busy != null}
                accessibilityRole="button"
                accessibilityState={{ disabled: dis, busy: busy === k }}
                accessibilityLabel={t(TARGET_LABEL[k])}
                style={({ pressed }) => [styles.tgt, { opacity: dis ? 0.38 : 1, transform: [{ scale: pressed && !reduced ? SHARE_MOTION.pressScale : 1 }] }]}
                testID={`share-target-${k}`}
              >
                <View
                  style={[
                    styles.tgtCircle,
                    { backgroundColor: isCopy ? LIME : c.tile, borderColor: c.tileRing, borderWidth: isCopy ? 0 : StyleSheet.hairlineWidth * 2 },
                  ]}
                >
                  <Icon d={TARGET_ICON[k]} size={24} color={isCopy ? '#0A0A0A' : c.text} />
                </View>
                <AppText style={[styles.tgtLabel, { color: c.text }]} numberOfLines={2}>
                  {t(TARGET_LABEL[k])}
                </AppText>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Bildirim (kopyalandı / hata) — sayfanın içinde (Modal üstünde uygulama toast'ı görünmez). */}
      {toastTitle ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.toast,
            { backgroundColor: c.ink },
            forcePhase === 'copied'
              ? null
              : {
                  opacity: toastAnim,
                  transform: reduced ? [] : [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                },
          ]}
          testID="share-toast"
        >
          <View style={styles.toastCheck}>
            <Icon d="M5 12.5l4.5 4.5L19 7.5" size={14} color="#0A0A0A" sw={3} />
          </View>
          <View style={styles.toastTexts}>
            <AppText style={[styles.toastTitle, { color: c.onInk }]}>{toastTitle}</AppText>
            {toastSub ? (
              <AppText style={[styles.toastSub, { color: c.onInk }]} numberOfLines={1}>
                {toastSub}
              </AppText>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {/* Gizli tam boy kartlar (yakalama kaynağı) — ekranda 1×1 kırpılı, ekran okuyucudan gizli. */}
      <View style={styles.captureHost} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ShareCard
          ref={(r) => {
            storyRef.current = r as unknown as SvgCaptureRef | null;
          }}
          input={input}
          bg={bg}
          size="story"
          qr={qrOn}
          lang={cardLang}
          link={short}
          qrValue={qrValue}
          width={CAPTURE_W}
        />
        <ShareCard
          ref={(r) => {
            postRef.current = r as unknown as SvgCaptureRef | null;
          }}
          input={input}
          bg={bg}
          size="post"
          qr={qrOn}
          lang={cardLang}
          link={short}
          qrValue={qrValue}
          width={CAPTURE_W}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 0, paddingBottom: 8 },
  cardName: { fontSize: 14, marginTop: -4, paddingHorizontal: 20 },
  seg: { marginTop: 10, marginHorizontal: 16, minHeight: 40, padding: 3, borderRadius: 20, flexDirection: 'row', gap: 3 },
  segBtn: { flex: 1, minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOnShadow: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', textAlign: 'center' },
  tplRow: { flexDirection: 'row', gap: 12, paddingTop: 14, paddingBottom: 4, paddingHorizontal: 16 },
  tpl: { width: THUMB_W, alignItems: 'center', gap: 8, minHeight: 44 },
  thumb: { width: THUMB_W, borderRadius: 14, overflow: 'hidden' },
  tplLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tplCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  tplLabel: { fontSize: 13 },
  skLabel: { marginTop: 8 },
  loadingText: { fontSize: 13, textAlign: 'center', marginTop: 4, marginHorizontal: 16 },
  err: {
    marginTop: 14, marginHorizontal: 16, padding: 18, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  errIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  errTitle: { marginTop: 6, fontSize: 18, textAlign: 'center' },
  errBody: { fontSize: 14, textAlign: 'center', maxWidth: 280 },
  retry: { marginTop: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retryText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  opts: { paddingTop: 6, paddingHorizontal: 16 },
  qrRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrText: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  privRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  privIcon: { marginTop: 2 },
  priv: { flex: 1, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, paddingTop: 14, paddingHorizontal: 8 },
  cell: { width: '25%', alignItems: 'center' },
  tgt: { width: 84, minHeight: 84, alignItems: 'center', gap: 6 },
  tgtCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  tgtLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 15, textAlign: 'center' },
  toast: {
    position: 'absolute', left: 16, right: 16, bottom: 8, minHeight: 56, borderRadius: 28,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  toastCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  toastTexts: { flex: 1, minWidth: 0 },
  toastTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  toastSub: { fontSize: 12, opacity: 0.78 },
  captureHost: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'hidden' },
});

export default ShareSheet;
