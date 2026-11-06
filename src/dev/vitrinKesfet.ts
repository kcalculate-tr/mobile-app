// G15-S3 — Keşfet vitrin verisi: Final panolarındaki örnek içerik (FinFeed,
// FinSerbest, FinActivityCard, FinVideo, FinPosting, FinComments,
// FinNotifications, FinFollowingEmpty). YALNIZ __DEV__ — üretim paketine girmez
// (vitrinState.ts'ten, o da yalnız VitrinGate'ten yüklenir).
//
// Panolardaki "[Ad]" / "[N]" yer tutucuları burada örnek isim/sayıyla doldurulur;
// fotoğraflar Final'in kullandığı örnek görseller (`design/final/t19`).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Image } from 'react-native';
import { createMockKesfetClient } from '../modules/kesfet';
import type { Comment, FeedPost, KesfetClient, SocialNotification } from '../modules/kesfet/types';
import type { DayRing, GunClient } from '../modules/gun/types';

const uri = (m: number): string => Image.resolveAssetSource(m)?.uri ?? '';

export const VITRIN_PHOTO = {
  get tavukKinoa() { return uri(require('./assets/ph-tavuk-kinoa.jpg')); },
  get mercimek() { return uri(require('./assets/ph-mercimek.jpg')); },
  get yogurt() { return uri(require('./assets/ph-yogurt.jpg')); },
  get coban() { return uri(require('./assets/ph-coban.jpg')); },
  get thTavukKinoa() { return uri(require('./assets/th-tavuk-kinoa.png')); },
  get thMercimek() { return uri(require('./assets/th-mercimek.png')); },
  get thYogurt() { return uri(require('./assets/th-yogurt.png')); },
  get thCoban() { return uri(require('./assets/th-coban.png')); },
};

/** Yüklenemeyen görsel → bileşen gri yer tutucu gösterir (Final'deki "Fotoğraf · …" kutusu). */
const PLACEHOLDER = 'https://example.invalid/vitrin-placeholder.jpg';

const ago = (min: number): string => new Date(Date.now() - min * 60_000).toISOString();

const AUTHORS = {
  kcal: { id: 'a-kcal', display_name: 'kcal', handle: 'kcal', avatar_url: null, role: 'kurum', verified: true },
  dyt: { id: 'a-dyt', display_name: 'Dyt. Ece', handle: 'diyetisyen', avatar_url: null, role: 'dietitian', verified: true },
  uretici: { id: 'a-uretici', display_name: 'Tire Süt', handle: 'uretici', avatar_url: null, role: 'producer', verified: true },
  user: { id: 'a-user', display_name: 'Ayşe', handle: 'kullanici', avatar_url: null, role: 'user', verified: false },
  me: { id: '00000000-0000-4000-8000-00000000a14e', display_name: 'Deniz', handle: 'deniz', avatar_url: null, role: 'user', verified: false },
};

function post(id: string, o: Partial<FeedPost>): FeedPost {
  return {
    id,
    author: AUTHORS.user,
    published_at: ago(60),
    lang: 'tr',
    body: '',
    media: [],
    meal_card: null,
    quote: null,
    thread: null,
    stats: { likes: 0, saves: 0, adds: 0, comments: 0, did_it: 0 },
    me: { liked: false, saved: false, is_author: false },
    post_type: 'serbest',
    status: 'published',
    activity_card: null,
    ...o,
  };
}

const img = (url: string) => [{ url, width: 1080, height: 720, kind: 'image' as const }];

/** FinFeed: kcal haftanın tabağı (foto + besinler) · Dyt metin · Üretici öğün kartı · Dyt çorba. */
function feedPosts(): FeedPost[] {
  return [
    post('post-1', {
      author: AUTHORS.kcal,
      published_at: ago(120),
      body: 'Haftanın tabağı: tavuk, kinoa ve avokado. Tarifi ve değerleri aşağıda; tek dokunuşla öğününe loglayabilirsin.',
      media: img(VITRIN_PHOTO.tavukKinoa),
      post_type: 'ogun',
      meal_card: {
        name: 'Tavuk kinoa bowl',
        kcal: 540,
        protein_g: 42,
        carbs_g: 48,
        fat_g: 18,
        portion_label: '1 porsiyon',
        photo_url: VITRIN_PHOTO.thTavukKinoa,
        product_id: 'prod-bowl',
        items: [
          { name: 'Kinoa', grams: 150, kcal: 180, protein_g: 7, carbs_g: 32, fat_g: 3 },
          { name: 'Tavuk göğsü', grams: 120, kcal: 200, protein_g: 32, carbs_g: 0, fat_g: 6 },
          { name: 'Sebzeler', grams: 140, kcal: 160, protein_g: 3, carbs_g: 16, fat_g: 9 },
        ],
      },
      stats: { likes: 312, saves: 96, adds: 128, comments: 24, did_it: 0 },
    }),
    post('post-2', {
      author: AUTHORS.dyt,
      published_at: ago(180),
      body: 'Akşam öğününde tabağın yarısını sebzeye ayır, çeyreğini proteine, çeyreğini tam tahıla. Tabağı ölçmek, kaloriyi saymaktan daha kolay bir başlangıç.',
      stats: { likes: 86, saves: 41, adds: 0, comments: 7, did_it: 0 },
    }),
    post('post-3', {
      author: AUTHORS.uretici,
      published_at: ago(300),
      body: "Bu hafta Tire'den gelen süzme yoğurdu kahvaltı kasesinde denedik: yulaf, muz ve çilekle.",
      post_type: 'ogun',
      meal_card: {
        name: 'Süzme yoğurt kasesi',
        kcal: 320,
        protein_g: 18,
        carbs_g: 44,
        fat_g: 8,
        portion_label: '1 kase',
        photo_url: VITRIN_PHOTO.thYogurt,
        product_id: null,
      },
      stats: { likes: 54, saves: 22, adds: 31, comments: 3, did_it: 0 },
    }),
    post('post-4', {
      author: AUTHORS.dyt,
      published_at: ago(60 * 24),
      body: 'Kış için ısıtan, proteinli bir çorba: kırmızı mercimek, havuç ve kimyon.',
      media: img(VITRIN_PHOTO.mercimek),
      post_type: 'ogun',
      meal_card: {
        name: 'Mercimek çorbası',
        kcal: 260,
        protein_g: 14,
        carbs_g: 38,
        fat_g: 6,
        portion_label: '1 kase',
        photo_url: VITRIN_PHOTO.thMercimek,
        product_id: null,
      },
      stats: { likes: 140, saves: 58, adds: 77, comments: 9, did_it: 0 },
    }),
  ];
}

/** FinSerbest: serbest gönderiler (görsel ızgarası). */
function serbestPosts(): FeedPost[] {
  return [
    post('post-s1', {
      published_at: ago(12),
      body: 'Antrenman bitti, şimdi kahve.',
      media: img(PLACEHOLDER),
      me: { liked: true, saved: false, is_author: false },
      stats: { likes: 18, saves: 2, adds: 0, comments: 4, did_it: 0 },
    }),
    post('post-s2', {
      author: { ...AUTHORS.user, id: 'a-user2', display_name: 'Mert' },
      published_at: ago(120),
      body: 'Kordon’da gün doğumu. Bugün yürüyüş günü.',
      media: [
        { url: PLACEHOLDER, width: 1080, height: 1080, kind: 'image' },
        { url: PLACEHOLDER, width: 1080, height: 1080, kind: 'image' },
      ],
      stats: { likes: 9, saves: 1, adds: 0, comments: 1, did_it: 0 },
    }),
  ];
}

/** FinActivityCard: etkinlik gönderisi (Koşu · 45 dk · 8,2 km). */
function activityPosts(): FeedPost[] {
  return [
    post('post-a1', {
      published_at: ago(120),
      body: 'Kordon boyunca sabah koşusu. Rüzgâr tam arkadan esti.',
      media: img(PLACEHOLDER),
      post_type: 'etkinlik',
      activity_card: { type: 'kosu', minutes: 45, distance_km: 8.2, kcal_est: 430, note: null },
      stats: { likes: 21, saves: 3, adds: 0, comments: 5, did_it: 12 },
    }),
    ...feedPosts().slice(1, 2),
  ];
}

/** FinVideo: akışta sessiz otomatik oynayan video + öğün kartı. */
function videoPosts(): FeedPost[] {
  return [
    post('post-v1', {
      published_at: ago(120),
      body: '60 saniyede bulgur salatası. Sessiz izle, sonra kaydet.',
      media: [{ url: PLACEHOLDER, width: 1080, height: 1080, kind: 'video', duration_s: 42, thumb_path: null }],
      post_type: 'ogun',
      meal_card: {
        name: 'Kısır',
        kcal: 280,
        protein_g: 7,
        carbs_g: 46,
        fat_g: 8,
        portion_label: '1 porsiyon',
        photo_url: VITRIN_PHOTO.thCoban,
        product_id: null,
      },
      stats: { likes: 64, saves: 30, adds: 18, comments: 6, did_it: 0 },
    }),
    ...feedPosts().slice(1, 2),
  ];
}

/** FinPosting: kendi gönderim (paylaşılıyor/inceleniyor/yayında) + Dyt metin gönderisi. */
function postingPosts(status: 'pending' | 'published'): FeedPost[] {
  return [
    post('post-p1', {
      author: AUTHORS.me,
      published_at: ago(0),
      body: 'Kordon’da sabah koşusu, deniz yine çok güzeldi.',
      media: img(PLACEHOLDER),
      status,
      me: { liked: false, saved: false, is_author: true },
    }),
    post('post-2b', {
      author: AUTHORS.dyt,
      published_at: ago(180),
      body: 'Akşam öğününde tabağın yarısını sebzeye ayır.',
      stats: { likes: 86, saves: 41, adds: 0, comments: 7, did_it: 0 },
    }),
  ];
}

/** FinDetail: "Bugünkü öğle" gönderisi (foto + öğün kartı + istatistikler). */
function detailPost(): FeedPost {
  return post('post-d1', {
    published_at: ago(150),
    body: 'Bugünkü öğle: tavuk, kinoa ve avokado. 15 dakikada hazırladım, akşama kadar tok tuttu. Sosu yoğurt ve limondan.',
    media: img(VITRIN_PHOTO.tavukKinoa),
    post_type: 'ogun',
    meal_card: {
      name: 'Tavuk kinoa bowl',
      kcal: 540,
      protein_g: 42,
      carbs_g: 48,
      fat_g: 18,
      portion_label: '1 porsiyon',
      photo_url: VITRIN_PHOTO.thTavukKinoa,
      product_id: null,
    },
    stats: { likes: 86, saves: 24, adds: 31, comments: 3, did_it: 0 },
  });
}

function comment(id: string, postId: string, o: Partial<Comment>): Comment {
  return {
    id,
    post_id: postId,
    author: { id: 'a-user', display_name: 'Ayşe', handle: 'kullanici', avatar_url: null, verified: false },
    parent_id: null,
    body: '',
    status: 'published',
    created_at: ago(60),
    reply_count: 0,
    can_delete: false,
    ...o,
  };
}

/** FinComments (koşu gönderisi) + FinDetail yorumları. */
function commentsFor(postId: string): Comment[] {
  if (postId === 'post-d1') {
    return [
      comment('cd1', postId, {
        author: { id: 'a-dyt', display_name: 'Dyt. Ece', handle: 'diyetisyen', avatar_url: null, verified: true, role: 'dietitian' } as any,
        created_at: ago(120),
        body: 'Güzel denge. Avokadoyu yarım tutarsan yağ hedefi de rahatlar.',
      }),
      comment('cd2', postId, { created_at: ago(90), body: 'Sos tarifini paylaşır mısın? Yoğurt mu süzme mi?' }),
      comment('cd3', postId, {
        author: { id: 'a-user2', display_name: 'Mert', handle: 'mert', avatar_url: null, verified: false },
        created_at: ago(60),
        body: 'Ben de logladım, akşam deneyeceğim.',
      }),
    ];
  }
  return [
    comment('c1', postId, {
      author: { id: 'a-dyt', display_name: 'Dyt. Ece', handle: 'diyetisyen', avatar_url: null, verified: true },
      created_at: ago(180),
      body: 'Koşu sonrası 30 dk içinde proteinli bir öğün iyi gider.',
      reply_count: 1,
    }),
    comment('c1r', postId, {
      author: { id: 'a-user2', display_name: 'Mert', handle: 'kullanici', avatar_url: null, verified: false },
      parent_id: 'c1',
      created_at: ago(20),
      body: 'Tempo nasıldı?',
    }),
    comment('c2', postId, { created_at: ago(120), body: 'Kordon sabahları çok keyifli, ben de yarın oradayım.' }),
    comment('c3', postId, {
      author: { id: AUTHORS.me.id, display_name: 'Deniz', handle: 'deniz', avatar_url: null, verified: false },
      created_at: ago(0),
      body: 'Hafta sonu birlikte koşalım mı?',
      can_delete: true,
    }),
  ];
}

function notif(id: string, kind: SocialNotification['kind'], o: Partial<SocialNotification>): SocialNotification {
  return {
    id,
    actor: { id: 'a-user', display_name: 'Ayşe', handle: 'kullanici', avatar_url: null },
    kind,
    post_id: null,
    comment_id: null,
    created_at: ago(30),
    read_at: null,
    excerpt: null,
    post_thumb_url: null,
    ...o,
  };
}

const READ = ago(1);

/** FinNotifications: Takip istekleri · Bugün · Bu hafta (beğeniler gruplanır: "Ayşe ve 12 kişi"). */
function notifications(scene: string): SocialNotification[] {
  if (scene === 'reportNotice') {
    return [
      notif('nr', 'report_result', {
        actor: { id: 'kcal', display_name: 'kcal', handle: 'kcal', avatar_url: null },
        created_at: ago(0),
        excerpt: 'removed',
      }),
      notif('nr1', 'follow', { created_at: ago(120), read_at: READ }),
      notif('nr2', 'system', {
        actor: { id: 'kcal', display_name: 'kcal', handle: 'kcal', avatar_url: null },
        created_at: ago(300),
        read_at: READ,
        excerpt: '3 günlük seri! Bugün de bir öğün ekle.',
      }),
      notif('nr3', 'system', {
        actor: { id: 'kcal', display_name: 'kcal', handle: 'kcal', avatar_url: null },
        created_at: ago(60 * 26),
        read_at: READ,
        excerpt: "Siparişin teslim edildi, Akşam'a loglandı.",
      }),
      notif('nr4', 'system', {
        actor: { id: 'a-dyt', display_name: 'Dyt. Ece', handle: 'diyetisyen', avatar_url: null },
        created_at: ago(60 * 27),
        read_at: READ,
        excerpt: 'Dyt. Ece gönderini kaydetti',
      }),
    ];
  }
  const likes: SocialNotification[] = Array.from({ length: 13 }, (_, i) =>
    notif(`nl${i}`, 'like', {
      actor: { id: `a-like-${i}`, display_name: i === 0 ? 'Ayşe' : `Kişi ${i}`, handle: `k${i}`, avatar_url: null },
      post_id: 'post-1',
      post_thumb_url: VITRIN_PHOTO.thTavukKinoa,
      created_at: ago(5 + i),
    }),
  );
  const didIts: SocialNotification[] = Array.from({ length: 4 }, (_, i) =>
    notif(`nd${i}`, 'did_it', {
      actor: { id: `a-did-${i}`, display_name: i === 0 ? 'Mert' : `Koşucu ${i}`, handle: `d${i}`, avatar_url: null },
      post_id: 'post-a1',
      post_thumb_url: PLACEHOLDER,
      excerpt: 'Koşu · 45 dk.',
      created_at: ago(60 * 2 + i),
      read_at: READ,
    }),
  );
  const commentLikes: SocialNotification[] = Array.from({ length: 6 }, (_, i) =>
    notif(`ncl${i}`, 'comment_like', {
      actor: { id: `a-cl-${i}`, display_name: i === 0 ? 'Selin' : `Kişi ${i}`, handle: `cl${i}`, avatar_url: null },
      post_id: 'post-a1',
      comment_id: 'c3',
      created_at: ago(60 * 24 * 3 + i),
      read_at: READ,
    }),
  );
  return [
    notif('nf', 'follow_request', { actor: { id: 'a-req', display_name: 'Zeynep', handle: 'zeynep', avatar_url: null }, created_at: ago(8) }),
    ...likes,
    notif('na', 'add_to_day', {
      actor: { id: 'a-add', display_name: 'Can', handle: 'can', avatar_url: null },
      post_id: 'post-1',
      post_thumb_url: VITRIN_PHOTO.thTavukKinoa,
      created_at: ago(40),
    }),
    ...didIts,
    notif('nc', 'comment', {
      actor: { id: 'a-dyt', display_name: 'Dyt. Ece', handle: 'diyetisyen', avatar_url: null },
      post_id: 'post-a1',
      post_thumb_url: PLACEHOLDER,
      excerpt: 'Koşu sonrası proteinli bir öğün iyi gider.',
      created_at: ago(60 * 3),
      read_at: READ,
    }),
    notif('nrp', 'reply', {
      actor: { id: 'a-user', display_name: 'Ayşe', handle: 'kullanici', avatar_url: null },
      post_id: 'post-a1',
      excerpt: 'Ben de yarın oradayım.',
      created_at: ago(60 * 4),
      read_at: READ,
    }),
    notif('nfo', 'follow', {
      actor: { id: 'a-f', display_name: 'Mert', handle: 'mert', avatar_url: null },
      created_at: ago(60 * 24 * 2),
      read_at: READ,
    }),
    notif('nfa', 'follow_accept', {
      actor: { id: 'a-fa', display_name: 'Elif', handle: 'elif', avatar_url: null },
      created_at: ago(60 * 24 * 2 + 30),
      read_at: READ,
    }),
    ...commentLikes,
  ];
}

/** Gün halkası şeridi: Günüm + 4 kişi (seri sayılı). */
export function vitrinRings(): DayRing[] {
  const u = (id: string, name: string) => ({ id, display_name: name, avatar_url: null });
  return [
    { user: u(AUTHORS.me.id, 'Deniz'), progress: 0.42, streak: 3, has_new: false },
    { user: u('a-dyt', 'Dyt. Ece'), progress: 0.68, streak: 12, has_new: true },
    { user: u('a-r2', 'Ayşe'), progress: 1, streak: 5, has_new: true },
    { user: u('a-r3', 'Mert'), progress: 0.55, streak: 3, has_new: false },
    { user: u('a-r4', 'Elif'), progress: 0.8, streak: 8, has_new: false },
  ];
}

function postsFor(scene: string): FeedPost[] {
  switch (scene) {
    case 'serbest':
      return serbestPosts();
    case 'activity':
    case 'didIt':
    case 'didItToast':
      return activityPosts();
    case 'video':
    case 'videoFull':
      return videoPosts();
    case 'posting':
    case 'reviewing':
      return postingPosts('pending');
    case 'published':
    case 'rejected':
      return postingPosts('published');
    default:
      return feedPosts();
  }
}

/** Keşfet mock istemcisi + Final örnek içeriği (sahneye göre). */
export function vitrinKesfetClient(scene: string, empty: boolean): KesfetClient {
  const base = createMockKesfetClient(empty ? { count: 0, followingIndexes: [], unreadCount: 0 } : {});
  if (empty) {
    return { ...base, async listSocialNotifications() { return { items: [], next_cursor: null, unread: 0 }; } } as KesfetClient;
  }
  const list = postsFor(scene);
  const all = [...list, detailPost(), ...feedPosts(), ...activityPosts()];
  const comments = new Map<string, Comment[]>();
  const notifs = notifications(scene);
  const clone = (p: FeedPost): FeedPost => ({ ...p, me: { ...p.me }, stats: { ...p.stats } });
  return {
    ...base,
    async getFeed({ tab }: any) {
      // Takip sekmesi: Final FinFollowingEmpty → boş (önerilen hesaplar gösterilir).
      return { items: tab === 'following' ? [] : list.map(clone), next_cursor: null };
    },
    async getPost({ post: id }: any) {
      const p = all.find((x) => x.id === id) ?? null;
      return p ? clone(p) : null;
    },
    async listComments({ post: id }: any) {
      if (!comments.has(id)) comments.set(id, scene === 'commentsEmpty' ? [] : commentsFor(id));
      return { items: (comments.get(id) ?? []).map((c) => ({ ...c })), next_cursor: null };
    },
    async listSocialNotifications() {
      return { items: notifs.map((n) => ({ ...n })), next_cursor: null, unread: notifs.filter((n) => !n.read_at).length };
    },
  } as KesfetClient;
}

/** Gün istemcisi: Final halka şeridi (Keşfet sahneleri). */
export function vitrinGunClient(base: GunClient): GunClient {
  return { ...base, async getDayRings() { return vitrinRings(); } } as GunClient;
}
