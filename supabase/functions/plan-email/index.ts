// plan-email — G42-S1 md.6: kayıttan sonra kişisel planın ÖZETİ (hizmet/işlem e-postası; kampanya içeriği YOK).
// DURUM: YALNIZ DOSYA — deploy edilmedi (LOG "DEPLOY GEREKİR"). Deploy edilene kadar istemci çağrısı 404 alır
// ve uygulama "Planın e-posta adresine gönderildi" bandını GÖSTERMEZ.
//
// Güvenlik: çağıranın JWT'si doğrulanır; plan değerleri istemciden ALINMAZ, sunucuda
// user_nutrition_profiles.personal_plan (G34 kolonu) okunur. Alıcı = auth kullanıcısının e-postası
// (Apple "e-postamı gizle" röle adresi dahil). Gövde: { lang?: 'tr' | 'en' }.
// Altyapı: mevcut Resend + _shared/email-templates (notify-order-status ile aynı gönderici).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { layout, highlightCard, escapeHtml } from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'KCAL <hello@eatkcal.com>';

const T = {
  tr: {
    subject: 'Kişisel planın hazır',
    pre: 'Günlük hedefin ve öğün dağılımın',
    hello: 'Planın hazır.',
    daily: 'Günlük hedef',
    protein: 'Protein',
    carbs: 'Karbonhidrat',
    fat: 'Yağ',
    meals: 'Öğün sayısı',
    note: 'Değerler tahminidir; kişiden kişiye değişir ve diyetisyen onayıyla kesinleşir. Planını uygulamada Profil › Kişisel planım bölümünden görebilir ve değiştirebilirsin.',
  },
  en: {
    subject: 'Your personal plan is ready',
    pre: 'Your daily target and meal split',
    hello: 'Your plan is ready.',
    daily: 'Daily target',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    meals: 'Meals a day',
    note: 'Values are estimates; they vary from person to person and are finalised with dietitian approval. You can view and change your plan in the app under Profile › My personal plan.',
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!RESEND_API_KEY) return new Response('CONFIG_MISSING', { status: 500, headers: corsHeaders });

  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  const user = u?.user;
  if (!user) return new Response('UNAUTHORIZED', { status: 401, headers: corsHeaders });
  if (!user.email) return new Response(JSON.stringify({ sent: false, reason: 'no_email' }), { status: 200, headers: corsHeaders });

  let lang: 'tr' | 'en' = 'tr';
  try {
    const body = await req.json();
    if (body?.lang === 'en') lang = 'en';
  } catch {
    /* gövde yok */
  }
  const tx = T[lang];

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  // Ayar kapalıysa gönderme (app_settings.kayit_plan_email_enabled).
  const { data: setting } = await admin.from('app_settings').select('value').eq('key', 'kayit_plan_email_enabled').maybeSingle();
  if (setting && setting.value === false) return new Response(JSON.stringify({ sent: false, reason: 'disabled' }), { status: 200, headers: corsHeaders });

  const { data: row } = await admin
    .from('user_nutrition_profiles')
    .select('target_calories, target_protein, target_carbs, target_fat, personal_plan')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!row?.target_calories) return new Response(JSON.stringify({ sent: false, reason: 'no_plan' }), { status: 200, headers: corsHeaders });

  const plan = (row.personal_plan ?? {}) as { kayit?: { meals?: number } };
  const kcal = Math.round(Number(row.target_calories));
  const fmt = (n: number) => (lang === 'tr' ? n.toLocaleString('tr-TR') : n.toLocaleString('en-US'));
  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:600;letter-spacing:-0.5px;color:#FFFFFF;">${escapeHtml(tx.hello)}</h1>
    ${highlightCard(tx.daily, `${fmt(kcal)} kcal`)}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.75);font-size:14px;">${escapeHtml(tx.protein)}</td><td style="text-align:right;color:#FFFFFF;font-size:14px;">${Math.round(Number(row.target_protein ?? 0))} g</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.75);font-size:14px;">${escapeHtml(tx.carbs)}</td><td style="text-align:right;color:#FFFFFF;font-size:14px;">${Math.round(Number(row.target_carbs ?? 0))} g</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.75);font-size:14px;">${escapeHtml(tx.fat)}</td><td style="text-align:right;color:#FFFFFF;font-size:14px;">${Math.round(Number(row.target_fat ?? 0))} g</td></tr>
      ${plan.kayit?.meals ? `<tr><td style="padding:8px 0;color:rgba(255,255,255,0.75);font-size:14px;">${escapeHtml(tx.meals)}</td><td style="text-align:right;color:#FFFFFF;font-size:14px;">${Number(plan.kayit.meals)}</td></tr>` : ''}
    </table>
    <p style="margin:0;color:rgba(255,255,255,0.6);font-size:13px;line-height:20px;">${escapeHtml(tx.note)}</p>`;

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: user.email,
    subject: tx.subject,
    html: layout({ preheader: tx.pre, body, recipientEmail: user.email }),
  });
  if (error) {
    console.error('[plan-email] send failed', error.message);
    return new Response(JSON.stringify({ sent: false, reason: 'send_failed' }), { status: 502, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ sent: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
