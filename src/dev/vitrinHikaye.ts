// G59-S1 — Hikâye vitrini (YALNIZ __DEV__; üretimde hiç yüklenmez): bellek içi hikâye dünyası (örnek kişiler,
// katmanlı hikâyeler, görüntülenmeler/tepkiler, öne çıkanlar) + bugünün öğünleri. Görseller tasarımın yer tutucu
// fotoğrafları (src/dev/assets). Gerçek veri / ağ YOK.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VITRIN_PHOTO } from './vitrinKesfet';
import type { StoryOverlay } from '../modules/hikaye/types';

export async function prepareHikayeScene(opts: { scene: string; en: boolean }): Promise<void> {
  const { createMockStoryClient, emptyWorld, seedStory } = require('../modules/hikaye/mock') as typeof import('../modules/hikaye/mock');
  const { setStoryClient } = require('../modules/hikaye/client') as typeof import('../modules/hikaye/client');
  const { useStoryTray } = require('../modules/hikaye/store') as typeof import('../modules/hikaye/store');
  const { setTodayConsumptionsProvider } = require('../modules/gun/todayConsumptions') as typeof import('../modules/gun/todayConsumptions');
  const en = opts.en;
  const now = Date.now();
  // Vitrin oturumu (VitrinGate) kimliği = "ben" → profil halkası ve öne çıkanlar eşleşir.
  const ME = '00000000-0000-4000-8000-00000000a14e';
  const W = emptyWorld(ME, now);
  W.users = [
    { id: ME, name: 'Deniz Kaya', handle: 'deniz' },
    { id: 'ayse', name: 'Ayşe K.', handle: 'aysek' },
    { id: 'mert', name: 'Mert', handle: 'mertfit' },
    { id: 'elif', name: 'Dyt. Elif', handle: 'dyt.elif' },
    { id: 'kcal', name: 'Kcalculate', handle: 'kcalculate', official: true },
    { id: 'can', name: 'Can', handle: 'canrun' },
  ];
  W.follows.push([ME, 'ayse'], [ME, 'mert'], [ME, 'elif'], [ME, 'can']);
  const meal = (id: string, name: string, kcal: number, p: number, c: number, f: number, x = 0.36, y = 0.3, r = -4): StoryOverlay => ({
    id, kind: 'meal', x, y, scale: 1, rotation: r, z: 1,
    data: { name, meal_type: 'lunch', kcal, protein_g: p, carbs_g: c, fat_g: f, image_url: VITRIN_PHOTO.thTavukKinoa, show_macros: true, skin: 'light' },
  });
  const poll: StoryOverlay = {
    id: 'p1', kind: 'poll', x: 0.5, y: 0.72, scale: 1, rotation: 3, z: 2,
    data: { question: en ? 'Did you meal prep today?' : 'Bugün meal prep yaptın mı?', options: en ? ['Yes', 'No'] : ['Evet', 'Hayır'], skin: 'light' },
  };
  const salmon = en ? 'Salmon quinoa bowl' : 'Somon kinoa kase';
  seedStory(W, { id: 'ay1', author_id: 'ayse', media_url: VITRIN_PHOTO.tavukKinoa }, 5);
  seedStory(W, { id: 'ay2', author_id: 'ayse', media_url: VITRIN_PHOTO.somon, overlays: [meal('m1', salmon, 520, 38, 52, 16), poll] }, 3);
  seedStory(W, { id: 'ay3', author_id: 'ayse', media_url: VITRIN_PHOTO.coban }, 1);
  seedStory(W, { id: 'me1', author_id: ME, media_url: VITRIN_PHOTO.somon, overlays: [meal('m2', salmon, 520, 38, 52, 16, 0.42, 0.34, -6), { id: 't1', kind: 'text', x: 0.5, y: 0.14, scale: 1, rotation: 0, z: 3, data: { text: en ? 'Post-run plate' : 'Koşu sonrası tabak', font: 'bold', color: 'white', align: 'center', box: false } }] }, 2);
  seedStory(W, { id: 'mert1', author_id: 'mert', media_url: VITRIN_PHOTO.menemen }, 4);
  seedStory(W, { id: 'elif1', author_id: 'elif', media_url: VITRIN_PHOTO.mercimek }, 6);
  seedStory(W, { id: 'kcal1', author_id: 'kcal', media_type: 'none', media_url: null, bg: { kind: 'gradient', colors: ['#1E3A2A', '#0A0A0A'] }, overlays: [{ id: 'r1', kind: 'ring', x: 0.5, y: 0.42, scale: 1.4, rotation: 0, z: 1, data: { kcal: 1480, goal: 2100, skin: 'dark' } }] }, 2);
  seedStory(W, { id: 'can1', author_id: 'can', media_url: VITRIN_PHOTO.yogurt }, 8);
  // Arşiv (öne çıkanlar için): 24 saati dolmuş kendi hikâyelerim.
  seedStory(W, { id: 'old1', author_id: ME, media_url: VITRIN_PHOTO.tavukKinoa }, 40);
  seedStory(W, { id: 'old2', author_id: ME, media_url: VITRIN_PHOTO.coban }, 70);
  seedStory(W, { id: 'old3', author_id: ME, media_url: VITRIN_PHOTO.mercimek }, 100);
  seedStory(W, { id: 'old4', author_id: ME, media_url: VITRIN_PHOTO.yogurt }, 130);
  seedStory(W, { id: 'old5', author_id: ME, media_url: VITRIN_PHOTO.menemen }, 160);
  W.highlights.push(
    { id: 'hl1', owner: ME, title: 'Meal prep', cover: 'old1', sort: 0, items: ['old1', 'old2', 'old4'] },
    { id: 'hl2', owner: ME, title: en ? 'Running' : 'Koşu', cover: 'old3', sort: 1, items: ['old3'] },
    { id: 'hl3', owner: ME, title: en ? 'Recipes' : 'Tarifler', cover: 'old5', sort: 2, items: ['old5'] },
  );
  const at = (m: number) => new Date(now - m * 60_000).toISOString();
  // Görülmüş: Elif ve Can; Ayşe'nin ilki görülmüş (ikincisinden açılır).
  W.views.push({ story: 'elif1', viewer: ME, at: at(30) }, { story: 'can1', viewer: ME, at: at(40) }, { story: 'ay1', viewer: ME, at: at(50) });
  if (opts.scene !== 'g59ViewersEmpty') {
    for (const [u, m] of [['ayse', 5], ['mert', 12], ['elif', 20], ['can', 33], ['kcal', 41]] as const) W.views.push({ story: 'me1', viewer: u, at: at(m) });
    W.reactions.push({ story: 'me1', user: 'ayse', kind: 'like', at: at(5) }, { story: 'me1', user: 'mert', kind: 'congrats', at: at(11) }, { story: 'me1', user: 'elif', kind: 'like', at: at(19) }, { story: 'me1', user: 'elif', kind: 'recipe', at: at(19) });
    W.events.push({ story: 'me1', sticker: 'm2', user: 'ayse', action: 'tap' }, { story: 'me1', sticker: 'm2', user: 'mert', action: 'tap' }, { story: 'me1', sticker: 'm2', user: 'mert', action: 'add_log' });
  } else {
    W.stories = W.stories.map((s) => (s.id === 'me1' ? { ...s, created_at: new Date(now - 2 * 3_600_000).toISOString() } : s));
  }
  W.votes.push({ story: 'ay2', sticker: 'p1', user: 'mert', option: 0 }, { story: 'ay2', sticker: 'p1', user: 'can', option: 0 }, { story: 'ay2', sticker: 'p1', user: 'elif', option: 1 });
  setStoryClient(createMockStoryClient(W));
  await useStoryTray.getState().refresh();

  setTodayConsumptionsProvider(async () => [
    { id: 'mc1', name: en ? 'Yogurt bowl' : 'Yoğurt kase', meal_type: 'breakfast', kcal: 320, consumed_at: at(300), protein_g: 18, carbs_g: 36, fat_g: 9, photo_url: null },
    { id: 'mc2', name: salmon, meal_type: 'lunch', kcal: 520, consumed_at: at(90), protein_g: 38, carbs_g: 52, fat_g: 16, photo_url: null },
    { id: 'mc3', name: en ? 'Shepherd’s salad' : 'Çoban salata', meal_type: 'snack', kcal: 140, consumed_at: at(40), protein_g: 3, carbs_g: 12, fat_g: 9, photo_url: null },
  ]);
  await AsyncStorage.setItem('@kcal_story_coach_seen', opts.scene === 'g59Coach' ? '0' : '1');
}
