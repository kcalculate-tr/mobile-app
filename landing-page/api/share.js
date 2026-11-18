// G61-S1 md.4 — l.eatkcal.com paylaşım önizlemesi + açılış sayfası (FinShareLanding / FinShareOG).
//
// Vercel sunucu işlevi (Node, PAKETSİZ — yalnız yerleşik fetch). vercel.json yönlendirmesi:
//   /p|u|r|i|m|d|x/<id>  ve  /s/<UUID>  →  /api/share?k=<önek>&id=<id>
// Uygulama kuruluysa Universal Link / App Link bu sayfayı HİÇ göstermez; burası "uygulama yok"
// durumu + bağlantı önizlemesi (WhatsApp / iMessage / X, og:* meta) içindir.
//
// Veri: Supabase `get_share_preview(p_kind, p_id)` (anon; yalnız herkese açık alanlar — migration
// 20261118100100_g61_share.sql). Ortam: SUPABASE_URL + SUPABASE_ANON_KEY (Vercel proje ortam
// değişkeni; yayımlanabilir anon anahtar). Yoksa / RPC yoksa genel marka önizlemesi döner.
// og:image: tür başına statik 1200×630 (koyu) — /og/<tür>-<dil>.png (sunucuda SVG→PNG paket ister).
// Gizli / silinmiş / iptal içerik: "Bu içerik artık yok" + mağaza düğmeleri, genel marka görseli.

'use strict';

const KIND = { p: 'post', u: 'profile', r: 'recipe', i: 'invite', m: 'meal', d: 'day', x: 'xray', s: 'story' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID = /^[A-Za-z0-9_.-]{1,64}$/;
const HOST = 'https://l.eatkcal.com';
const STORE = {
  ios: 'https://apps.apple.com/app/id6763964912',
  android: 'https://play.google.com/store/apps/details?id=com.kcalmobile.app',
};

const LOGO_VIEWBOX = '133 1710 3733 580';
const LOGO_PATHS = ["M606.81,2206.11l-34.66,79.66c-82.97-36.1-130.99-78.16-158.87-114.37-38.11,58.15-72.44,101.34-114.86,101.34-7.77,0-15.81-1.45-24.21-4.52-39.82-14.56-63.28-50.33-76.65-93.02-19.74,4.62-39.87,5.63-60.19,2.87l11.71-86.1c11.38,1.55,22.62.37,33.58-3-3.5-51.99.89-101.12,3.92-126.33,6.62-55.22,35.33-236.18,126.56-246.42,37.28-4.25,69.57,10.89,88.4,41.39,42.54,68.91,6.31,204.92-53.29,296.6-21.88,33.64-46,60.87-71.64,81.23,5.93,25.1,13.89,39.29,20.55,46.22,16.82-15.69,45.56-60.85,65.4-92.05,58.91-92.58,125.67-197.52,219.05-214.71l15.73,85.45c-44.49,8.2-91.94,70-131.85,130.08,9.82,22.62,41.76,72.35,141.32,115.67ZM299.07,1964.54c40.75-85.11,38.04-151.81,27.91-162.19-.06.05-.4.05-1.01.05-21.22,17.52-51.68,112.74-57.17,213.94,11.75-16.68,21.99-34.52,30.27-51.79Z", "M957.49,2158.88l67.02,46.45-1.12,1.22c-43.06,46.94-102.74,71.75-172.59,71.75-132.04,0-224.25-85.1-224.25-206.95s92.21-206.95,224.25-206.95c69.84,0,129.52,24.81,172.59,71.75l1.12,1.22-67.03,46.45-.85-1.06c-24.68-30.98-63.9-48.75-107.62-48.75-75.29,0-125.87,55.19-125.87,137.32s50.59,137.32,125.87,137.32c42.47,0,82.71-18.22,107.63-48.76l.85-1.01Z", "M1350.17,2012.92v-4.53c0-45.18-41.77-74.38-106.42-74.38-48.91,0-88.87,17.12-115.6,49.52l-.86,1.03-1.09-.78-65.89-46.44,1.11-1.22c43.48-47.61,105.42-71.75,184.07-71.75,122.51,0,198.62,54.6,198.62,142.48v263.83h-93.96v-48.38c-32.23,36.13-83.34,55.96-144.44,55.96-92.72,0-152.63-43.73-152.63-111.41,0-31.38,12.78-59.29,37.96-82.97,59.37-55.79,175.61-75.83,259.13-70.99ZM1350.16,2132.75v-72.89c-1.62-.01-3.27-.02-4.92-.02-58.86,0-137.71,12.98-175.49,50.15-13.89,13.67-20.93,29.48-20.93,47.03,0,43.09,43.55,58.45,84.31,58.45,65.64,0,117.04-36.34,117.04-82.72Z", "M1511.35,2270.69v-556.46h93.97v556.46h-93.97Z", "M1990.56,2158.88l67.02,46.45-1.12,1.22c-43.06,46.94-102.74,71.75-172.59,71.75-132.04,0-224.25-85.1-224.25-206.95s92.21-206.95,224.25-206.95c69.84,0,129.52,24.81,172.59,71.75l1.12,1.22-67.03,46.45-.85-1.06c-24.68-30.98-63.9-48.75-107.62-48.75-75.29,0-125.87,55.19-125.87,137.32s50.59,137.32,125.87,137.32c42.47,0,82.71-18.22,107.63-48.76l.85-1.01Z", "M2414.47,2083.47v-211.51h93.96v398.73h-93.96v-67.15c-33.32,48.92-86.81,74.74-155.04,74.74-73.26,0-160.59-28.8-160.59-166v-240.31h93.96v226.67c0,90.94,52.11,110.03,95.81,110.03,60.63,0,125.87-39.18,125.87-125.19h-.01Z", "M2580.09,2270.69v-556.46h93.97v556.46h-93.97Z", "M3025.44,2012.92v-4.53c0-45.18-41.77-74.38-106.42-74.38-48.91,0-88.87,17.12-115.6,49.52l-.86,1.03-1.09-.78-65.89-46.44,1.11-1.22c43.48-47.61,105.42-71.75,184.07-71.75,122.51,0,198.62,54.6,198.62,142.48v263.83h-93.96v-48.38c-32.23,36.13-83.34,55.96-144.44,55.96-92.72,0-152.63-43.73-152.63-111.41,0-31.38,12.78-59.29,37.96-82.97,59.37-55.79,175.61-75.83,259.13-70.99ZM3025.42,2132.75v-72.89c-1.62-.01-3.27-.02-4.92-.02-58.86,0-137.71,12.98-175.49,50.15-13.89,13.67-20.93,29.48-20.93,47.03,0,43.09,43.55,58.45,84.31,58.45,65.64,0,117.04-36.34,117.04-82.72Z", "M3429.41,2200.65v69.73l-1.09.27c-19.79,4.84-42.79,7.62-63.12,7.62-97.01,0-152.65-51.65-152.65-141.73v-194.19h-59.23v-69.63h59.23v-107.67h93.97v107.66h117.59v69.63h-117.59v192.69c0,52.29,19.31,73.61,66.64,73.61,16.71,0,35.03-2.54,54.45-7.54l1.81-.46Z", "M3658.45,1864.38c61.73,0,111.29,19.03,147.33,56.57,38.75,40.38,59.37,101.84,56.61,168.63l-.06,1.39h-316.34c6.67,71.55,55.18,117.67,123.98,117.67,42.85,0,82.07-17.77,107.63-48.76l.85-1.03,67,46.45-1.12,1.22c-43.69,47.61-102.05,71.75-173.48,71.75-131.52,0-223.37-84.79-223.37-206.19s84.79-207.7,210.98-207.7ZM3769.06,2037.28c-9.06-63.75-51.32-103.27-110.62-103.27s-102.16,39.53-109.79,103.27h220.4Z"];

const T = {
  tr: {
    openShort: 'Aç', open: 'Uygulamada aç', explore: 'Keşfet', more: 'Keşfet’te devamını oku',
    ingTitle: 'Öne çıkan malzemeler', copyCode: 'Kodu kopyala', copied: 'Kopyalandı',
    invTitle: 'İkinize de 1 öğün bizden', invSub: 'Bu kodla Kcalculate’e kaydol.',
    calc: 'Kcalculate ile hesaplandı', protein: 'Protein', carbs: 'Karb.', fat: 'Yağ',
    today: 'Bugün', ofGoal: 'günlük hedef', meals: 'Öğün', water: 'Su', xray: 'Tabak Röntgeni',
    perServing: 'porsiyon başı', storyExpired: 'Hikâye süresi doldu', story: 'Hikâye', seeProfile: 'Profili gör',
    goneTitle: 'Bu içerik artık yok', goneBody: 'Paylaşan kişi kaldırmış ya da bağlantı hatalı olabilir.',
    note: 'Kcalculate yüklüyse bu bağlantı doğrudan uygulamada açılır. Değilse mağaza açılır, kurulumdan sonra bu içeriğe gelirsin.',
    kinds: { post: 'Keşfet gönderisi', profile: 'Profil', recipe: 'Tarif', invite: 'Davet', meal: 'Öğün', day: 'Gün özeti', xray: 'Tabak Röntgeni', story: 'Hikâye' },
    ogPost: (n) => `${n} bunu Kcalculate’te paylaştı.`, ogProfile: (n) => `${n} Kcalculate’te`,
    ogMealSub: (p, c, f) => `Kcalculate ile hesaplandı · P ${p} g · K ${c} g · Y ${f} g`,
    ogDay: (pct) => `Günlük hedefin %${pct}’i · Kcalculate`, ogGeneric: 'Kcalculate — kalori ve makro takibi',
    ogGenericSub: 'Öğünlerini fotoğrafla, kalori ve makroları saniyeler içinde gör.',
    ogStory: (n) => `${n} Kcalculate’te bir hikâye paylaştı.`,
  },
  en: {
    openShort: 'Open', open: 'Open in the app', explore: 'Explore', more: 'Read more on Explore',
    ingTitle: 'Key ingredients', copyCode: 'Copy code', copied: 'Copied',
    invTitle: 'You both get 1 meal on us', invSub: 'Sign up to Kcalculate with this code.',
    calc: 'Calculated with Kcalculate', protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
    today: 'Today', ofGoal: 'of daily goal', meals: 'Meals', water: 'Water', xray: 'Plate X-ray',
    perServing: 'per serving', storyExpired: 'This story has expired', story: 'Story', seeProfile: 'See profile',
    goneTitle: 'This content is no longer available', goneBody: 'The person who shared it may have removed it, or the link may be wrong.',
    note: 'If Kcalculate is installed, this link opens straight in the app. Otherwise the store opens and you land here after installing.',
    kinds: { post: 'Explore post', profile: 'Profile', recipe: 'Recipe', invite: 'Invite', meal: 'Meal', day: 'Day summary', xray: 'Plate X-ray', story: 'Story' },
    ogPost: (n) => `${n} shared this on Kcalculate.`, ogProfile: (n) => `${n} is on Kcalculate`,
    ogMealSub: (p, c, f) => `Calculated with Kcalculate · P ${p} g · C ${c} g · F ${f} g`,
    ogDay: (pct) => `${pct}% of daily goal · Kcalculate`, ogGeneric: 'Kcalculate — calorie and macro tracking',
    ogGenericSub: 'Snap your meals and see calories and macros in seconds.',
    ogStory: (n) => `${n} shared a story on Kcalculate.`,
  },
};

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function clip(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}
function num(v, lang, dec = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  const s = dec ? String(Math.round(n * 10 ** dec) / 10 ** dec) : String(Math.round(n));
  return lang === 'tr' ? s.replace('.', ',') : s;
}
function httpsUrl(v) {
  return typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/.test(v) ? v : null;
}

async function fetchPreview(kind, id) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null; // ortam yok → genel önizleme (LOG: Vercel ortam değişkeni)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/get_share_preview`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_kind: kind, p_id: id }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const d = await r.json();
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}

function logoSvg(height, cls) {
  const [, , w, h] = LOGO_VIEWBOX.split(' ').map(Number);
  const width = Math.round((w / h) * height);
  return `<svg class="${cls}" viewBox="${LOGO_VIEWBOX}" width="${width}" height="${height}" role="img" aria-label="Kcalculate">${LOGO_PATHS.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
}

/** Tür + veri → { title, desc, card (HTML), gone }. */
function build(kind, id, d, lang) {
  const s = T[lang];
  const gone = !d || d.gone === true;
  const macroRow = (p, c, f) =>
    `<div class="macros">${[[s.protein, p], [s.carbs, c], [s.fat, f]]
      .map(([l, v]) => `<div class="cell"><span>${esc(l)}</span><b>${esc(num(v, lang))} g</b></div>`)
      .join('')}</div>`;
  if (gone) return { gone: true, title: s.ogGeneric, desc: s.ogGenericSub, card: '' };
  switch (kind) {
    case 'post': {
      const name = d.author_name || 'Kcalculate';
      const img = httpsUrl(d.image);
      return {
        title: clip(d.text || s.kinds.post, 60), desc: clip(s.ogPost(name), 110),
        card: `<div class="author"><span class="av" aria-hidden="true"></span><span><b>${esc(name)}</b><small>${d.handle ? `@${esc(d.handle)} · ` : ''}${esc(s.explore)}</small></span></div>
<p class="txt">${esc(clip(d.text, 220))}</p>${img ? `<img class="photo" src="${esc(img)}" alt="">` : ''}`,
      };
    }
    case 'profile': {
      const name = d.name || `@${d.handle}`;
      const av = httpsUrl(d.avatar);
      return {
        title: clip(s.ogProfile(name), 60), desc: clip(d.bio || s.ogGenericSub, 110),
        card: `<div class="prof"><span class="ring">${av ? `<img src="${esc(av)}" alt="">` : ''}</span><h1>${esc(name)}</h1><span class="sec">@${esc(d.handle)}</span>${d.bio ? `<p>${esc(clip(d.bio, 160))}</p>` : ''}</div>`,
      };
    }
    case 'recipe': {
      const name = lang === 'en' ? d.name_en : d.name_tr;
      const ings = (lang === 'en' ? d.ings_en : d.ings_tr) || [];
      const img = httpsUrl(d.image);
      const meta = [`${num(d.kcal, lang)} kcal ${s.perServing}`, d.protein != null ? `${num(d.protein, lang)} g ${s.protein.toLowerCase()}` : null].filter(Boolean);
      return {
        title: clip(name, 60), desc: clip(meta.join(' · '), 110),
        card: `${img ? `<img class="hero" src="${esc(img)}" alt="${esc(name)}">` : ''}<div class="pad"><h1>${esc(name)}</h1><div class="chips">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>${ings.length ? `<span class="sec small">${esc(s.ingTitle)}</span><ul class="ings">${ings.slice(0, 3).map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}</div>`,
      };
    }
    case 'invite': {
      const code = String(d.code || id).toUpperCase();
      return {
        title: clip(s.invTitle, 60), desc: clip(s.invSub, 110),
        card: `<div class="inv"><img src="/og/bowl.png" alt="" width="132" height="132"><h1>${esc(s.invTitle)}</h1><p class="sec">${esc(s.invSub)}</p><div class="code"><span id="code">${esc(code)}</span><button type="button" id="copy" data-done="${esc(s.copied)}">${esc(s.copyCode)}</button></div></div>`,
      };
    }
    case 'meal':
    case 'xray': {
      const name = d.name || s.kinds[kind];
      const kcal = kind === 'xray' ? d.totalKcal : d.kcal;
      const items = kind === 'xray' && Array.isArray(d.items) ? d.items : [];
      return {
        title: clip(kind === 'xray' ? `${s.xray}: ${name}` : name, 60), desc: clip(s.ogMealSub(num(d.protein, lang), num(d.carbs, lang), num(d.fat, lang)), 110),
        card: `<div class="pad">${kind === 'xray' ? `<span class="tag">${esc(s.xray)}</span>` : d.mealLabel ? `<span class="pill">${esc(d.mealLabel)}</span>` : ''}<div class="glow"><img src="/og/bowl.png" alt="" width="150" height="150"></div><h1>${esc(name)}</h1><div class="kcal">${esc(num(kcal, lang))} <span>kcal</span></div>${macroRow(d.protein, d.carbs, d.fat)}${items.length ? `<ul class="ings">${items.map((it) => `<li>${esc(it.name)}${it.kcal != null ? ` · ${esc(num(it.kcal, lang))} kcal` : ''}</li>`).join('')}</ul>` : ''}<span class="sec small">${esc(s.calc)}</span></div>`,
      };
    }
    case 'day': {
      const pct = Math.max(0, Math.round(Number(d.pct) || 0));
      const r = 70, c = 2 * Math.PI * r, f = Math.min(1, pct / 100);
      return {
        title: clip(`${s.today} · ${lang === 'tr' ? `%${pct}` : `${pct}%`}`, 60), desc: clip(s.ogDay(pct), 110),
        card: `<div class="pad day"><span class="pill">${esc(d.dateLabel || s.today)}</span><svg viewBox="0 0 180 180" width="200" height="200" role="img" aria-label="${esc(s.ogDay(pct))}"><circle cx="90" cy="90" r="${r}" fill="none" class="track" stroke-width="16"/><circle cx="90" cy="90" r="${r}" fill="none" stroke="#B9EF14" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 90 90)"/><text x="90" y="96" text-anchor="middle" class="pct">${lang === 'tr' ? `%${pct}` : `${pct}%`}</text><text x="90" y="120" text-anchor="middle" class="sub">${esc(s.ofGoal)}</text></svg><div class="macros">${[[s.meals, num(d.meals, lang)], [s.protein, d.protein != null ? `${num(d.protein, lang)} g` : null], [s.water, d.waterL != null ? `${num(d.waterL, lang, 1)} L` : null]].filter((x) => x[1] != null).map(([l, v]) => `<div class="cell"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>`,
      };
    }
    case 'story': {
      const name = d.author_name || (d.handle ? `@${d.handle}` : 'Kcalculate');
      const av = httpsUrl(d.avatar);
      return {
        title: clip(d.expired ? s.storyExpired : `${name} · ${s.story}`, 60), desc: clip(s.ogStory(name), 110),
        card: `<div class="prof"><span class="ring">${av ? `<img src="${esc(av)}" alt="">` : ''}</span><h1>${esc(d.expired ? s.storyExpired : name)}</h1>${d.handle ? `<a class="sec" href="${HOST}/u/${encodeURIComponent(d.handle)}">${esc(s.seeProfile)} · @${esc(d.handle)}</a>` : ''}</div>`,
      };
    }
    default:
      return { gone: true, title: s.ogGeneric, desc: s.ogGenericSub, card: '' };
  }
}

/** Önizleme okunamadığında türün genel kartı (davette kod bağlantıdan gösterilir). */
function generic(kind, id, lang) {
  const s = T[lang];
  if (kind === 'invite') return build('invite', id, { code: id }, lang);
  return {
    title: clip(`${s.kinds[kind]} · Kcalculate`, 60),
    desc: clip(s.ogGenericSub, 110),
    card: `<div class="pad"><span class="pill">${esc(s.kinds[kind])}</span><div class="glow"><img src="/og/bowl.png" alt="" width="150" height="150"></div><p class="sec">${esc(s.ogGenericSub)}</p></div>`,
  };
}

const CSS = `*,*::before,*::after{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
:root{--bg:#F3F4F6;--text:#0A0A0A;--sec:#6B6B70;--line:#E9EBEE;--card:#FFFFFF;--chip:#F3F4F6;--ph:#DCDEE2;--bar:#E9EBEE;--logo:#0A0A0A;--foot:rgba(243,244,246,.94);--storeBg:#0A0A0A;--storeFg:#FFFFFF;--blob:rgba(185,239,20,.34);--glow:rgba(185,239,20,.55);--dot:#4A6B00;--sh:0 1px 2px rgba(10,10,10,.06),0 6px 18px rgba(10,10,10,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#000;--text:#F5F5F5;--sec:#A1A1A6;--line:#2C2C2E;--card:#1C1C1E;--chip:#2C2C2E;--ph:#3A3A3C;--bar:#1C1C1E;--logo:#FFF;--foot:rgba(0,0,0,.92);--storeBg:#F5F5F5;--storeFg:#0A0A0A;--blob:rgba(185,239,20,.30);--glow:rgba(185,239,20,.24);--dot:#B9EF14;--sh:inset 0 0 0 1px #2C2C2E}}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font:15px/1.4 'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;position:relative;overflow-x:hidden}
body::before{content:"";position:fixed;left:-120px;top:80px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,var(--blob) 0,rgba(185,239,20,0) 68%);filter:blur(60px);z-index:-1}
h1{font-family:'Bricolage Grotesque',system-ui,sans-serif;margin:0}
a,button{font:inherit;color:inherit}a:focus-visible,button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.wrap{width:100%;max-width:520px;margin:0 auto;flex:1;display:flex;flex-direction:column}
header{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 16px}.logo{fill:var(--logo);display:block}
.openS{min-height:44px;display:flex;align-items:center;padding:0 8px;text-decoration:none}.openS span{height:34px;padding:0 14px;border-radius:17px;background:var(--text);color:var(--bg);display:flex;align-items:center;font-size:13px;font-weight:700}
main{flex:1;padding:4px 16px 16px}
article{border-radius:24px;background:var(--card);box-shadow:var(--sh);overflow:hidden}
.author{padding:14px 14px 0;display:flex;align-items:center;gap:10px}.author b{display:block}.author small{display:block;font-size:13px;color:var(--sec)}.av{width:40px;height:40px;border-radius:20px;background:var(--ph);flex:none}
.txt{margin:10px 14px 0}.photo{display:block;margin:12px 14px 14px;width:calc(100% - 28px);height:230px;object-fit:cover;border-radius:16px}
.prof{padding:24px 18px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}.prof h1{margin-top:12px;font-weight:800;font-size:30px}.prof p{margin:4px 0 0}
.ring{width:112px;height:112px;border-radius:56px;background:var(--ph);box-shadow:0 0 0 5px #B9EF14,0 0 0 9px var(--card);overflow:hidden;display:block}.ring img{width:100%;height:100%;object-fit:cover}
.sec{color:var(--sec)}.small{font-size:13px;font-weight:700}
.hero{display:block;width:100%;height:200px;object-fit:cover}.pad{padding:18px;display:flex;flex-direction:column;gap:10px}.pad h1{font-weight:700;font-size:26px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span,.pill{height:30px;padding:0 12px;border-radius:15px;background:var(--chip);display:inline-flex;align-items:center;font-size:13px;font-weight:700;align-self:flex-start}
.tag{height:30px;padding:0 12px;border-radius:15px;background:#B9EF14;color:#0A0A0A;display:inline-flex;align-items:center;font-size:13px;font-weight:800;align-self:flex-start}
.ings{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}.ings li{display:flex;align-items:center;gap:10px}.ings li::before{content:"";width:8px;height:8px;border-radius:4px;background:var(--dot);flex:none}
.inv{padding:20px 18px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;background:radial-gradient(circle at 50% 22%,var(--glow),rgba(185,239,20,0) 55%)}.inv h1{font-weight:800;font-size:28px;line-height:1.1;margin-top:4px}.inv p{margin:0}
.code{margin-top:8px;width:100%;padding:14px;border-radius:18px;background:var(--chip);display:flex;align-items:center;justify-content:space-between;gap:8px}.code span{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:30px;letter-spacing:.08em}.code button{min-height:44px;padding:0 14px;border:none;border-radius:22px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);font-size:14px;font-weight:700;cursor:pointer}
.glow{height:180px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,var(--glow) 0,rgba(185,239,20,0) 62%)}
.kcal{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:44px;line-height:1}.kcal span{font-size:20px}
.macros{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.cell{padding:10px;border-radius:14px;background:var(--chip);display:flex;flex-direction:column}.cell span{font-size:12px;color:var(--sec)}.cell b{font-size:16px}
.day{align-items:center}.day svg .track{stroke:var(--line)}.day .pct{font:800 34px 'Bricolage Grotesque',sans-serif;fill:var(--text)}.day .sub{font-size:12px;fill:var(--sec)}.day .macros{width:100%}
.gone{padding:28px 18px;text-align:center;display:flex;flex-direction:column;gap:8px}.gone h1{font-size:24px;font-weight:700}.gone p{margin:0;color:var(--sec)}
footer{position:sticky;bottom:0;padding:14px 16px 30px;display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);background:var(--foot);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.open{min-height:54px;border-radius:27px;background:#B9EF14;color:#0A0A0A;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:17px;font-weight:700}
.stores{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.stores a{min-height:48px;border-radius:14px;background:var(--storeBg);color:var(--storeFg);display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;font-size:14px;font-weight:700}
.note{margin:0;font-size:12px;line-height:1.45;color:var(--sec)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media (prefers-reduced-transparency:reduce){footer{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}`;

function page({ lang, kind, id, prefix, built }) {
  const s = T[lang];
  const canonical = `${HOST}/${prefix}/${encodeURIComponent(id)}`;
  const ogKind = built.gone ? 'default' : kind;
  const ogImage = `${HOST}/og/${ogKind}-${lang}.png`;
  const appUrl = `kcal://${prefix}/${encodeURIComponent(id)}`;
  const dl = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v10 M8 9.5l4 4 4-4 M4.5 15.5v4h15v-4"/></svg>';
  const body = built.gone
    ? `<article class="gone" role="status"><h1>${esc(s.goneTitle)}</h1><p>${esc(s.goneBody)}</p></article>`
    : `<article>${built.card}</article>`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(built.title)}</title>
<meta name="description" content="${esc(built.desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kcalculate">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(built.title)}">
<meta property="og:description" content="${esc(built.desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'tr' ? 'tr_TR' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(built.title)}">
<meta name="twitter:description" content="${esc(built.desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="apple-itunes-app" content="app-id=6763964912, app-argument=${esc(canonical)}">
<meta name="robots" content="${built.gone || kind === 'meal' || kind === 'day' || kind === 'xray' || kind === 'invite' ? 'noindex' : 'index'}">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header>${logoSvg(22, 'logo')}<a class="openS" href="${esc(appUrl)}"><span>${esc(s.openShort)}</span></a></header>
<main>${body}</main>
<footer id="open">
<a class="open" href="${esc(appUrl)}">${esc(s.open)}</a>
<div class="stores"><a href="${STORE.ios}" rel="noopener">${dl}App Store</a><a href="${STORE.android}" rel="noopener">${dl}Google Play</a></div>
<p class="note">${esc(s.note)}</p>
</footer>
</div>
<script>(function(){var b=document.getElementById('copy');if(!b)return;b.addEventListener('click',function(){var c=document.getElementById('code').textContent;try{navigator.clipboard.writeText(c).then(function(){b.textContent=b.getAttribute('data-done')})}catch(e){}})})();</script>
</body>
</html>`;
}

function pickLang(req) {
  const q = String((req.query && req.query.lang) || '').toLowerCase();
  if (q === 'en' || q === 'tr') return q;
  const al = String((req.headers && req.headers['accept-language']) || '').toLowerCase();
  return al.startsWith('en') ? 'en' : 'tr';
}

async function handler(req, res) {
  const prefix = String((req.query && req.query.k) || '').toLowerCase();
  const rawId = String((req.query && req.query.id) || '');
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    id = '';
  }
  const kind = KIND[prefix];
  const lang = pickLang(req);
  const valid = !!kind && SAFE_ID.test(id) && (prefix !== 's' || UUID.test(id)) && (prefix !== 'p' || UUID.test(id));
  const data = valid ? await fetchPreview(kind, kind === 'profile' ? id.replace(/^@/, '') : id) : null;
  // data === null → önizleme ALINAMADI (ortam yok / ağ): "yok" deme, türün genel önizlemesi.
  const built = !valid ? build('none', '', null, lang) : data === null ? generic(kind, id, lang) : build(kind, id, data, lang);
  res.statusCode = valid && !built.gone ? 200 : 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Vary', 'Accept-Language');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.end(page({ lang, kind: kind || 'post', id: id || '', prefix: prefix || 'p', built }));
}

module.exports = handler;
module.exports.build = build;
module.exports.generic = generic;
module.exports.page = page;
module.exports.KIND = KIND;
