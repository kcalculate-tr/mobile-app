// D-S1 PGlite — bölüm 3: gece mutabakatı zamanlaması + webhook sağlık alarmı.
// d_s1.check.mjs tarafından yüklenir (tek başına çalışmaz).
export default async function (db, { check, expectError, asRole }) {
  console.log('\n[3] Cron + webhook sağlık alarmı');

  const jobs = (await db.query(`select jobname, schedule, command from cron.job where jobname like 'adisyo-%' order by 1`)).rows;
  check('cron: 2 iş (2 koşudan sonra çift yok)', jobs.length === 2, JSON.stringify(jobs));
  check('cron: gece 01:00 UTC = 04:00 İstanbul', jobs.find((j) => j.jobname === 'adisyo-reconcile-nightly')?.schedule === '0 1 * * *');
  check('cron: sağlık 15 dk', jobs.find((j) => j.jobname === 'adisyo-webhook-health')?.schedule === '*/15 * * * *');

  const cfg = (await db.query(`select value from public.app_settings where key = 'adisyo_reconcile'`)).rows[0]?.value;
  check('reconcile ayarı: liste uç noktası varsayılan KAPALI', cfg && cfg.list_endpoint_enabled === false);

  const decide = async (now, last, extra = {}) => (await db.query(
    `select public.adisyo_webhook_health_decide($1::timestamptz, $2::timestamptz,
       (select value from public.app_settings where key = 'adisyo_webhook_health') || $3::jsonb) d`,
    [now, last, JSON.stringify(extra)])).rows[0].d;

  // İstanbul = UTC+3
  let d = await decide('2026-11-09T07:00:00Z', '2026-11-09T06:00:00Z');   // 10:00 İst, 60 dk
  check('karar: 60 dk → ok', d.alert === false && d.reason === 'ok', JSON.stringify(d));
  d = await decide('2026-11-09T08:00:00Z', '2026-11-09T06:00:00Z');       // 11:00 İst, 120 dk
  check('karar: 120 dk → alarm', d.alert === true && d.reason === 'silent' && d.gap_minutes === 120, JSON.stringify(d));
  d = await decide('2026-11-09T06:45:00Z', '2026-11-08T18:00:00Z');       // 09:45 İst, dün akşamdan beri
  check('karar: sabah açılıştan 45 dk → ok (gece sayılmaz)', d.alert === false && d.reason === 'ok', JSON.stringify(d));
  d = await decide('2026-11-09T07:31:00Z', '2026-11-08T18:00:00Z');       // 10:31 İst
  check('karar: açılıştan 91 dk → alarm', d.alert === true, JSON.stringify(d));
  d = await decide('2026-11-09T19:00:00Z', '2026-11-09T10:00:00Z');       // 22:00 İst
  check('karar: kapalı saat → closed', d.alert === false && d.reason === 'closed', JSON.stringify(d));
  d = await decide('2026-11-09T03:00:00Z', null);                          // 06:00 İst
  check('karar: hiç olay yok, kapalı → closed', d.reason === 'closed');
  d = await decide('2026-11-09T08:00:00Z', null);                          // 11:00 İst, hiç olay yok
  check('karar: hiç olay yok, açık → alarm (anahtar none)', d.alert === true && d.alert_key === 'none', JSON.stringify(d));
  d = await decide('2026-11-09T08:00:00Z', '2026-11-09T06:00:00Z', { enabled: false });
  check('karar: kapatılmış → disabled', d.reason === 'disabled');
  d = await decide('2026-11-09T08:00:00Z', '2026-11-09T06:00:00Z', { max_gap_minutes: 180 });
  check('karar: eşik ayarı 180 dk → ok', d.reason === 'ok');

  // Uçtan uca: tek uyarı + sıfırlanma
  await db.exec(`insert into vault.decrypted_secrets (name, decrypted_secret) values ('service_role_key', 'test-key') on conflict do nothing;
                 delete from net.calls;
                 insert into public.adisyo_webhook_events (event_id, event_type, raw_payload, signature_valid, received_at)
                 values ('h1', 'order.updated', '{}', true, '2026-11-09T06:00:00Z'),
                        ('h0', 'order.updated', '{}', false, '2026-11-09T06:05:00Z');`);
  let r = (await db.query(`select public.fn_adisyo_webhook_health_check('2026-11-09T08:00:00Z') r`)).rows[0].r;
  const calls = (await db.query(`select url, body from net.calls`)).rows;
  check('kontrol: alarm gönderildi', r.sent === true && calls.length === 1, JSON.stringify(r));
  check('kontrol: order-alert webhook_health gövdesi', calls[0]?.url.endsWith('/functions/v1/order-alert') && calls[0]?.body.type === 'webhook_health'
    && calls[0]?.body.last_valid_at && new Date(calls[0].body.last_valid_at).toISOString() === '2026-11-09T06:00:00.000Z', JSON.stringify(calls[0]?.body));
  check('kontrol: son olay = imzasız olay da sayılır', new Date(r.last_event_at).toISOString() === '2026-11-09T06:05:00.000Z');
  r = (await db.query(`select public.fn_adisyo_webhook_health_check('2026-11-09T08:15:00Z') r`)).rows[0].r;
  check('kontrol: aynı kesintide ikinci uyarı YOK', r.reason === 'already_alerted' && (await db.query(`select count(*)::int c from net.calls`)).rows[0].c === 1);
  r = (await db.query(`select public.fn_adisyo_webhook_health_check('2026-11-10T08:00:00Z') r`)).rows[0].r;
  check('kontrol: ertesi gün aynı kesinti → yine uyarı yok', r.reason === 'already_alerted');
  await db.exec(`insert into public.adisyo_webhook_events (event_id, event_type, raw_payload, signature_valid, received_at)
                 values ('h2', 'order.updated', '{}', true, '2026-11-10T08:30:00Z')`);
  r = (await db.query(`select public.fn_adisyo_webhook_health_check('2026-11-10T08:45:00Z') r`)).rows[0].r;
  check('kontrol: olay gelince ok', r.reason === 'ok');
  r = (await db.query(`select public.fn_adisyo_webhook_health_check('2026-11-10T10:30:00Z') r`)).rows[0].r;
  check('kontrol: yeni kesinti → yeni tek uyarı', r.sent === true && (await db.query(`select count(*)::int c from net.calls`)).rows[0].c === 2);

  // Anahtar yoksa gönderilmez, durum işaretlenmez
  await db.exec(`delete from vault.decrypted_secrets; delete from net.calls;
                 update public.app_settings set value = value || '{"last_alert_for": null}' where key = 'adisyo_webhook_health';`);
  r = (await db.query(`select public.fn_adisyo_webhook_health_check('2026-11-10T12:30:00Z') r`)).rows[0].r;
  check('kontrol: Vault anahtarı yoksa sent=false', r.sent === false && r.error === 'no_service_key');
  const st = (await db.query(`select value->>'last_alert_for' k from public.app_settings where key = 'adisyo_webhook_health'`)).rows[0].k;
  check('kontrol: gönderilemeyen uyarı işaretlenmez (sonra tekrar dener)', st === null);

  // Gece tetikleyici
  await db.exec(`insert into vault.decrypted_secrets values ('service_role_key', 'test-key'); delete from net.calls;`);
  await db.query(`select public.fn_adisyo_reconcile_kick()`);
  const k = (await db.query(`select url, headers from net.calls`)).rows;
  check('tetikleyici: adisyo-reconcile + Bearer', k.length === 1 && k[0].url.endsWith('/functions/v1/adisyo-reconcile') && k[0].headers.Authorization === 'Bearer test-key');

  await asRole(db, 'authenticated', null, () =>
    expectError(db, 'authenticated sağlık fonksiyonunu çağıramaz', `select public.fn_adisyo_webhook_health_check()`, [], /permission/));
  await db.exec(`delete from public.adisyo_webhook_events where event_id in ('h0','h1','h2'); delete from net.calls; delete from vault.decrypted_secrets;`);
}
