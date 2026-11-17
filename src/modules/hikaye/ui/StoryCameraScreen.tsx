// G59-S1 — Hikâye kamerası (docs/g59/design/FinStoryCamera.dc.html birebir): vizör (köşe 24), flaş (kapalı →
// otomatik → açık, durum hapı), kapat, "Aa Oluştur" (yazılı hikâye), "Günüm" (gün halkası kiti), yakınlaştırma
// 0,5 / 1× / 2, bugünün öğün fotoğrafları şeridi, galeri, deklanşör (dokun = foto; basılı tut = video ≤ 60 sn,
// yalnız `kesfet_video` açıkken), kamerayı çevir, mod sekmesi Gönderi / Hikâye / Reels (Reels yalnız kesfet_video).
// Hareket: deklanşör 110 ms standart (ölçek 0,9), çevirme 330 ms; Reduce Motion → 200 ms opaklık. Haptik:
// flaş = hafif, çekim = orta. Kamera izni bir kez reddedildiyse tekrar sorulmaz (askOnce); galeri/oluştur açık kalır.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, DURATION, fontFamily, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { DENIED_KEYS, askOnce } from '../../../lib/permissions/askOnce';
import { loadExpoCamera } from '../../ai/scan/ui/FinScanCamera';
import { useMealPhoto } from '../../gun/useMealPhoto';
import type { TodayConsumption } from '../../gun/todayConsumptions';
import type { RootStackParamList } from '../../../navigation/types';
import { cameraModes, recordProgress, storyVideoAllowed, zoomFor } from '../rules';
import { LIME, OM_BG, OM_SOLID, storyTheme } from './tokens';
import { useReduceTransparency } from './a11y';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rp = RouteProp<RootStackParamList, 'StoryCamera'>;
type Flash = 'off' | 'auto' | 'on';
type Zoom = 0.5 | 1 | 2;

const P_X = 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';
const P_FLIP = 'M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16H211.4L184.81,71.64l-.25-.24a80,80,0,1,0-1.67,114.78,8,8,0,0,1,11,11.63A95.44,95.44,0,0,1,128,224h-1.32A96,96,0,1,1,195.75,60L224,85.8V56a8,8,0,1,1,16,0Z';
const P_FLASH = 'M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z';
const P_IMAGE = 'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z';

export interface PickedStoryMedia {
  uri: string;
  type: 'image' | 'video';
  width: number;
  height: number;
  durationMs?: number;
  fileSizeBytes?: number;
  mimeType?: string | null;
}

/** Galeriden tek foto (ya da video izni varsa video). Sistem seçicisi izin istemez (G26-S1). */
async function pickFromGallery(video: boolean): Promise<PickedStoryMedia | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: video ? ImagePicker.MediaTypeOptions.All : ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    quality: 0.8,
    videoMaxDuration: 60,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (a.type === 'video') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rules = require('../../media/video/rules') as typeof import('../../media/video/rules');
    rules.assertVideoMime(a.mimeType, a.uri);
    rules.assertVideoDuration(a.duration ?? 0);
    if (a.fileSize) rules.assertVideoSize(a.fileSize);
    return { uri: a.uri, type: 'video', width: a.width, height: a.height, durationMs: a.duration ?? 0, fileSizeBytes: a.fileSize ?? undefined, mimeType: rules.videoMimeOf(a.mimeType, a.uri) };
  }
  return { uri: a.uri, type: 'image', width: a.width ?? 1080, height: a.height ?? 1920 };
}

function MealThumb({ m, onPress, size = 56, label }: { m: TodayConsumption; onPress: () => void; size?: number; label: string }) {
  const photo = useMealPhoto(m.photo_url ?? null);
  if (photo.status !== 'ready') return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden' }}>
      <Image source={{ uri: photo.uri }} style={{ width: size, height: size }} contentFit="cover" />
    </Pressable>
  );
}

export default function StoryCameraScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rp>();
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const { height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const solid = useReduceTransparency();
  const om = solid ? OM_SOLID : OM_BG;
  const { user } = useAuth();
  const kesfetVideo = useFeature('kesfet_video');
  const kesfetPaylasim = useFeature('kesfet_paylasim');
  const hikaye = useFeature('hikaye');
  const videoOk = storyVideoAllowed({ hikaye: hikaye || __DEV__, kesfet_video: kesfetVideo });
  const modes = cameraModes({ kesfet_paylasim: kesfetPaylasim, kesfet_video: kesfetVideo });

  const cam = useRef(loadExpoCamera()).current;
  const camRef = useRef<{ takePictureAsync: (o: object) => Promise<{ uri: string; width: number; height: number }>; recordAsync: (o: object) => Promise<{ uri: string } | undefined>; stopRecording: () => void } | null>(null);
  const [perm, setPerm] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [flash, setFlash] = useState<Flash>('off');
  const [flashTip, setFlashTip] = useState(false);
  const [front, setFront] = useState(false);
  const [zoom, setZoom] = useState<Zoom>(1);
  const [camMode, setCamMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  const [recMs, setRecMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [meals, setMeals] = useState<TodayConsumption[]>([]);
  const recStart = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);

  // Bugünün öğünleri (fotoğraflı olanlar şeritte).
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getTodayConsumptions } = require('../../gun/todayConsumptions') as typeof import('../../gun/todayConsumptions');
    getTodayConsumptions()
      .then((list) => {
        if (alive) setMeals(list.filter((m) => !!m.photo_url));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // İzin (bir kez reddedildiyse tekrar sistem penceresi yok).
  const checkPerm = useCallback(
    async (ask: boolean) => {
      if (!cam) {
        setPerm('denied');
        return;
      }
      try {
        const read = async () => {
          const r = await cam.Camera.getCameraPermissionsAsync();
          return { status: r.granted ? ('granted' as const) : r.canAskAgain ? ('undetermined' as const) : ('denied' as const), canAskAgain: r.canAskAgain };
        };
        const ok = ask
          ? await askOnce({
              read,
              request: async () => ((await cam.Camera.requestCameraPermissionsAsync()).granted ? 'granted' : 'denied'),
              wasDenied: async () => (await AsyncStorage.getItem(DENIED_KEYS.camera)) === '1',
              markDenied: () => AsyncStorage.setItem(DENIED_KEYS.camera, '1'),
            })
          : (await read()).status === 'granted';
        setPerm(ok ? 'granted' : 'denied');
      } catch {
        setPerm('denied');
      }
    },
    [cam],
  );
  useEffect(() => {
    void checkPerm(true);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checkPerm(false);
    });
    return () => sub.remove();
  }, [checkPerm]);

  // Başlangıç kısayolu (tepside "Oluştur"/"Günüm" gibi).
  useEffect(() => {
    const start = route.params?.start;
    if (start === 'create') nav.replace('StoryEditor', { mediaType: 'none', preset: 'text' });
    if (start === 'day') nav.replace('StoryEditor', { mediaType: 'none', preset: 'kit' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flashTip) return;
    const id = setTimeout(() => setFlashTip(false), 1600);
    return () => clearTimeout(id);
  }, [flashTip, flash]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecMs(Date.now() - recStart.current), 200);
    return () => clearInterval(id);
  }, [recording]);

  const toEditor = useCallback(
    (m: PickedStoryMedia, extra?: { mealPhotoPath?: string | null; mealId?: string | null }) => {
      nav.replace('StoryEditor', {
        mediaType: m.type,
        mediaUri: m.uri,
        width: m.width,
        height: m.height,
        durationMs: m.durationMs,
        fileSizeBytes: m.fileSizeBytes,
        mimeType: m.mimeType,
        mealPhotoPath: extra?.mealPhotoPath ?? null,
        mealId: extra?.mealId ?? null,
        preset: 'tools',
      });
    },
    [nav],
  );

  const takePhoto = useCallback(async () => {
    if (busy || !camRef.current) return;
    setBusy(true);
    haptic('medium');
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.85, exif: false, skipProcessing: false });
      toEditor({ uri: pic.uri, type: 'image', width: pic.width, height: pic.height });
    } catch {
      setBusy(false);
    }
  }, [busy, toEditor]);

  const startRecord = useCallback(async () => {
    if (!videoOk || !cam || !camRef.current || recording) return;
    try {
      const mic = await cam.Camera.requestMicrophonePermissionsAsync();
      if (!mic.granted || !holding.current) return;
      setCamMode('video');
      // Mod değişimi sonrası oturum hazırlanır (iOS ~300 ms).
      await new Promise((r) => setTimeout(r, 350));
      if (!holding.current || !camRef.current) {
        setCamMode('picture');
        return;
      }
      haptic('medium');
      recStart.current = Date.now();
      setRecMs(0);
      setRecording(true);
      const res = await camRef.current.recordAsync({ maxDuration: 60 });
      setRecording(false);
      const dur = Math.min(60_000, Date.now() - recStart.current);
      setCamMode('picture');
      if (res?.uri && dur >= 500) toEditor({ uri: res.uri, type: 'video', width: 720, height: 1280, durationMs: dur, mimeType: 'video/quicktime' });
    } catch {
      setRecording(false);
      setCamMode('picture');
    }
  }, [cam, recording, toEditor, videoOk]);

  const onPressIn = () => {
    holding.current = true;
    if (!videoOk) return;
    holdTimer.current = setTimeout(() => void startRecord(), 300);
  };
  const onPressOut = () => {
    holding.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (recording) camRef.current?.stopRecording();
  };

  const openGallery = useCallback(async () => {
    try {
      const m = await pickFromGallery(videoOk);
      if (m) toEditor(m);
    } catch {
      // geçersiz video (süre/boyut/tür) → sessiz; kullanıcı yeniden seçebilir
    }
  }, [toEditor, videoOk]);

  const cycleFlash = () => {
    haptic('light');
    setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'));
    setFlashTip(true);
  };
  const flashLabel = tr(flash === 'off' ? 'hikaye.flash_off' : flash === 'auto' ? 'hikaye.flash_auto' : 'hikaye.flash_on');

  // Çevirme animasyonu (330 ms; Reduce Motion → 200 ms opaklık).
  const flipV = useSharedValue(1);
  const flipStyle = useAnimatedStyle(() => ({ opacity: flipV.value }));
  const flip = () => {
    haptic('selection');
    flipV.value = 0.2;
    flipV.value = withTiming(1, { duration: reduced ? 200 : DURATION.base, easing: CURVE.standard });
    setFront((f) => !f);
  };
  const shutterScale = useSharedValue(1);
  const shutterStyle = useAnimatedStyle(() => (reduced ? { opacity: shutterScale.value < 1 ? 0.7 : 1 } : { transform: [{ scale: shutterScale.value }] }));

  const onMode = (m: 'post' | 'story' | 'reels') => {
    if (m === 'story') return;
    haptic('selection');
    if (m === 'post') nav.replace('Composer');
    else nav.replace('Composer', { startVideo: true });
  };

  // Yerleşim: tasarım 852 pt; alt blok (şerit + deklanşör + sekme) 208 pt + alt güvenli alan.
  const bottomPad = Math.max(insets.bottom, 6);
  const topPad = Math.max(insets.top, 20);
  const vfH = Math.max(320, H - topPad - 208 - bottomPad);
  const CameraView = cam?.CameraView;
  const recP = recordProgress(recMs);
  const RC = 2 * Math.PI * 40;

  return (
    <View style={[styles.root, { backgroundColor: st.bg, paddingTop: topPad }]} testID="story-camera">
      <View style={[styles.vf, { height: vfH }]} accessibilityLabel={tr('hikaye.viewfinder')}>
        {perm === 'granted' && CameraView ? (
          <Animated.View style={[StyleSheet.absoluteFill, flipStyle]}>
            <CameraView
              ref={camRef as never}
              style={StyleSheet.absoluteFill}
              facing={front ? 'front' : 'back'}
              mode={camMode}
              flash={flash}
              zoom={zoomFor(zoom)}
              mirror={front}
            />
          </Animated.View>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.denied]}>
            {perm === 'denied' ? (
              <>
                <Text style={styles.deniedT}>{cam ? tr('hikaye.cam_denied_title') : tr('hikaye.cam_unavailable')}</Text>
                {cam ? <Text style={styles.deniedB}>{tr('hikaye.cam_denied_body')}</Text> : null}
                {cam ? (
                  <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" style={styles.deniedBtn}>
                    <Text style={styles.deniedBtnT}>{tr('hikaye.cam_settings')}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        )}
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={styles.gTop} />
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']} style={styles.gBot} />

        <Pressable onPress={cycleFlash} accessibilityRole="button" accessibilityLabel={tr('hikaye.flash_change', { state: flashLabel })} style={[styles.hit44, { left: 6, top: 6 }]}>
          <View style={[styles.om40, { backgroundColor: om }]}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d={P_FLASH} fill={flash === 'on' ? LIME : 'none'} stroke="#FFFFFF" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
              {flash === 'off' ? <Path d="M3.5 3.5l17 17" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" /> : null}
            </Svg>
            {flash === 'auto' ? <Text style={styles.flashA}>A</Text> : null}
          </View>
        </Pressable>
        {flashTip ? (
          <View accessibilityRole="text" accessibilityLiveRegion="polite" style={[styles.tip, { backgroundColor: om }]}>
            <Text style={styles.tipT}>{flashLabel}</Text>
          </View>
        ) : null}
        <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} style={[styles.hit44, { right: 6, top: 6 }]} testID="story-camera-close">
          <View style={[styles.om40, { backgroundColor: om }]}>
            <Svg width={20} height={20} viewBox="0 0 256 256"><Path d={P_X} fill="#FFFFFF" /></Svg>
          </View>
        </Pressable>

        <View style={styles.leftCol}>
          <Pressable onPress={() => nav.replace('StoryEditor', { mediaType: 'none', preset: 'text' })} accessibilityRole="button" accessibilityLabel={tr('hikaye.create_a11y')} style={styles.sideBtn} testID="story-camera-create">
            <View style={[styles.om40, { backgroundColor: om, margin: 2 }]}><Text style={styles.aa}>Aa</Text></View>
            <View style={[styles.sideLabel, { backgroundColor: om }]}><Text style={styles.sideLabelT}>{tr('hikaye.create')}</Text></View>
          </Pressable>
          <Pressable onPress={() => nav.replace('StoryEditor', { mediaType: 'none', preset: 'kit' })} accessibilityRole="button" accessibilityLabel={tr('hikaye.day_a11y')} style={styles.sideBtn} testID="story-camera-day">
            <View style={[styles.om40, { backgroundColor: om, margin: 2 }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={8.5} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={3} />
                <Circle cx={12} cy={12} r={8.5} fill="none" stroke={LIME} strokeWidth={3} strokeLinecap="round" strokeDasharray="36 53.4" transform="rotate(-90 12 12)" />
              </Svg>
            </View>
            <View style={[styles.sideLabel, { backgroundColor: om }]}><Text style={styles.sideLabelT}>{tr('hikaye.my_day')}</Text></View>
          </Pressable>
        </View>

        {recording ? (
          <View style={[styles.tip, { backgroundColor: om, top: 13 }]} accessibilityLiveRegion="polite">
            <View style={styles.recDot} />
            <Text style={styles.tipT}>{tr('hikaye.recording', { s: `0:${String(Math.floor(recMs / 1000)).padStart(2, '0')}` })}</Text>
          </View>
        ) : null}

        <View accessibilityRole="radiogroup" accessibilityLabel={tr('hikaye.zoom')} style={styles.zoomRow}>
          {([0.5, 1, 2] as Zoom[]).map((z) => {
            const on = zoom === z;
            const num = z === 0.5 ? '0,5' : String(z);
            return (
              <Pressable key={z} onPress={() => { haptic('selection'); setZoom(z); }} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${num}×`} style={styles.hit44c}>
                <View style={[styles.zoomDot, { width: on ? 38 : 30, height: on ? 38 : 30, backgroundColor: on ? '#FFFFFF' : om }]}>
                  <Text style={[styles.zoomT, { color: on ? '#0A0A0A' : '#FFFFFF' }]}>{on ? `${num}×` : num}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={tr('hikaye.today_strip')} style={styles.strip} contentContainerStyle={styles.stripRow}>
        <View style={[styles.todayCard, { backgroundColor: st.card, borderColor: st.line }]}>
          <View style={styles.limeDot} />
          <Text style={[styles.todayT, { color: st.text }]}>{tr('hikaye.today')}</Text>
        </View>
        {meals.map((m) => (
          <MealThumb key={m.id} m={m} label={tr('hikaye.gallery_item', { name: m.name })} onPress={() => toEditor({ uri: '', type: 'image', width: 1080, height: 1350 }, { mealPhotoPath: m.photo_url ?? null, mealId: m.id })} />
        ))}
      </ScrollView>

      <View style={styles.shutRow}>
        <Pressable onPress={() => void openGallery()} accessibilityRole="button" accessibilityLabel={tr('hikaye.gallery_a11y')} style={styles.hit44c} testID="story-camera-gallery">
          <View style={[styles.galleryBox, { borderColor: st.text, backgroundColor: st.card }]}>
            {meals[0] ? <MealThumb m={meals[0]} size={36} label="" onPress={() => void openGallery()} /> : <Svg width={20} height={20} viewBox="0 0 256 256"><Path d={P_IMAGE} fill={st.text} /></Svg>}
          </View>
        </Pressable>
        <Pressable
          onPress={() => void takePhoto()}
          onPressIn={() => {
            shutterScale.value = withTiming(0.9, { duration: DURATION.instant, easing: CURVE.standard });
            onPressIn();
          }}
          onPressOut={() => {
            shutterScale.value = withTiming(1, { duration: DURATION.instant, easing: CURVE.standard });
            onPressOut();
          }}
          delayLongPress={300}
          onLongPress={() => undefined}
          disabled={perm !== 'granted'}
          accessibilityRole="button"
          accessibilityLabel={videoOk ? tr('hikaye.shutter_a11y') : tr('hikaye.shutter_photo_a11y')}
          accessibilityState={{ disabled: perm !== 'granted', busy }}
          testID="story-camera-shutter"
        >
          <Animated.View style={[styles.shutter, { borderColor: st.text, opacity: perm === 'granted' ? 1 : 0.4 }, shutterStyle]}>
            <View style={[styles.shutterIn, { backgroundColor: recording ? '#E5484D' : LIME }]} />
            {recording ? (
              <Svg width={84} height={84} style={StyleSheet.absoluteFill}>
                <Circle cx={42} cy={42} r={40} fill="none" stroke={LIME} strokeWidth={4} strokeDasharray={`${RC * recP} ${RC}`} transform="rotate(-90 42 42)" />
              </Svg>
            ) : null}
          </Animated.View>
        </Pressable>
        <Pressable onPress={flip} accessibilityRole="button" accessibilityLabel={`${tr('hikaye.flip')}, ${tr(front ? 'hikaye.cam_front' : 'hikaye.cam_back')}`} style={[styles.flip, { backgroundColor: st.card, borderColor: st.line }]}>
          <Svg width={22} height={22} viewBox="0 0 256 256"><Path d={P_FLIP} fill={st.text} /></Svg>
        </Pressable>
      </View>

      <View accessibilityRole="tablist" accessibilityLabel={tr('hikaye.mode')} style={[styles.modes, { marginBottom: bottomPad }]}>
        {modes.map((m) => {
          const on = m === 'story';
          return (
            <Pressable
              key={m}
              onPress={() => onMode(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.modeBtn, { backgroundColor: on ? st.pill : 'transparent' }]}
              testID={`story-camera-mode-${m}`}
            >
              <Text style={[styles.modeT, { color: on ? st.text : st.sec, fontFamily: on ? fontFamily.bodyBold : fontFamily.bodySemibold }]}>
                {tr(m === 'post' ? 'hikaye.mode_post' : m === 'story' ? 'hikaye.mode_story' : 'hikaye.mode_reels')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  vf: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#000000' },
  denied: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  deniedT: { color: '#FFFFFF', fontFamily: fontFamily.headingBold, fontSize: 18, textAlign: 'center' },
  deniedB: { color: 'rgba(255,255,255,0.82)', fontFamily: fontFamily.bodyRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  deniedBtn: { marginTop: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  deniedBtnT: { color: '#0A0A0A', fontFamily: fontFamily.bodyBold, fontSize: 15 },
  gTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 140 },
  gBot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  hit44: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hit44c: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  om40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flashA: { position: 'absolute', right: 3, bottom: 2, color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 9 },
  tip: { position: 'absolute', alignSelf: 'center', top: 13, height: 30, paddingHorizontal: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5484D' },
  leftCol: { position: 'absolute', left: 6, top: 62, gap: 6 },
  sideBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  aa: { color: '#FFFFFF', fontFamily: fontFamily.headingBold, fontSize: 16 },
  sideLabel: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  sideLabelT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  zoomRow: { position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  zoomDot: { borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  zoomT: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  strip: { flexGrow: 0, marginTop: 10, height: 56 },
  stripRow: { gap: 8, paddingHorizontal: 16 },
  todayCard: { width: 64, height: 56, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  limeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LIME },
  todayT: { fontFamily: fontFamily.bodyBold, fontSize: 12 },
  shutRow: { marginTop: 10, height: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34 },
  galleryBox: { width: 40, height: 40, borderRadius: 10, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 64, height: 64, borderRadius: 32 },
  flip: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modes: { marginTop: 4, height: 44, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  modeBtn: { minWidth: 76, height: 44, borderRadius: 22, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  modeT: { fontSize: 14 },
});
