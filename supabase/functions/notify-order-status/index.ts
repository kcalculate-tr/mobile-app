// notify-order-status — order status değişikliklerinde KCAL temalı mail gönderir.
// Çağrılış: { order_id: number|string, event: 'on_way' | 'delivered' }
// Branch panel'den (markOnWay / markDelivered handler'larında) supabase.functions.invoke ile çağrılır.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';
import { layout, highlightCard, button, escapeHtml } from '../_shared/email-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'KCAL <hello@eatkcal.com>';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!RESEND_API_KEY) {
    console.error('[notify-order-status] RESEND_API_KEY missing');
    return new Response('CONFIG_MISSING', { status: 500, headers: corsHeaders });
  }

  try {
    const { order_id, event } = await req.json();
    if (!order_id || !event) {
      return new Response('MISSING_FIELDS', { status: 400, headers: corsHeaders });
    }
    if (event !== 'on_way' && event !== 'delivered') {
      return new Response('UNKNOWN_EVENT', { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_code, user_id')
      .eq('id', order_id)
      .maybeSingle();

    if (orderErr || !order) {
      console.error('[notify-order-status] order not found', order_id, orderErr?.message);
      return new Response('ORDER_NOT_FOUND', { status: 404, headers: corsHeaders });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', order.user_id)
      .maybeSingle();

    const { data: userRes } = await supabase.auth.admin.getUserById(order.user_id);
    const recipientEmail = userRes?.user?.email;
    if (!recipientEmail) {
      console.warn('[notify-order-status] no email for user', order.user_id);
      return new Response('NO_RECIPIENT', { status: 200, headers: corsHeaders });
    }

    const firstName = profile?.first_name ?? 'merhaba';
    const orderCode = order.order_code ?? `#${order.id}`;

    const resend = new Resend(RESEND_API_KEY);
    let subject = '';
    let html = '';

    if (event === 'on_way') {
      subject = `Siparişin yola çıktı — ${orderCode}`;
      html = layout({
        preheader: `Kuryen yolda — ${orderCode}`,
        recipientEmail,
        body: `
          <div style="color:#FFFFFF;font-size:24px;font-weight:500;letter-spacing:-0.8px;margin-bottom:8px;">
            Yolda.
          </div>
          <div style="color:rgba(255,255,255,0.7);font-size:14px;line-height:22px;margin-bottom:32px;">
            Merhaba ${escapeHtml(firstName)}, kuryen siparişini aldı. Yaklaşık <strong style="color:#FFFFFF;">20–30 dakika</strong> içinde kapında olacak.
          </div>
          ${highlightCard('Sipariş kodu', orderCode)}
        `,
      });
    } else {
      subject = `Afiyet olsun — ${orderCode}`;
      html = layout({
        preheader: `Afiyet olsun — siparişin teslim edildi.`,
        recipientEmail,
        body: `
          <div style="color:#FFFFFF;font-size:24px;font-weight:500;letter-spacing:-0.8px;margin-bottom:8px;">
            Afiyet olsun, ${escapeHtml(firstName)}.
          </div>
          <div style="color:rgba(255,255,255,0.7);font-size:14px;line-height:22px;margin-bottom:24px;">
            Siparişin başarıyla teslim edildi. KCAL Tracker'da bu öğünü kaydetmeyi unutma.
          </div>
          ${button('kcal://tracker', "Tracker'ı aç")}
          <div style="color:rgba(255,255,255,0.5);font-size:12px;line-height:20px;padding-top:24px;border-top:1px solid #232323;margin-top:8px;">
            Yemekle ilgili bir sorun mu yaşadın? <a href="mailto:hello@eatkcal.com" style="color:#C8F03C;text-decoration:none;">Bize yaz</a>.
          </div>
        `,
      });
    }

    const { error: sendErr } = await resend.emails.send({
      from: FROM,
      to: recipientEmail,
      subject,
      html,
    });

    if (sendErr) {
      console.error('[notify-order-status] send failed', sendErr);
      return new Response('SEND_FAILED', { status: 500, headers: corsHeaders });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[notify-order-status] error', err);
    return new Response('ERROR', { status: 500, headers: corsHeaders });
  }
});
