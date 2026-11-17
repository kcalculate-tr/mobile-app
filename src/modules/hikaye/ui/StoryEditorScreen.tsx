// G59-S1 — Hikâye düzenleyici (docs/g59/design/FinStoryEditor.dc.html; `state` = tools · text · draw · stickers ·
// placed · mealpick · kit). Tuval köşe 20, üst degrade %42. Araçlar sağda (etiket hapı + 40 om daire, 44 dokunma).
// KATMANLI: görüntü yakalanmaz; yazı / çizim yolları / çıkartmalar `overlays` olarak saklanır (overlays.ts).
// Kapsam dışı: müzik, bağlantı, soru, challenge, "Yakın arkadaşlar" (özellik yok), "Cihaza kaydet" (görüntü
// yakalama + medya kütüphanesi paketi yok) — LOG KARAR. Hareket: araç geçişi 220 ms solma, sayfa 550 ms enter,
// seçili katman 220 ms; Reduce Motion → 200 ms opaklık. Haptik: araç = seçim, Bitti = hafif, paylaş = başarı.
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { fontFamily, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useFeature } from '../../../core/flags';
import { useT } from '../../../core/i18n';
import { useAuth } from '../../../core/AuthContext';
import { useMealPhoto } from '../../gun/useMealPhoto';
import type { TodayConsumption } from '../../gun/todayConsumptions';
import type { RootStackParamList } from '../../../navigation/types';
import {
  STORY_BGS,
  STORY_COLORS,
  STORY_FONTS,
  bringToFront,
  colorHex,
  erasePaths,
  isLightColor,
  newOverlayId,
  nextZ,
} from '../overlays';
import { buildDayKit, loadDayKit, mealDataFrom, type DayKitData } from '../dayKit';
import { getStoryClient } from '../client';
import { publishStory } from '../publish';
import { useStoryTray } from '../store';
import type { DrawPath, StickerSkin, StoryAlign, StoryBrush, StoryColorId, StoryFont, StoryOverlay, TextData } from '../types';
import { CANVAS_W, LIME, LIME_INK, OM_BG, OM_SOLID, storyTheme } from './tokens';
import { StoryCanvas } from './StoryCanvas';
import { storyFontStyle } from './StorySticker';
import { EditableOverlay, type DragState } from './editor/EditableOverlay';
import { SizeSlider } from './editor/SizeSlider';
import { LabelSheet, MealPickSheet, P_CHART, P_PIN, StickersSheet, type KitTile, type LabelKind } from './editor/EditorSheets';
import { useReduceTransparency } from './a11y';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rp = RouteProp<RootStackParamList, 'StoryEditor'>;
type View_ = 'tools' | 'text' | 'draw' | 'stickers' | 'mealpick';

const P_X = 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';
const P_PENCIL = 'M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z';
const P_STICKER = 'M5 4h14a1 1 0 0 1 1 1v8.5L13.5 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M13 20v-5.5a1 1 0 0 1 1-1h6';
const P_UNDO = 'M232,200a8,8,0,0,1-16,0,88.1,88.1,0,0,0-88-88H51.31l34.35,34.34a8,8,0,0,1-11.32,11.32l-48-48a8,8,0,0,1,0-11.32l48-48A8,8,0,0,1,85.66,61.66L51.31,96H128A104.11,104.11,0,0,1,232,200Z';
const P_TRASH = 'M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z';
const P_PALETTE = 'M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89ZM84,168a12,12,0,1,1,12-12A12,12,0,0,1,84,168Zm0-56a12,12,0,1,1,12-12A12,12,0,0,1,84,112Zm44-24a12,12,0,1,1,12-12A12,12,0,0,1,128,88Zm44,24a12,12,0,1,1,12-12A12,12,0,0,1,172,112Z';
const BRUSHES: Array<{ id: StoryBrush; d: string }> = [
  { id: 'pen', d: 'M4 20l1.2-4.3L16 4.9a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L8.3 18.8Z M14.5 6.5l3 3' },
  { id: 'marker', d: 'M9 15l-4.5 4.5H9l1.5-1.5 M9 15l7.5-7.5 3 3L12 18Z M13.5 10.5l3 3' },
  { id: 'eraser', d: 'M8 20h12 M4.6 15.4 14 6l5 5-8.6 8.6a1.4 1.4 0 0 1-1 .4H8.4a1.4 1.4 0 0 1-1-.4l-2.8-2.8a1 1 0 0 1 0-1.4Z M9 11l5 5' },
];
const ALIGN_D: Record<StoryAlign, string> = {
  left: 'M4 6h16 M4 10h10 M4 14h16 M4 18h10',
  center: 'M4 6h16 M7 10h10 M4 14h16 M7 18h10',
  right: 'M4 6h16 M10 10h10 M4 14h16 M10 18h10',
};

function useKeyboardHeight(): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', (e) => setH(e.endCoordinates.height));
    const b = Keyboard.addListener('keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const c = Keyboard.addListener('keyboardWillHide', () => setH(0));
    const d = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => [a, b, c, d].forEach((s) => s.remove());
  }, []);
  return h;
}

function VideoBase({ uri }: { uri: string }) {
  // expo-video tembel (jest ortamında native yok → düz siyah).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ev = require('expo-video') as typeof import('expo-video');
  const player = ev.useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <ev.VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const emptyText = (): TextData => ({ text: '', font: 'modern', color: 'white', align: 'center', box: true });

/** YALNIZ __DEV__ vitrini: düzenleyici hâllerinin örnek katmanları (tasarım FinStoryEditor yerleşimi). */
function vitrinOverlays(state: string): StoryOverlay[] {
  const meal: StoryOverlay = {
    id: 'v-meal', kind: 'meal', x: 0.5, y: 0.5, scale: 1, rotation: -6, z: 2,
    data: { name: 'Somon kinoa kase', meal_type: 'lunch', kcal: 520, protein_g: 38, carbs_g: 52, fat_g: 16, image_url: null, show_macros: true, skin: 'light' },
  };
  const streak: StoryOverlay = { id: 'v-streak', kind: 'streak', x: 0.84, y: 0.21, scale: 1, rotation: 6, z: 1, data: { days: 7, skin: 'light' } };
  if (state === 'placed') return [streak, meal];
  if (state === 'draw') {
    const circle: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      circle.push(0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.14);
    }
    return [{ id: 'v-draw', kind: 'draw', x: 0.5, y: 0.5, scale: 1, rotation: 0, z: 0, data: { paths: [{ pts: circle, color: '#B9EF14', width: 10, brush: 'pen' }, { pts: [0.8, 0.78, 0.6, 0.65, 0.61, 0.69, 0.6, 0.65, 0.66, 0.66], color: '#B9EF14', width: 10, brush: 'pen' }] } }];
  }
  return [];
}

export default function StoryEditorScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Rp>();
  const p = route.params;
  const t = useTheme();
  const st = storyTheme(t.isDark);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const solid = useReduceTransparency();
  const om = solid ? OM_SOLID : OM_BG;
  const kb = useKeyboardHeight();
  const { user } = useAuth();
  const suTakibi = useFeature('su_takibi');
  const notePosted = useStoryTray((s) => s.notePosted);

  const vState = __DEV__ ? p.vitrinState : undefined;
  const [view, setView] = useState<View_>(p.preset === 'text' || vState === 'text' ? 'text' : vState === 'draw' ? 'draw' : vState === 'stickers' ? 'stickers' : vState === 'mealpick' ? 'mealpick' : 'tools');
  const [overlays, setOverlays] = useState<StoryOverlay[]>(() => (vState ? vitrinOverlays(vState) : []));
  const [selected, setSelected] = useState<string | null>(vState === 'placed' ? 'v-meal' : null);
  const [drag, setDrag] = useState<DragState | null>(vState === 'placed' ? { id: 'v-meal', overTrash: false, guideV: true, guideH: false } : null);
  const [bgIdx, setBgIdx] = useState(0);
  const [draft, setDraft] = useState<TextData>(() => (vState === 'text' ? { text: 'Koşu sonrası tabak', font: 'modern', color: 'white', align: 'center', box: true } : emptyText()));
  const [editTextId, setEditTextId] = useState<string | null>(null);
  const [brush, setBrush] = useState<StoryBrush>('pen');
  const [dcol, setDcol] = useState<StoryColorId>('lime');
  const [size, setSize] = useState(10);
  const [live, setLive] = useState<DrawPath | null>(null);
  const [label, setLabel] = useState<{ kind: LabelKind; editId: string | null; initial: { text?: string; question?: string; options?: string[] } | null } | null>(null);
  const [kit, setKit] = useState<DayKitData | null>(null);
  const [busy, setBusy] = useState<'idle' | 'sharing' | 'done' | 'pending'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const idem = useRef(`story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`).current;

  const topPad = Math.max(insets.top, 20);
  const bottomPad = Math.max(insets.bottom, 8);
  const cw = W;
  const ch = Math.max(420, H - topPad - 69 - bottomPad);
  const k = cw / CANVAS_W;

  const mealPhoto = useMealPhoto(p.mealPhotoPath ?? null);
  const mediaUri = p.mealPhotoPath ? (mealPhoto.status === 'ready' ? mealPhoto.uri : null) : p.mediaUri ?? null;
  const bg = p.mediaType === 'none' ? STORY_BGS[bgIdx % STORY_BGS.length] : null;

  useEffect(() => {
    let alive = true;
    loadDayKit(user?.id, { water: !!suTakibi })
      .then((d) => {
        if (!alive) return;
        setKit(d);
        if (p.preset === 'kit') setOverlays(buildDayKit(d));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const meals = kit?.meals ?? [];
  const matchMeal = p.mealId ? meals.find((m) => m.id === p.mealId) ?? null : null;
  const hasMealSticker = overlays.some((o) => o.kind === 'meal');

  // ── katman işlemleri ────────────────────────────────────────────────────────
  const update = useCallback((o: StoryOverlay) => setOverlays((list) => list.map((x) => (x.id === o.id ? o : x))), []);
  const remove = useCallback((id: string) => {
    setOverlays((list) => list.filter((x) => x.id !== id));
    setSelected(null);
  }, []);
  const select = useCallback((id: string) => {
    setSelected(id);
    setOverlays((list) => bringToFront(list, id));
  }, []);
  const add = useCallback((o: Omit<StoryOverlay, 'id' | 'z'> & { kind: StoryOverlay['kind'] }) => {
    const id = newOverlayId(o.kind);
    setOverlays((list) => [...list, { ...o, id, z: nextZ(list) } as StoryOverlay]);
    setSelected(id);
  }, []);

  const onTapOverlay = useCallback((o: StoryOverlay) => {
    if (o.kind === 'text') {
      setDraft(o.data);
      setEditTextId(o.id);
      setView('text');
    } else if (o.kind === 'location' || o.kind === 'mention' || o.kind === 'hashtag') {
      setLabel({ kind: o.kind, editId: o.id, initial: { text: o.data.text } });
    } else if (o.kind === 'poll') {
      setLabel({ kind: 'poll', editId: o.id, initial: { question: o.data.question, options: o.data.options } });
    }
  }, []);

  // ── metin ───────────────────────────────────────────────────────────────────
  const openText = () => {
    haptic('selection');
    setDraft(emptyText());
    setEditTextId(null);
    setView('text');
  };
  const finishText = () => {
    haptic('light');
    Keyboard.dismiss();
    const text = draft.text.trim() ? draft.text.slice(0, 200) : '';
    if (editTextId) {
      if (!text) remove(editTextId);
      else setOverlays((list) => list.map((x) => (x.id === editTextId && x.kind === 'text' ? { ...x, data: { ...draft, text } } : x)));
    } else if (text) {
      add({ kind: 'text', x: 0.5, y: 0.38, scale: 1, rotation: 0, data: { ...draft, text } } as never);
    }
    setEditTextId(null);
    setView('tools');
  };

  // ── çizim ───────────────────────────────────────────────────────────────────
  const liveRef = useRef<DrawPath | null>(null);
  const drawState = useRef({ brush, dcol, size });
  drawState.current = { brush, dcol, size };
  const commitPath = useCallback((path: DrawPath) => {
    setOverlays((list) => {
      const d = list.find((x) => x.kind === 'draw');
      if (d && d.kind === 'draw') return list.map((x) => (x.id === d.id ? ({ ...d, data: { paths: [...d.data.paths, path].slice(-60) } } as StoryOverlay) : x));
      return [...list, { id: newOverlayId('draw'), kind: 'draw', x: 0.5, y: 0.5, scale: 1, rotation: 0, z: nextZ(list), data: { paths: [path] } } as StoryOverlay];
    });
  }, []);
  const eraseAt = useCallback((x: number, y: number) => {
    const r = Math.max(0.02, (drawState.current.size * 1.5) / CANVAS_W);
    setOverlays((list) =>
      list
        .map((o) => (o.kind === 'draw' ? ({ ...o, data: { paths: erasePaths(o.data.paths, x, y, r) } } as StoryOverlay) : o))
        .filter((o) => o.kind !== 'draw' || o.data.paths.length > 0),
    );
  }, []);
  const drawResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const x = Math.min(1, Math.max(0, e.nativeEvent.locationX / cw));
          const y = Math.min(1, Math.max(0, e.nativeEvent.locationY / ch));
          const s = drawState.current;
          if (s.brush === 'eraser') {
            eraseAt(x, y);
            return;
          }
          liveRef.current = { pts: [x, y], color: colorHex(s.dcol), width: s.size, brush: s.brush === 'marker' ? 'marker' : 'pen' };
          setLive(liveRef.current);
        },
        onPanResponderMove: (e) => {
          const x = Math.min(1, Math.max(0, e.nativeEvent.locationX / cw));
          const y = Math.min(1, Math.max(0, e.nativeEvent.locationY / ch));
          if (drawState.current.brush === 'eraser') {
            eraseAt(x, y);
            return;
          }
          const cur = liveRef.current;
          if (!cur || cur.pts.length >= 800) return;
          const lx = cur.pts[cur.pts.length - 2];
          const ly = cur.pts[cur.pts.length - 1];
          if (Math.abs(lx - x) + Math.abs(ly - y) < 0.004) return;
          liveRef.current = { ...cur, pts: [...cur.pts, x, y] };
          setLive(liveRef.current);
        },
        onPanResponderRelease: () => {
          if (liveRef.current) commitPath(liveRef.current);
          liveRef.current = null;
          setLive(null);
        },
      }),
    [cw, ch, commitPath, eraseAt],
  );
  const undo = () => {
    haptic('selection');
    setOverlays((list) =>
      list
        .map((o) => (o.kind === 'draw' ? ({ ...o, data: { paths: o.data.paths.slice(0, -1) } } as StoryOverlay) : o))
        .filter((o) => o.kind !== 'draw' || o.data.paths.length > 0),
    );
  };

  // ── çıkartmalar ─────────────────────────────────────────────────────────────
  const tiles: KitTile[] = useMemo(() => {
    const out: KitTile[] = [];
    const base = { id: 'tile', x: 0.5, y: 0.5, scale: 1, rotation: 0, z: 0 };
    if (!kit) return out;
    if (kit.meals[0]) out.push({ kind: 'meal', label: tr('hikaye.k_meal'), sc: 0.64, w: 240, h: 118, preview: { ...base, kind: 'meal', data: mealDataFrom(kit.meals[0], 'light', true) } });
    if (kit.goal) out.push({ kind: 'ring', label: tr('hikaye.k_ring'), sc: 0.66, w: 150, h: 160, preview: { ...base, kind: 'ring', data: { kcal: Math.round(kit.kcal), goal: Math.round(kit.goal), skin: 'dark' } } });
    if (kit.streak) out.push({ kind: 'streak', label: tr('hikaye.k_streak'), sc: 0.95, w: 96, h: 106, preview: { ...base, kind: 'streak', data: { days: kit.streak, skin: 'light' } } });
    if (kit.waterMl != null) out.push({ kind: 'water', label: tr('hikaye.k_water'), sc: 0.95, w: 84, h: 106, preview: { ...base, kind: 'water', data: { ml: kit.waterMl, skin: 'glass' } } });
    if (kit.steps != null) out.push({ kind: 'steps', label: tr('hikaye.k_steps'), sc: 0.95, w: 96, h: 106, preview: { ...base, kind: 'steps', data: { steps: kit.steps, skin: 'glass' } } });
    out.push({ kind: 'poll', label: tr('hikaye.k_poll'), sc: 0.62, w: 250, h: 104, preview: { ...base, kind: 'poll', data: { question: tr('hikaye.poll_q_ph'), options: [tr('hikaye.poll_yes'), tr('hikaye.poll_no')], skin: 'light' } } });
    return out;
  }, [kit, tr]);

  const onTile = (tile: KitTile) => {
    if (tile.kind === 'meal') return setView('mealpick');
    if (tile.kind === 'poll') {
      setView('tools');
      return setLabel({ kind: 'poll', editId: null, initial: null });
    }
    const { id: _i, z: _z, ...rest } = tile.preview;
    add({ ...rest, x: 0.5, y: 0.42 } as never);
    setView('tools');
  };
  const onGeneric = (g: 'location' | 'mention' | 'poll' | 'time' | 'hashtag') => {
    setView('tools');
    if (g === 'time') {
      const d = new Date();
      add({ kind: 'time', x: 0.5, y: 0.3, scale: 1, rotation: 0, data: { text: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, skin: 'light' } } as never);
      return;
    }
    setLabel({ kind: g, editId: null, initial: null });
  };
  const onLabelDone = (v: { text?: string; question?: string; options?: string[] }) => {
    const l = label;
    setLabel(null);
    if (!l) return;
    if (l.editId) {
      setOverlays((list) =>
        list.map((x) => {
          if (x.id !== l.editId) return x;
          if (x.kind === 'poll') return { ...x, data: { ...x.data, question: v.question ?? x.data.question, options: v.options ?? x.data.options } };
          if (x.kind === 'location' || x.kind === 'mention' || x.kind === 'hashtag') return { ...x, data: { ...x.data, text: v.text ?? x.data.text } } as StoryOverlay;
          return x;
        }),
      );
      return;
    }
    if (l.kind === 'poll') add({ kind: 'poll', x: 0.5, y: 0.22, scale: 1, rotation: 0, data: { question: v.question ?? '', options: v.options ?? [], skin: 'light' } } as never);
    else {
      let text = v.text ?? '';
      if (l.kind === 'hashtag') text = `#${text.replace(/^#+/, '').replace(/\s+/g, '')}`;
      if (l.kind === 'mention') text = `@${text.replace(/^@+/, '').replace(/\s+/g, '')}`;
      const handle = l.kind === 'mention' ? text.slice(1).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || null : undefined;
      add({ kind: l.kind, x: 0.5, y: 0.3, scale: 1, rotation: 0, data: { text, skin: 'light', ...(l.kind === 'mention' ? { handle } : {}) } } as never);
    }
  };
  const onMealAdd = (m: TodayConsumption, skin: StickerSkin, macros: boolean) => {
    add({ kind: 'meal', x: 0.4, y: 0.5, scale: 1, rotation: -6, data: mealDataFrom(m, skin, macros) } as never);
    setView('tools');
  };

  // ── paylaş / kapat ─────────────────────────────────────────────────────────
  const dirty = overlays.length > 0 || p.mediaType !== 'none';
  const close = () => {
    if (!dirty || busy === 'sharing') return nav.goBack();
    Alert.alert(tr('hikaye.discard_title'), tr('hikaye.discard_body'), [
      { text: tr('hikaye.keep'), style: 'cancel' },
      { text: tr('hikaye.discard'), style: 'destructive', onPress: () => nav.goBack() },
    ]);
  };
  const share = async () => {
    if (busy === 'sharing' || !user?.id) return;
    if (p.mediaType === 'none' && overlays.length === 0) return;
    setErr(null);
    setBusy('sharing');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const media = require('../media') as typeof import('../media');
    const res = await publishStory({
      client: getStoryClient(),
      uploader: { photo: media.uploadStoryPhoto, video: media.uploadStoryVideo, mealPhoto: media.copyMealPhotoToStory },
      userId: user.id,
      media: {
        kind: p.mediaType,
        uri: p.mediaUri ?? null,
        width: p.width,
        height: p.height,
        durationMs: p.durationMs,
        fileSizeBytes: p.fileSizeBytes,
        mimeType: p.mimeType,
        mealPhotoPath: p.mealPhotoPath ?? null,
      },
      overlays,
      bg,
      idempotencyKey: idem,
    });
    if (!res.ok) {
      setBusy('idle');
      setErr(tr(res.reason === 'rate_limited' ? 'hikaye.rate_limited' : 'hikaye.share_failed'));
      haptic('warning');
      return;
    }
    haptic('success');
    setBusy(res.status === 'pending' ? 'pending' : 'done');
    notePosted();
    setTimeout(() => nav.goBack(), 900);
  };

  // ── çizim ───────────────────────────────────────────────────────────────────
  const sheetOpen = view === 'stickers' || view === 'mealpick' || !!label;
  const showToolbar = view === 'tools' && !drag;
  const placed = !!drag;
  const shareDisabled = busy === 'sharing' || (p.mediaType === 'none' && overlays.length === 0);
  const textStyle = storyFontStyle(draft.font);
  const textHex = colorHex(draft.color);
  const tools = [
    { id: 'text', label: tr('hikaye.t_text'), glyph: 'Aa', onPress: openText },
    { id: 'draw', label: tr('hikaye.t_draw'), d: P_PENCIL, vb: 256, onPress: () => { haptic('selection'); setSelected(null); setView('draw'); } },
    { id: 'sticker', label: tr('hikaye.t_sticker'), d: P_STICKER, vb: 24, stroke: true, onPress: () => { haptic('selection'); setView('stickers'); } },
    { id: 'mention', label: tr('hikaye.t_mention'), glyph: '@', onPress: () => { haptic('selection'); setLabel({ kind: 'mention', editId: null, initial: null }); } },
    { id: 'place', label: tr('hikaye.t_place'), d: P_PIN, vb: 256, onPress: () => { haptic('selection'); setLabel({ kind: 'location', editId: null, initial: null }); } },
    { id: 'poll', label: tr('hikaye.t_poll'), d: P_CHART, vb: 256, onPress: () => { haptic('selection'); setLabel({ kind: 'poll', editId: null, initial: null }); } },
  ];

  return (
    <View style={[styles.root, { backgroundColor: st.bg, paddingTop: topPad }]} testID="story-editor">
      <View style={[styles.canvasWrap, { width: cw, height: ch }]} accessibilityLabel={tr('hikaye.canvas')} importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}>
        <StoryCanvas
          w={cw}
          h={ch}
          mediaUri={mediaUri}
          mediaType={p.mediaType}
          bg={bg}
          overlays={view === 'text' && editTextId ? overlays.filter((o) => o.id !== editTextId) : overlays}
          media={p.mediaType === 'video' && p.mediaUri ? <VideoBase uri={p.mediaUri} /> : undefined}
          reduceTransparency={solid}
          liveDraw={live}
          renderOverlay={(o, node) => (
            <EditableOverlay
              key={o.id}
              overlay={o}
              w={cw}
              h={ch}
              selected={selected === o.id && view === 'tools'}
              enabled={view === 'tools'}
              label={tr('hikaye.sticker_a11y', { name: o.kind === 'text' ? o.data.text : tr(`hikaye.k_${o.kind === 'meal' ? 'meal' : o.kind === 'ring' ? 'ring' : o.kind === 'streak' ? 'streak' : o.kind === 'water' ? 'water' : o.kind === 'poll' ? 'poll' : 'meal'}`) })}
              onChange={update}
              onDragState={setDrag}
              onDelete={remove}
              onTap={onTapOverlay}
              onSelect={select}
            >
              {node}
            </EditableOverlay>
          )}
          testID="story-editor-canvas"
        >
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0)']} style={styles.gTop} />
          {view === 'tools' && !drag ? (
            <Pressable style={[StyleSheet.absoluteFill, { zIndex: -1 }]} onPress={() => setSelected(null)} accessible={false} />
          ) : null}

          {placed ? (
            <>
              {drag?.guideV ? <View pointerEvents="none" style={[styles.guideV, { left: cw / 2, borderColor: LIME }]} /> : null}
              {drag?.guideH ? <View pointerEvents="none" style={[styles.guideH, { top: ch / 2, borderColor: LIME }]} /> : null}
              <View pointerEvents="none" style={[styles.hintPill, { backgroundColor: om }]}>
                <Text style={styles.hintT}>{tr('hikaye.pinch_hint')}</Text>
              </View>
              <View pointerEvents="none" style={styles.trashWrap}>
                <View style={[styles.smallPill, { backgroundColor: om }]}><Text style={styles.smallPillT}>{tr('hikaye.drag_delete')}</Text></View>
                <View accessibilityLabel={tr('hikaye.trash')} style={[styles.trash, { backgroundColor: drag?.overTrash ? '#E5484D' : om, transform: [{ scale: drag?.overTrash ? 1.12 : 1 }] }]}>
                  <Svg width={24} height={24} viewBox="0 0 256 256"><Path d={P_TRASH} fill="#FFFFFF" /></Svg>
                </View>
              </View>
            </>
          ) : null}

          {view === 'tools' && matchMeal && !hasMealSticker && !drag ? (
            <Animated.View entering={reduced ? undefined : FadeIn.duration(220)} style={[styles.match, { backgroundColor: om }]}>
              <View style={styles.matchThumb}><Svg width={22} height={22} viewBox="0 0 24 24"><Path d={P_STICKER} stroke="#FFFFFF" strokeWidth={1.8} fill="none" /></Svg></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.matchSub} numberOfLines={1}>{tr('hikaye.match_sub', { meal: tr(`hikaye.${matchMeal.meal_type === 'breakfast' ? 'breakfast' : matchMeal.meal_type === 'dinner' ? 'dinner' : matchMeal.meal_type === 'snack' ? 'snack' : 'lunch'}`).toLocaleLowerCase('tr-TR') })}</Text>
                <Text style={styles.matchName} numberOfLines={2}>{matchMeal.name}</Text>
              </View>
              <Pressable onPress={() => setView('mealpick')} accessibilityRole="button" style={styles.matchBtn} testID="story-editor-match">
                <Text style={styles.matchBtnT}>{tr('hikaye.add_meal_sticker')}</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {(view === 'tools' || view === 'stickers' || view === 'mealpick') && !drag ? (
            <>
              {p.mediaType === 'none' ? (
                <Pressable onPress={() => { haptic('selection'); setBgIdx((i) => i + 1); }} accessibilityRole="button" accessibilityLabel={tr('hikaye.bg_next')} style={[styles.hit44, { left: 6, top: 6 }]} testID="story-editor-bg">
                  <View style={[styles.om40, { backgroundColor: om }]}><Svg width={20} height={20} viewBox="0 0 256 256"><Path d={P_PALETTE} fill="#FFFFFF" /></Svg></View>
                </Pressable>
              ) : null}
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={tr('hikaye.close')} style={[styles.hit44, { right: 6, top: 6 }]} testID="story-editor-close">
                <View style={[styles.om40, { backgroundColor: om }]}><Svg width={20} height={20} viewBox="0 0 256 256"><Path d={P_X} fill="#FFFFFF" /></Svg></View>
              </Pressable>
              {showToolbar ? (
                <View accessibilityRole="toolbar" accessibilityLabel={tr('hikaye.tools')} style={styles.toolbar}>
                  {tools.map((tl) => (
                    <Pressable key={tl.id} onPress={tl.onPress} accessibilityRole="button" accessibilityLabel={tl.label} style={styles.toolBtn} testID={`story-tool-${tl.id}`}>
                      <View style={[styles.toolLabel, { backgroundColor: om }]}><Text style={styles.toolLabelT}>{tl.label}</Text></View>
                      <View style={[styles.om40, { backgroundColor: om, margin: 2 }]}>
                        {tl.glyph ? (
                          <Text style={styles.glyph}>{tl.glyph}</Text>
                        ) : (
                          <Svg width={20} height={20} viewBox={`0 0 ${tl.vb} ${tl.vb}`}>
                            <Path d={tl.d!} fill={tl.stroke ? 'none' : '#FFFFFF'} stroke={tl.stroke ? '#FFFFFF' : undefined} strokeWidth={tl.stroke ? 1.8 : undefined} strokeLinejoin="round" />
                          </Svg>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {view === 'draw' ? (
            <>
              <View style={StyleSheet.absoluteFill} {...drawResponder.panHandlers} accessibilityLabel={tr('hikaye.drawing_a11y')} testID="story-draw-surface" />
              <View style={styles.topBar}>
                <Pressable onPress={undo} accessibilityRole="button" accessibilityLabel={tr('hikaye.undo')} style={styles.hit44c}>
                  <View style={[styles.om40, { backgroundColor: om }]}><Svg width={20} height={20} viewBox="0 0 256 256"><Path d={P_UNDO} fill="#FFFFFF" /></Svg></View>
                </Pressable>
                <View accessibilityRole="radiogroup" accessibilityLabel={tr('hikaye.brush')} style={[styles.brushes, { backgroundColor: om }]}>
                  {BRUSHES.map((b) => {
                    const on = brush === b.id;
                    return (
                      <Pressable key={b.id} onPress={() => { haptic('selection'); setBrush(b.id); }} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={tr(`hikaye.${b.id}`)} style={styles.hit44c}>
                        <View style={[styles.brushIn, { backgroundColor: on ? '#FFFFFF' : 'transparent' }]}>
                          <Svg width={20} height={20} viewBox="0 0 24 24"><Path d={b.d} fill="none" stroke={on ? '#0A0A0A' : '#FFFFFF'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable onPress={() => { haptic('light'); setView('tools'); }} accessibilityRole="button" style={styles.doneBtn} testID="story-draw-done">
                  <Text style={styles.doneT}>{tr('hikaye.done')}</Text>
                </Pressable>
              </View>
              <View pointerEvents="none" style={[styles.brushName, { backgroundColor: om }]}><Text style={styles.hintT}>{tr(`hikaye.${brush}`)}</Text></View>
            </>
          ) : null}

          {view === 'text' ? (
            <>
              <Animated.View entering={reduced ? undefined : FadeIn.duration(220)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
              <View style={styles.topBar}>
                <Pressable onPress={() => { haptic('selection'); setDraft((d) => ({ ...d, align: d.align === 'center' ? 'left' : d.align === 'left' ? 'right' : 'center' })); }} accessibilityRole="button" accessibilityLabel={tr('hikaye.align_a11y', { a: tr(draft.align === 'left' ? 'hikaye.a_left' : draft.align === 'right' ? 'hikaye.a_right' : 'hikaye.a_center') })} style={styles.hit44c}>
                  <View style={[styles.om40, { backgroundColor: om }]}><Svg width={20} height={20} viewBox="0 0 24 24"><Path d={ALIGN_D[draft.align]} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" /></Svg></View>
                </Pressable>
                <Pressable onPress={() => { haptic('selection'); setDraft((d) => ({ ...d, box: !d.box })); }} accessibilityRole="switch" accessibilityState={{ checked: draft.box }} accessibilityLabel={tr('hikaye.text_bg')} style={styles.hit44c}>
                  <View style={[styles.om40, { backgroundColor: om }]}>
                    <View style={[styles.boxIcon, { backgroundColor: draft.box ? '#FFFFFF' : 'transparent' }]}><Text style={[styles.boxIconT, { color: draft.box ? '#0A0A0A' : '#FFFFFF' }]}>A</Text></View>
                  </View>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={finishText} accessibilityRole="button" style={styles.doneBtn} testID="story-text-done">
                  <Text style={styles.doneT}>{tr('hikaye.done')}</Text>
                </Pressable>
              </View>
              <View style={[styles.textArea, { top: Math.round(ch * 0.26), justifyContent: 'center', alignItems: draft.align === 'left' ? 'flex-start' : draft.align === 'right' ? 'flex-end' : 'center' }]}>
                <TextInput
                  autoFocus
                  multiline
                  value={draft.text}
                  onChangeText={(v) => setDraft((d) => ({ ...d, text: v.slice(0, 200) }))}
                  placeholder={tr('hikaye.text_ph')}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  selectionColor={LIME}
                  accessibilityLabel={tr('hikaye.t_text')}
                  allowFontScaling={false}
                  testID="story-text-input"
                  style={{
                    maxWidth: cw - 48,
                    fontSize: 32 * Math.min(1, k * 1.02),
                    lineHeight: 37 * Math.min(1, k * 1.02),
                    fontFamily: textStyle.fontFamily,
                    fontWeight: textStyle.fontWeight,
                    letterSpacing: textStyle.letterSpacing ?? 0,
                    textAlign: draft.align,
                    color: draft.box ? (isLightColor(draft.color) ? '#0A0A0A' : '#FFFFFF') : textHex,
                    backgroundColor: draft.box ? textHex : 'transparent',
                    paddingHorizontal: draft.box ? 12 : 0,
                    paddingVertical: draft.box ? 6 : 0,
                    borderRadius: 12,
                    textTransform: textStyle.upper ? 'uppercase' : 'none',
                  }}
                />
              </View>
            </>
          ) : null}
        </StoryCanvas>
      </View>

      {view === 'text' ? (
        <View style={[styles.textRows, { bottom: kb > 0 ? kb + 8 : bottomPad + 8 }]}>
          <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" accessibilityRole="radiogroup" accessibilityLabel={tr('hikaye.colours')} contentContainerStyle={styles.colRow}>
            {STORY_COLORS.map((c) => {
              const on = draft.color === c.id;
              return (
                <Pressable key={c.id} onPress={() => { haptic('selection'); setDraft((d) => ({ ...d, color: c.id })); }} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={tr(`hikaye.c_${c.id}`)} style={styles.hit44c}>
                  <View style={{ width: on ? 30 : 24, height: on ? 30 : 24, borderRadius: 15, backgroundColor: c.hex, borderWidth: 2, borderColor: '#FFFFFF' }} />
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" accessibilityRole="radiogroup" accessibilityLabel={tr('hikaye.fonts')} contentContainerStyle={styles.fontRow}>
            {STORY_FONTS.map((f: StoryFont) => {
              const on = draft.font === f;
              const fs = storyFontStyle(f);
              return (
                <Pressable key={f} onPress={() => { haptic('selection'); setDraft((d) => ({ ...d, font: f })); }} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.fontBtn, { backgroundColor: on ? '#FFFFFF' : 'rgba(0,0,0,0.5)' }]}>
                  <Text style={{ fontSize: 15, fontFamily: fs.fontFamily, fontWeight: fs.fontWeight, letterSpacing: fs.letterSpacing ?? 0, color: on ? '#0A0A0A' : '#FFFFFF' }}>{tr(`hikaye.f_${f}`)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : view === 'draw' ? (
        <View style={[styles.below, { paddingTop: 4, paddingHorizontal: 12 }]}>
          <View style={styles.sizeRow}>
            <Text style={[styles.sizeL, { color: st.sec }]}>{tr('hikaye.size')}</Text>
            <SizeSlider value={size} onChange={setSize} track={st.line2} label={tr('hikaye.size')} valueText={tr('hikaye.size_pt', { n: size })} />
            <Text style={[styles.sizeV, { color: st.text }]}>{tr('hikaye.size_pt', { n: size })}</Text>
          </View>
          <ScrollView {...SCROLL_KEYBOARD} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={tr('hikaye.colours')}>
            {STORY_COLORS.map((c) => {
              const on = dcol === c.id;
              return (
                <Pressable key={c.id} onPress={() => { haptic('selection'); setDcol(c.id); }} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={tr(`hikaye.c_${c.id}`)} style={styles.hit44c}>
                  <View style={{ width: on ? 30 : 24, height: on ? 30 : 24, borderRadius: 15, backgroundColor: c.hex, borderWidth: 2, borderColor: st.card }} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={[styles.below, styles.shareRow, { opacity: placed ? 0.35 : 1 }]} importantForAccessibility={placed || sheetOpen ? 'no-hide-descendants' : 'auto'}>
          {err ? <Text accessibilityLiveRegion="assertive" style={[styles.err, { color: st.danger }]} numberOfLines={2}>{err}</Text> : null}
          <Pressable
            onPress={() => void share()}
            disabled={shareDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: shareDisabled, busy: busy === 'sharing' }}
            style={[styles.shareBtn, { backgroundColor: busy === 'done' || busy === 'pending' ? LIME : st.card, borderColor: st.line, opacity: shareDisabled && busy !== 'sharing' ? 0.5 : 1 }]}
            testID="story-editor-share"
          >
            <View style={[styles.shareAva, { backgroundColor: busy === 'done' || busy === 'pending' ? LIME_INK : st.ph }]} />
            <Text style={[styles.shareT, { color: busy === 'done' || busy === 'pending' ? LIME_INK : st.text }]} numberOfLines={2}>
              {busy === 'sharing' ? tr('hikaye.sharing') : busy === 'done' ? tr('hikaye.shared') : busy === 'pending' ? tr('hikaye.shared_pending') : tr('hikaye.your_story_add')}
            </Text>
          </Pressable>
        </View>
      )}

      <StickersSheet visible={view === 'stickers'} onClose={() => setView('tools')} tiles={tiles} onGeneric={onGeneric} onTile={onTile} />
      <MealPickSheet visible={view === 'mealpick'} onClose={() => setView('tools')} meals={meals} initialId={p.mealId ?? null} previewUri={mediaUri} onAdd={onMealAdd} />
      <LabelSheet kind={label?.kind ?? null} initial={label?.initial ?? null} onClose={() => setLabel(null)} onDone={onLabelDone} />
      {mediaUri && p.mediaType === 'image' ? <Image source={{ uri: mediaUri }} style={styles.prefetch} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvasWrap: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#000000' },
  gTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 130 },
  hit44: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hit44c: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  om40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toolbar: { position: 'absolute', right: 6, top: 58, alignItems: 'flex-end', gap: 2 },
  toolBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolLabel: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  toolLabelT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  glyph: { color: '#FFFFFF', fontFamily: fontFamily.headingBold, fontSize: 17 },
  topBar: { position: 'absolute', left: 6, right: 6, top: 6, height: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  brushes: { marginHorizontal: 'auto', height: 44, borderRadius: 22, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center' },
  brushIn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  doneBtn: { minHeight: 44, borderRadius: 22, backgroundColor: '#FFFFFF', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  doneT: { color: '#0A0A0A', fontFamily: fontFamily.bodyBold, fontSize: 15 },
  brushName: { position: 'absolute', alignSelf: 'center', bottom: 14, height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center' },
  hintPill: { position: 'absolute', alignSelf: 'center', top: 14, height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center' },
  hintT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 13 },
  trashWrap: { position: 'absolute', left: 0, right: 0, bottom: 22, alignItems: 'center', gap: 8 },
  smallPill: { height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center' },
  smallPillT: { color: '#FFFFFF', fontFamily: fontFamily.bodySemibold, fontSize: 12 },
  trash: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  guideV: { position: 'absolute', top: 0, bottom: 0, width: 0, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  guideH: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  match: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 72, borderRadius: 22, paddingVertical: 10, paddingLeft: 12, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  matchThumb: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  matchSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fontFamily.bodySemibold, fontSize: 12 },
  matchName: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 14, lineHeight: 17 },
  matchBtn: { minHeight: 44, borderRadius: 22, backgroundColor: LIME, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  matchBtnT: { color: LIME_INK, fontFamily: fontFamily.bodyBold, fontSize: 14 },
  boxIcon: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  boxIconT: { fontFamily: fontFamily.headingBold, fontSize: 13 },
  textArea: { position: 'absolute', left: 24, right: 24, minHeight: 120 },
  textRows: { position: 'absolute', left: 0, right: 0, gap: 8 },
  colRow: { paddingHorizontal: 12, gap: 2 },
  fontRow: { paddingHorizontal: 12, gap: 8 },
  fontBtn: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  below: { flex: 1 },
  shareRow: { paddingTop: 12, paddingHorizontal: 16, gap: 6 },
  shareBtn: { minHeight: 52, borderRadius: 26, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  shareAva: { width: 26, height: 26, borderRadius: 13 },
  shareT: { fontFamily: fontFamily.bodyBold, fontSize: 14, flexShrink: 1, textAlign: 'center' },
  err: { fontFamily: fontFamily.bodySemibold, fontSize: 13, textAlign: 'center' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  sizeL: { fontFamily: fontFamily.bodyBold, fontSize: 13 },
  sizeV: { width: 44, textAlign: 'right', fontFamily: fontFamily.bodyBold, fontSize: 13 },
  prefetch: { width: 1, height: 1, position: 'absolute', opacity: 0 },
});
