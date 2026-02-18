import { validateCampaignCoupon } from './coupon-utils.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method !== 'POST') {
    res.status(405).json({ valid: false, message: 'Method not allowed' });
    return;
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    res.status(400).json({ valid: false, message: 'Invalid JSON body' });
    return;
  }

  const code = String(body.code || '').trim();
  const cartSubtotal = Number(body.cart_subtotal || 0);

  if (!code) {
    res.status(400).json({ valid: false, message: 'Kupon kodu gerekli.' });
    return;
  }

  const result = await validateCampaignCoupon({ code, cartSubtotal });
  const statusCode = result.valid ? 200 : 200;
  res.status(statusCode).json(result);
}
