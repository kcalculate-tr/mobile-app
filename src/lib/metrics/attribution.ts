// G19-S3 — Kaynak takibi (saf; depolama enjekte edilir).
//
// Yakalanan bağlantılar (kcal://… ve https://l.eatkcal.com/… aynı kurallar):
//   ?utm_source=&utm_medium=&utm_campaign=&utm_content=&utm_term=   → UTM
//   /k/<kod>  ya da ?kutu=<kod>                                     → kutu kartı QR (source=box_card, medium=qr)
//   /s/<kod>  ya da ?saha=<kod>                                     → saha kodu (source=saha, medium=field)
//   /p/<id>   /u/<handle>  /kesfet                                  → paylaşım bağlantısı (source=share)
//   diğer l.eatkcal.com yolları                                      → source=eatkcal_link
// Yok sayılan: auth-callback, payment-callback, dev/screen (uygulamanın kendi
// geri dönüşleri — linking.ts ile aynı filtre), expo geliştirme adresleri.
//
// İlk dokunma (first touch): uygulamanın İLK açılışında bir kez yazılır; o
// açılışta bağlantı yoksa source=direct. Asla üzerine yazılmaz.
// Son dokunma (last touch): her kaynaklı bağlantıda güncellenir; sipariş
// olaylarına ATTRIBUTION_WINDOW_MS içinde ise eklenir.
//
// Kişisel veri: handle, gönderi kimliği gibi kişiye bağlanabilen yol parçaları
// SAKLANMAZ — yalnız bağlantı türü (link=post|profile|explore|box|saha|other).

export type Touch = {
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  code?: string;
  link?: string;
  at: string; // ISO
};

export const FIRST_TOUCH_KEY = '@kcal_attr_first_touch';
export const LAST_TOUCH_KEY = '@kcal_attr_last_touch';
export const FIRST_OPEN_KEY = '@kcal_attr_first_open_done';
export const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const SAFE = /[^A-Za-z0-9_.-]/g;

function clean(v: string | null | undefined, max = 64): string | undefined {
  if (!v) return undefined;
  let s = v;
  try {
    s = decodeURIComponent(v);
  } catch {
    /* zaten çözülmüş */
  }
  s = s.trim().replace(/\s+/g, '_').replace(SAFE, '').slice(0, max);
  return s || undefined;
}

function cleanCode(v: string | null | undefined): string | undefined {
  const s = clean(v, 32);
  return s ? s.toUpperCase() : undefined;
}

const IGNORED = ['auth-callback', 'payment-callback', 'dev/screen/', 'expo-development-client', '--/'];

type ParsedUrl = { host: string; path: string[]; query: Record<string, string> };

function parseUrl(url: string): ParsedUrl | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?/i.exec(url.trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  let host = m[2].toLowerCase();
  let pathStr = m[3] ?? '';
  // kcal://p/123 → host 'p' aslında ilk yol parçası.
  if (scheme !== 'http' && scheme !== 'https') {
    pathStr = `/${host}${pathStr}`;
    host = '';
  }
  const path = pathStr.split('/').filter(Boolean);
  const query: Record<string, string> = {};
  const qs = (m[4] ?? '').replace(/^\?/, '');
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const [k, ...rest] = pair.split('=');
    const key = k.toLowerCase();
    if (!(key in query)) query[key] = rest.join('=').replace(/\+/g, ' ');
  }
  return { host, path, query };
}

/** URL'den dokunma bilgisi; kaynak taşımayan / yok sayılan URL → null. */
export function parseAttribution(url: string | null | undefined, nowIso: string): Touch | null {
  if (!url || typeof url !== 'string') return null;
  if (IGNORED.some((p) => url.includes(p))) return null;
  const u = parseUrl(url);
  if (!u) return null;
  if (u.host && u.host !== 'l.eatkcal.com' && u.host !== 'eatkcal.com' && u.host !== 'www.eatkcal.com') return null;
  if (u.host === 'eatkcal.com' || u.host === 'www.eatkcal.com') {
    // Ana alan adı yalnız ödeme dönüşü için açılıyor; UTM taşımıyorsa yok say.
    if (!u.query.utm_source) return null;
  }

  const q = u.query;
  const first = (u.path[0] ?? '').toLowerCase();
  const touch: Touch = { source: '', at: nowIso };

  const sahaCode = cleanCode(first === 's' ? u.path[1] : q.saha);
  const boxCode = cleanCode(first === 'k' ? u.path[1] : q.kutu);

  if (sahaCode) {
    Object.assign(touch, { source: 'saha', medium: 'field', code: sahaCode, link: 'saha' });
  } else if (boxCode) {
    Object.assign(touch, { source: 'box_card', medium: 'qr', code: boxCode, link: 'box' });
  } else if (first === 'p' || first === 'u' || first === 'kesfet') {
    const link = first === 'p' ? 'post' : first === 'u' ? 'profile' : 'explore';
    Object.assign(touch, { source: 'share', medium: 'link', link });
  } else if (u.host === 'l.eatkcal.com') {
    Object.assign(touch, { source: 'eatkcal_link', medium: 'link', link: 'other' });
  }

  // UTM her zaman kazanır (kampanya bağlantısı /k/ ya da /p/ üzerine de UTM taşıyabilir).
  const utmSource = clean(q.utm_source);
  if (utmSource) touch.source = utmSource;
  const medium = clean(q.utm_medium);
  if (medium) touch.medium = medium;
  const campaign = clean(q.utm_campaign);
  if (campaign) touch.campaign = campaign;
  const content = clean(q.utm_content);
  if (content) touch.content = content;
  const term = clean(q.utm_term);
  if (term) touch.term = term;

  if (!touch.source) return null; // kcal://reviews gibi kaynak taşımayan iç bağlantı
  return touch;
}

export interface AttrStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

async function readTouch(storage: AttrStorage, key: string): Promise<Touch | null> {
  try {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const t = JSON.parse(raw) as Touch;
    return t && typeof t.source === 'string' ? t : null;
  } catch {
    return null;
  }
}

export type CaptureResult = {
  /** Bu açılış uygulamanın ilk açılışı mı (first_touch bu çağrıda yazıldı). */
  firstOpen: boolean;
  firstTouch: Touch | null;
  touch: Touch | null;
};

/**
 * Açılış/bağlantı anında çağrılır. `initial=true` yalnız soğuk başlangıçtaki
 * getInitialURL için. İlk açılışta first touch yazılır (bağlantı yoksa direct).
 */
export async function captureTouch(
  storage: AttrStorage,
  url: string | null | undefined,
  opts: { initial: boolean; now?: () => number },
): Promise<CaptureResult> {
  const nowIso = new Date(opts.now ? opts.now() : Date.now()).toISOString();
  const touch = parseAttribution(url, nowIso);
  let firstOpen = false;
  let firstTouch: Touch | null = null;
  try {
    if (opts.initial) {
      const done = await storage.getItem(FIRST_OPEN_KEY);
      if (!done) {
        firstOpen = true;
        firstTouch = touch ?? { source: 'direct', at: nowIso };
        await storage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
        await storage.setItem(FIRST_OPEN_KEY, '1');
      }
    }
    if (touch) await storage.setItem(LAST_TOUCH_KEY, JSON.stringify(touch));
  } catch {
    /* depo yazılamadı: ölçüm kaybı, uygulama etkilenmez */
  }
  return { firstOpen, firstTouch, touch };
}

/** Sipariş olaylarına eklenecek kaynak alanları (ATTRIBUTION_PROPS ile aynı anahtarlar). */
export async function attributionProps(
  storage: AttrStorage,
  now: number = Date.now(),
): Promise<Record<string, string | number>> {
  const out: Record<string, string | number> = { channel: 'app' };
  const ft = await readTouch(storage, FIRST_TOUCH_KEY);
  if (ft) {
    out.ft_source = ft.source;
    if (ft.medium) out.ft_medium = ft.medium;
    if (ft.campaign) out.ft_campaign = ft.campaign;
  }
  const lt = await readTouch(storage, LAST_TOUCH_KEY);
  if (lt) {
    const age = now - Date.parse(lt.at);
    if (Number.isFinite(age) && age >= 0 && age <= ATTRIBUTION_WINDOW_MS) {
      out.lt_source = lt.source;
      if (lt.medium) out.lt_medium = lt.medium;
      if (lt.campaign) out.lt_campaign = lt.campaign;
      if (lt.code) out.lt_code = lt.code;
      out.lt_age_h = Math.round(age / 36e5);
    }
  }
  return out;
}

/** Son dokunmadaki saha kodu (pencere içinde) — kupon olayında "bağlantıdan geldi" işareti. */
export async function activeSahaCode(storage: AttrStorage, now: number = Date.now()): Promise<string | null> {
  const lt = await readTouch(storage, LAST_TOUCH_KEY);
  if (!lt || lt.source !== 'saha' || !lt.code) return null;
  const age = now - Date.parse(lt.at);
  return Number.isFinite(age) && age >= 0 && age <= ATTRIBUTION_WINDOW_MS ? lt.code : null;
}

/** D-S1 kuralı (admin_kpi): saha kodu = kod 'SAHA' ile başlar (ya da campaigns.source 'saha%'). */
export function isSahaCode(code: string | null | undefined, linkCode?: string | null): boolean {
  if (!code) return false;
  const c = code.trim().toUpperCase();
  return c.startsWith('SAHA') || (!!linkCode && c === linkCode.toUpperCase());
}
