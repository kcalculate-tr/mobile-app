// G63-S1 — Mesajlar vitrini (YALNIZ __DEV__; üretimde hiç yüklenmez): bellek içi DM dünyası (createMockDm) —
// tasarımdaki örnek sohbetler / istekler / öneriler. Gerçek veri / ağ YOK. Sahne adı = pano hâli.
const ME = '00000000-0000-4000-8000-00000000a14e';

export async function prepareMesajlarScene(opts: { scene: string; en: boolean }): Promise<void> {
  const { createMockDm } = require('../modules/mesajlar/mock') as typeof import('../modules/mesajlar/mock');
  const { setDmClient } = require('../modules/mesajlar/client') as typeof import('../modules/mesajlar/client');
  const { useDmBadge } = require('../modules/mesajlar/store') as typeof import('../modules/mesajlar/store');
  const en = opts.en;
  const s = opts.scene;
  const now = Date.now();
  const MIN = 60_000;
  const people = [
    { id: ME, name: 'Deniz Kaya', handle: 'deniz' },
    { id: 'ayse', name: 'Ayşe K.', handle: 'aysek' },
    { id: 'elif', name: 'Elif Tan', handle: 'dyt.elif', role: 'diyetisyen' },
    { id: 'zeynep', name: 'Zeynep Arslan', handle: 'zeynepfit' },
    { id: 'mert', name: 'Mert', handle: 'mertfit' },
    { id: 'can', name: 'Can', handle: 'canrun' },
    { id: 'selin', name: 'Selin', handle: 'selinyogi' },
    { id: 'emre', name: 'Emre', handle: 'emre.k' },
    { id: 'burak', name: 'Burak', handle: 'burakkosar' },
    { id: 'ece', name: 'Ece', handle: 'ecemealprep' },
    { id: 'elif2', name: 'Dyt. Elif Yıldız', handle: 'dytelifyildiz', role: 'diyetisyen' },
  ];
  const dm = createMockDm({
    me: ME,
    people,
    follows: [
      [ME, 'ayse'], ['ayse', ME], [ME, 'elif'], ['elif', ME], [ME, 'zeynep'], ['zeynep', ME], [ME, 'mert'], ['mert', ME],
      [ME, 'can'], ['can', ME], [ME, 'selin'], ['selin', ME], ['emre', ME], [ME, 'elif2'],
    ],
    now: () => Date.now(),
    blockedWords: ['yasakli'],
  });
  const T = (tr: string, enS: string) => (en ? enS : tr);
  const empty = s === 'chatsEmpty' || s === 'requestsEmpty';

  if (!empty) {
    dm.seed({ id: 'c-ayse', with: 'ayse', messages: [{ from: 'them', body: T('Tarifi denedim, çok iyi oldu', 'Tried the recipe, it turned out great'), at: now - 4 * MIN }] });
    dm.seed({ id: 'c-elif', with: 'elif', myRead: now, messages: [{ from: 'me', body: T('Perşembe soru-cevapta görüşürüz', 'See you at Thursday’s Q&A'), at: now - 2 * 60 * MIN }] });
    dm.seed({ id: 'c-zeynep', with: 'zeynep', muted: true, myRead: now, messages: [{ from: 'them', body: null, kind: 'post', ref: { post_id: '00000000-0000-4000-8000-0000000000p1' }, at: now - 3 * 60 * MIN }] });
    dm.seed({ id: 'c-mert', with: 'mert', messages: [{ from: 'them', body: T('Fotoğraf', 'Photo'), at: now - 26 * 60 * MIN }] });
    dm.seed({ id: 'c-can', with: 'can', myRead: now, messages: [{ from: 'them', body: T('Cumartesi Kordon koşusuna geliyor musun?', 'Coming to the Kordon run on Saturday?'), at: now - 3 * 24 * 60 * MIN }] });
    dm.seed({ id: 'c-selin', with: 'selin', myRead: now, messages: [{ from: 'me', body: T('Haftaya meal prep atölyesi var', 'There’s a meal prep workshop next week'), at: now - 4 * 24 * 60 * MIN }] });
    // İstekler (takip etmediğim kişiler).
    dm.seed({ id: 'r-burak', with: 'burak', myState: 'request', messages: [{ from: 'them', body: T('Merhaba, meal prep kutularını nereden alıyorsun?', 'Hi, where do you get your meal prep boxes?'), at: now - 6 * MIN }, { from: 'them', body: T('Pazar atölyesinde görüşelim mi?', 'Shall we meet at the Sunday workshop?'), at: now - 5 * MIN }] });
    dm.seed({ id: 'r-ece', with: 'ece', myState: 'request', messages: [{ from: 'them', body: T('Pazar atölyesine sen de katılıyor musun?', 'Are you joining the Sunday workshop too?'), at: now - 2 * 60 * MIN }] });
    dm.seed({ id: 'r-emre', with: 'emre', myState: 'request', messages: [{ from: 'them', body: T('Koşu sonrası tabağın çok iyi görünüyordu, indirim için www.ornek-kupon.com', 'Your post-run plate looked great, discount at www.example-coupon.com'), at: now - 2 * 24 * 60 * MIN }] });
  }
  if (s === 'requestsEmpty') {
    dm.seed({ id: 'c-ayse', with: 'ayse', myRead: now, messages: [{ from: 'them', body: T('Tarifi denedim, çok iyi oldu', 'Tried the recipe, it turned out great'), at: now - 4 * MIN }] });
  }

  // Sohbet (FinChat `chat`): tarif yerine öğün kartı, hikâye yanıtı, okundu + yazıyor.
  dm.seed({
    id: 'chat-ayse',
    with: 'ayse',
    otherRead: now,
    myRead: now,
    messages: [
      { from: 'them', body: T('Dün paylaştığın somon kinoa kase tarifini kaydettim. Kaç porsiyon çıkıyor?', 'I saved the salmon quinoa bowl recipe you shared yesterday. How many servings does it make?'), at: now - 40 * MIN },
      { from: 'me', body: T('2 porsiyon, porsiyonu 520 kcal. Tarifi buraya da atıyorum', 'Two servings, 520 kcal each. Sending you the recipe here too'), at: now - 38 * MIN },
      { from: 'me', body: null, kind: 'meal', ref: { name: T('Somon kinoa kase', 'Salmon quinoa bowl'), kcal: 520, protein_g: 38 }, at: now - 38 * MIN + 5000 },
      { from: 'them', body: T('Çok iyi görünüyor! Bu hafta protein serisine başlıyorum', 'Looks great! I’m starting the protein streak this week'), at: now - 20 * MIN },
      { from: 'them', body: T('Cumartesi Kordon sabah koşusuna geliyor musun?', 'Are you coming to the Kordon morning run on Saturday?'), at: now - 19 * MIN },
      { from: 'me', body: T('Bu kahvaltıyı yarın deneyeceğim', 'I’m trying this breakfast tomorrow'), kind: 'story_reply', ref: { story_id: 's-yogurt' }, at: now - 6 * MIN },
      { from: 'me', body: T('Cumartesi koşuda görüşürüz', 'See you at the run on Saturday'), at: now - 5 * MIN },
    ],
  });
  // İstek hâli (FinChat `request`) — istekler sahnesindeki Burak ile aynı.
  if (s === 'request') {
    dm.seed({ id: 'req-burak', with: 'burak', myState: 'request', messages: [{ from: 'them', body: T('Merhaba, meal prep kutularını nereden alıyorsun?', 'Hi, where do you get your meal prep boxes?'), at: now - 6 * MIN }, { from: 'them', body: T('Pazar atölyesinde görüşelim mi?', 'Shall we meet at the Sunday workshop?'), at: now - 5 * MIN }] });
  }
  setDmClient(dm);
  useDmBadge.setState({ unread: empty ? 0 : 2, requests: empty ? 0 : 3 });
}

export const G63_ME = ME;
