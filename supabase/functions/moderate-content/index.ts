// moderate-content — Keşfet gönderi/yorum AI içerik denetimi (G8-CONTRACT.md §Edge).
// YALNIZ DOSYA: deploy edilmez, anahtar koda yazılmaz. analyze-ai-scan stiliyle birebir.
//
// POST { target_type: 'post'|'comment', target_id: uuid }
//   Servis rolüyle hedefi okur. Gönderide: görseller (+ varsa video kareleri) + metin;
//   yorumda: metin. Anthropic Messages API → JSON { allow, categories, confidence }.
//     allow        → hedef 'published'.
//     !allow        → 'pending' kalır + sistem şikayeti (content_reports source='ai',
//                     reason='ai:<kategori>', risk: minor_safety/self_harm/violence=3,
//                     sexual/nudity/hate=2, spam/other=1).
//     hata/timeout  → 'pending' kalır + sistem şikayeti risk 1 (reason='ai:unavailable');
//                     moderation_queue 'done' YAPILMAZ → pg_cron yeniden dener (en fazla 3).
//   Nihai karar (allow ya da bloke) → moderation_queue.status='done'.
//
// Çağıran: (1) istemci — create_post/add_comment sonrası, kendi içeriği için JWT ile;
//          (2) iç çağrı — pg_cron 'moderate_pending_retry' service_role ile.
//
// ÖNEMLİ (fitness uygulaması): Spor kıyafeti, mayo, antrenman veya beden/vücut
// fotoğrafı TEK BAŞINA ihlal DEĞİLDİR; talimatta açıkça belirtilir.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
// Model AI_MODERATION_MODEL ile verilir; varsayılan sözleşmedeki gibi. Deploy
// öncesi geçerli bir modele set edilmeli (bkz. LOG / G6-APPLY).
const AI_MODERATION_MODEL = Deno.env.get('AI_MODERATION_MODEL') ?? 'claude-haiku-5-5'

const BUCKET = 'post-media'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB (karede/görselde tek tek)
const MAX_IMAGES = 6                      // en fazla 4 foto + 3 kareden ilk 6
const TIMEOUT_MS = 20_000
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

const CATEGORIES = [
  'violence', 'sexual', 'nudity', 'hate', 'self_harm', 'minor_safety', 'spam', 'other',
] as const
type Category = (typeof CATEGORIES)[number]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function mediaTypeFor(path: string, blobType: string): string | null {
  if (ALLOWED_MIME.includes(blobType)) return blobType
  const ext = path.toLowerCase().split('.').pop() ?? ''
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return null
}

function extractJson(text: string): unknown | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

// send-notification ile aynı desen: imza fonksiyon çalışmadan önce doğrulanır;
// payload'daki role claim'ine güvenilir.
function serviceRoleTokenMu(jwt: string): boolean {
  const parts = jwt.split('.')
  if (parts.length !== 3) return false
  try {
    const body = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = body + '='.repeat((4 - (body.length % 4)) % 4)
    const payload = JSON.parse(atob(pad)) as { role?: string }
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

function riskForCategory(cat: Category): number {
  if (cat === 'minor_safety' || cat === 'self_harm' || cat === 'violence') return 3
  if (cat === 'sexual' || cat === 'nudity' || cat === 'hate') return 2
  return 1 // spam / other
}

// Sistem (AI) şikayetini tekilleştirerek yaz: hedef başına tek 'ai' satır.
async function writeAiReport(
  admin: SupabaseClient,
  targetType: string,
  targetId: string,
  reason: string,
  risk: number,
) {
  await admin
    .from('content_reports')
    .delete()
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('source', 'ai')
  await admin.from('content_reports').insert({
    reporter_id: null,
    target_type: targetType,
    target_id: targetId,
    reason,
    status: 'open',
    risk,
    source: 'ai',
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  if (!ANTHROPIC_API_KEY) return json({ error: 'config' }, 500)
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1) Gövde.
  let body: { target_type?: string; target_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const targetType = (body.target_type ?? '').trim()
  const targetId = (body.target_id ?? '').trim()
  if ((targetType !== 'post' && targetType !== 'comment') || !targetId) {
    return json({ error: 'bad_request' }, 400)
  }

  // 2) Hedefi oku (service-role; RLS bypass).
  let authorId: string | null = null
  let status = ''
  let text = ''
  const images: Array<{ mediaType: string; data: string }> = []

  if (targetType === 'post') {
    const { data: post, error } = await admin
      .from('posts')
      .select('author_id, status, body, post_type')
      .eq('id', targetId)
      .maybeSingle()
    if (error) return json({ error: 'server' }, 500)
    if (!post) return json({ error: 'not_found' }, 404)
    authorId = post.author_id
    status = post.status
    text = post.body ?? ''
  } else {
    const { data: c, error } = await admin
      .from('post_comments')
      .select('author_id, status, body')
      .eq('id', targetId)
      .maybeSingle()
    if (error) return json({ error: 'server' }, 500)
    if (!c) return json({ error: 'not_found' }, 404)
    authorId = c.author_id
    status = c.status
    text = c.body ?? ''
  }

  // 3) Yetki: iç çağrı (service_role) VEYA hedefin yazarı olan kullanıcı.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const icCagri =
    (SERVICE_ROLE_KEY.length > 0 && token === SERVICE_ROLE_KEY) || serviceRoleTokenMu(token)
  if (!icCagri) {
    if (!token) return json({ error: 'unauthorized' }, 401)
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: authErr } = await authed.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)
    if (user.id !== authorId) return json({ error: 'forbidden' }, 403)
  }

  // 4) Zaten karara bağlanmış (pending değil) → kuyruğu 'done' yap, çık.
  if (status !== 'pending') {
    await admin.from('moderation_queue').update({ status: 'done' })
      .eq('target_type', targetType).eq('target_id', targetId)
    return json({ skip: true, reason: `status=${status}` })
  }

  // 5) Gönderi görsellerini + video karelerini indir (en fazla MAX_IMAGES).
  if (targetType === 'post') {
    const { data: media } = await admin
      .from('post_media')
      .select('url, kind, frame_paths, sort')
      .eq('post_id', targetId)
      .order('sort', { ascending: true })
    const paths: string[] = []
    for (const m of media ?? []) {
      if (m.kind === 'video') {
        for (const fp of (m.frame_paths ?? []) as string[]) if (fp) paths.push(fp)
      } else if (m.url) {
        paths.push(m.url as string)
      }
    }
    for (const path of paths.slice(0, MAX_IMAGES)) {
      const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(path)
      if (dlErr || !blob || blob.size > MAX_IMAGE_BYTES) continue
      const mediaType = mediaTypeFor(path, blob.type)
      if (!mediaType) continue
      images.push({ mediaType, data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())) })
    }
  }

  // 6) Anthropic Messages API — denetim JSON'ı iste. 20 sn zaman aşımı.
  const prompt =
    'You are a content safety classifier for a fitness/nutrition social app. ' +
    'Review the user post/comment (text and any images) and decide if it is allowed. ' +
    'PROHIBITED: real violence or threats, sexual/explicit content, nudity, hate speech, ' +
    'self-harm/suicide promotion, content involving minors in unsafe/inappropriate ways, spam. ' +
    'IMPORTANT: This is a FITNESS app. Sportswear, swimwear/bikini, gym/training photos, ' +
    'and ordinary body/physique photos are NOT violations on their own — allow them. ' +
    'Respond with ONLY a JSON object, no prose, no markdown fences. Shape: ' +
    '{"allow":boolean,"categories":string[],"confidence":number}. ' +
    'categories is a subset of ["violence","sexual","nudity","hate","self_harm","minor_safety","spam","other"] ' +
    'and MUST be empty when allow=true. confidence is 0..1.'

  const content: Array<Record<string, unknown>> = []
  for (const img of images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })
  }
  content.push({ type: 'text', text: `${prompt}\n\nUSER CONTENT:\n${text || '(no text)'}` })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let modelText = ''
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODERATION_MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content }],
      }),
    })
    if (!resp.ok) {
      await writeAiReport(admin, targetType, targetId, 'ai:unavailable', 1)
      return json({ error: 'model', status: resp.status }, 502)
    }
    const data = await resp.json()
    modelText = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b.type === 'text')
          .map((b: { text?: string }) => b.text ?? '').join('')
      : ''
  } catch (_e) {
    await writeAiReport(admin, targetType, targetId, 'ai:unavailable', 1)
    return json({ error: 'timeout' }, 504)
  } finally {
    clearTimeout(timer)
  }

  // 7) JSON ayrıştır. Dışı → ai:unavailable (pending kalır, yeniden denenir).
  const parsed = extractJson(modelText) as
    | { allow?: unknown; categories?: unknown; confidence?: unknown }
    | null
  if (!parsed || typeof parsed.allow !== 'boolean') {
    await writeAiReport(admin, targetType, targetId, 'ai:unavailable', 1)
    return json({ error: 'parse' }, 502)
  }

  const cats = (Array.isArray(parsed.categories) ? parsed.categories : [])
    .map((c) => String(c))
    .filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c))

  // 8) Karar uygula.
  if (parsed.allow && cats.length === 0) {
    // Onaylandı → yayımla.
    const table = targetType === 'post' ? 'posts' : 'post_comments'
    await admin.from(table).update({ status: 'published' }).eq('id', targetId).eq('status', 'pending')
    // Varsa önceki AI şikayetini temizle (tekrar denemede onaylandıysa).
    await admin.from('content_reports').delete()
      .eq('target_type', targetType).eq('target_id', targetId).eq('source', 'ai')
  } else {
    // Bloke → pending kalır + sistem şikayeti (en yüksek riskli kategori).
    const topCat: Category = cats.length
      ? cats.reduce((a, b) => (riskForCategory(b) > riskForCategory(a) ? b : a))
      : 'other'
    await writeAiReport(admin, targetType, targetId, `ai:${topCat}`, riskForCategory(topCat))
  }

  // Nihai karar verildi → kuyruğu kapat.
  await admin.from('moderation_queue').update({ status: 'done' })
    .eq('target_type', targetType).eq('target_id', targetId)

  return json({
    allow: parsed.allow && cats.length === 0,
    categories: cats,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
  })
})
