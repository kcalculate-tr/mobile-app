import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    const asForm = new URLSearchParams(req.body);
    if (asForm.has('merchant_oid')) {
      return Object.fromEntries(asForm.entries());
    }
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf-8');
    const asForm = new URLSearchParams(raw);
    return Object.fromEntries(asForm.entries());
  }
  return req.body;
}

function mapOrderStatus(paytrStatus) {
  const normalized = String(paytrStatus || '').trim().toLowerCase();
  if (normalized === 'success') return 'pending';
  if (normalized === 'failed') return 'cancelled';
  return 'pending';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!merchantKey || !merchantSalt) {
    console.error('PayTR callback config missing merchant key/salt');
    res.status(500).send('Config Error');
    return;
  }

  const body = readBody(req);
  const merchantOid = String(body.merchant_oid || '');
  const status = String(body.status || '');
  const totalAmount = String(body.total_amount || '');
  const callbackHash = String(body.hash || '');

  if (!merchantOid || !status || !totalAmount || !callbackHash) {
    console.error('PayTR callback missing fields', body);
    res.status(400).send('Bad Request');
    return;
  }

  const computedHash = crypto
    .createHmac('sha256', merchantKey)
    .update(merchantOid + merchantSalt + status + totalAmount)
    .digest('base64');

  if (computedHash !== callbackHash) {
    console.error('PayTR callback hash mismatch', { merchantOid, status });
    res.status(400).send('Bad Hash');
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase service role config missing in callback');
    res.status(500).send('Config Error');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const nextStatus = mapOrderStatus(status);

    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('paytr_oid', merchantOid);

    if (error) {
      console.error('PayTR callback order update error', error);
      res.status(500).send('Update Error');
      return;
    }

    console.log('PayTR callback OK', { merchantOid, status, totalAmount });
    res.status(200).send('OK');
  } catch (err) {
    console.error('PayTR callback unexpected error', err);
    res.status(500).send('Server Error');
  }
}
