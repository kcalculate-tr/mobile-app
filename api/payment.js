import crypto from 'crypto';
import https from 'https';
import querystring from 'querystring';
import { validateCampaignCoupon } from './coupon-utils.js';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getClientIp(req) {
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        '127.0.0.1';

    // PayTR için localhost/IPv6 loopback yerine IPv4 fallback kullan.
    if (!rawIp || rawIp === '::1' || rawIp === '::ffff:127.0.0.1') return '127.0.0.1';
    return rawIp;
}

function getRequestOrigin(req) {
    const forwardedProtoRaw = req.headers['x-forwarded-proto'];
    const forwardedProto = Array.isArray(forwardedProtoRaw)
        ? forwardedProtoRaw[0]
        : (forwardedProtoRaw || '').split(',')[0].trim();
    const proto = forwardedProto || 'https';

    const forwardedHostRaw = req.headers['x-forwarded-host'];
    const host = Array.isArray(forwardedHostRaw)
        ? forwardedHostRaw[0]
        : (forwardedHostRaw || req.headers.host || '').split(',')[0].trim();

    if (!host) return 'https://kcal-final.vercel.app';
    return `${proto}://${host}`;
}

function resolveReturnUrl(urlCandidate, fallbackPath, requestOrigin) {
    if (urlCandidate && String(urlCandidate).trim()) {
        try {
            return new URL(String(urlCandidate)).toString();
        } catch {
            // Geçersiz URL gelirse aşağıdaki fallback çalışır.
        }
    }
    return `${requestOrigin}${fallbackPath}`;
}

function isLocalUrl(urlString) {
    try {
        const parsed = new URL(String(urlString || ''));
        const host = parsed.hostname.toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    } catch {
        return false;
    }
}

function normalizePhone(phoneRaw) {
    const digits = String(phoneRaw || '').replace(/\D/g, '');
    if (!digits) return '05551234567';
    if (digits.length >= 10) return digits.slice(-11);
    return digits;
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    const publicBaseUrl = String(process.env.PAYTR_PUBLIC_BASE_URL || '').trim();

    // ŞURAYA EKLE: Vercel Loglarında hangisinin boş olduğunu göreceğiz
    console.log("--- PAYTR CONFIG KONTROL ---");
    console.log("ID:", merchant_id ? "Dolu" : "EKSIK!");
    console.log("KEY:", merchant_key ? "Dolu" : "EKSIK!");
    console.log("SALT:", merchant_salt ? "Dolu" : "EKSIK!");

    if (!merchant_id || !merchant_key || !merchant_salt) {
        res.status(500).json({ error: 'PayTR credentials not configured (PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT)' });
        return;
    }

    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
    }

    const {
        user_basket,
        total_amount,
        merchant_oid: body_merchant_oid,
        email = 'musteri@example.com',
        user_name = 'Ad Soyad',
        user_address = 'Adres',
        user_phone = '05551234567',
        merchant_ok_url,
        merchant_fail_url,
        coupon_code,
        cart_subtotal,
        delivery_fee,
    } = body;

    if (!user_basket || total_amount == null) {
        res.status(400).json({ error: 'user_basket and total_amount required' });
        return;
    }

    const user_ip = getClientIp(req);
    const baseSubtotal = Number.isFinite(Number(cart_subtotal))
        ? Math.max(0, Number(cart_subtotal))
        : Math.max(0, Number(total_amount || 0));
    const normalizedDeliveryFee = Number.isFinite(Number(delivery_fee))
        ? Math.max(0, Number(delivery_fee))
        : 0;

    let discountAmount = 0;
    let validatedCoupon = null;

    if (coupon_code && String(coupon_code).trim()) {
        const couponResult = await validateCampaignCoupon({
            code: String(coupon_code).trim(),
            cartSubtotal: baseSubtotal,
        });

        if (!couponResult.valid) {
            res.status(400).json({ error: couponResult.message || 'Kupon doğrulanamadı.' });
            return;
        }

        validatedCoupon = couponResult.campaign;
        discountAmount = Number(couponResult.discountAmount || 0);
    }

    const finalSubtotal = Math.max(0, baseSubtotal - discountAmount);
    const finalTotal = Math.max(0, finalSubtotal + normalizedDeliveryFee);
    const payment_amount = String(Math.round(finalTotal * 100));
    const normalizedMerchantOid = body_merchant_oid && String(body_merchant_oid).trim()
        ? String(body_merchant_oid).replace(/[^a-zA-Z0-9]/g, '').trim()
        : '';
    const merchant_oid = normalizedMerchantOid || ('KCAL' + Date.now());
    const requestOrigin = getRequestOrigin(req);
    const resolvedRequestOrigin = (!requestOrigin || isLocalUrl(requestOrigin))
        ? (publicBaseUrl || 'https://kcal-final.vercel.app')
        : requestOrigin;

    let ok_url = resolveReturnUrl(merchant_ok_url, '/success', resolvedRequestOrigin);
    let fail_url = resolveReturnUrl(merchant_fail_url, '/fail', resolvedRequestOrigin);

    // Frontend localhost URL gönderirse PayTR token reddedebilir.
    if (isLocalUrl(ok_url)) ok_url = resolveReturnUrl('', '/success', publicBaseUrl || 'https://kcal-final.vercel.app');
    if (isLocalUrl(fail_url)) fail_url = resolveReturnUrl('', '/fail', publicBaseUrl || 'https://kcal-final.vercel.app');

    console.log('PAYTR return URLs', { ok_url, fail_url, requestOrigin });

    const basketEncoded = Buffer.from(
        typeof user_basket === 'string' ? user_basket : JSON.stringify(user_basket)
    ).toString('base64');

    const no_installment = 0;
    const max_installment = 0;
    const currency = 'TL';
    const test_mode = process.env.PAYTR_TEST_MODE === '0' ? 0 : 1;
    const debug_on = 1;
    const timeout_limit = '30';

    const hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + basketEncoded + no_installment + max_installment + currency + test_mode;
    const paytr_token = crypto.createHmac('sha256', merchant_key).update(hash_str + merchant_salt).digest('base64');

    const post_vals = querystring.stringify({
        merchant_id,
        user_ip,
        merchant_oid,
        email,
        payment_amount,
        paytr_token,
        user_basket: basketEncoded,
        debug_on,
        no_installment,
        max_installment,
        user_name,
        user_address,
        user_phone: normalizePhone(user_phone),
        merchant_ok_url: ok_url,
        merchant_fail_url: fail_url,
        timeout_limit,
        currency,
        test_mode,
    });

    const options = {
        hostname: 'www.paytr.com',
        path: '/odeme/api/get-token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(post_vals),
        },
    };

    const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.status === 'success') {
                    res.status(200).json({
                        token: result.token,
                        final_total: Number(finalTotal.toFixed(2)),
                        discount_amount: Number(discountAmount.toFixed(2)),
                        coupon: validatedCoupon,
                    });
                } else {
                    console.error('PayTR token error:', result);
                    res.status(400).json({
                        error: result.reason || 'PayTR error',
                        paytr_status: result.status || 'failed',
                    });
                }
            } catch {
                res.status(502).json({ error: 'Invalid response from payment provider' });
            }
        });
    });

    proxyReq.on('error', () => {
        res.status(502).json({ error: 'Payment service unavailable' });
    });

    proxyReq.write(post_vals);
    proxyReq.end();
}
