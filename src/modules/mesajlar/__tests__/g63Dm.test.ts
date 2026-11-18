// G63-S1 — Mesajlar (DM): istek kuralı, gizli hesap, engel iki yön, hız sınırı (sunucu + istemci hatası), okundu,
// silme süresi, bayrak kapalı; migration / rollback / moderate-content sözleşmesi; push metni = sunucu metni; TR-EN.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BODY_MAX,
  DELETE_WINDOW_MS,
  PUSH_SNIPPET,
  RATE,
  applyRealtime,
  badgeText,
  canDeleteMessage,
  canMessage,
  canMessageProfile,
  cleanBody,
  errorKey,
  hasLinkOrPhone,
  previewText,
  rateLimitScope,
  recipientState,
  relTime,
  rpcCode,
  seenMessageId,
  timeline,
  typingAllowed,
} from '../rules';
import { DM_PUSH_TEXT, dmPushBody } from '../push';
import { dmLinkTarget } from '../links';
import { createMockDm } from '../mock';
import type { DmMessage } from '../types';
import { FLAG_DEFAULTS } from '../../../core/flags/registry';
import { tr as g63Tr, en as g63En } from '../../../core/i18n/g63';
import {
  MESSAGE_PROMPT_NOTE,
  messageDecisionStatus,
  messageModerationText,
  messageNeedsModeration,
} from '../../../../supabase/functions/moderate-content/message';

const ROOT = join(__dirname, '../../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const SQL = read('supabase/migrations/20261118140100_g63_mesajlar.sql');
const RB = read('supabase/rollbacks/20261118140100_g63_mesajlar_rollback.sql');
const NOW = Date.parse('2026-11-18T12:00:00Z');
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();
const fakeTr = (k: string, v?: Record<string, string | number>) => (v ? `${k}|${Object.entries(v).map(([a, b]) => `${a}=${b}`).join(',')}` : k);

function msg(p: Partial<DmMessage> & { id: string; at: number }): DmMessage {
  return { conversation_id: 'c1', sender_id: p.mine ? 'me' : 'u2', mine: false, body: 'x', kind: 'text', ref: null, status: 'sent', created_at: iso(p.at), ...p };
}

// ─── Saf kurallar ──────────────────────────────────────────────────────────────
test('canMessage: sunucuyla aynı sıra — kendine → bulunamadı → engel → gizli hesap', () => {
  const ok = { self: false, exists: true, blocked: false, recipientPrivate: false, iFollow: false };
  assert.equal(canMessage(ok), null);
  assert.equal(canMessage({ ...ok, self: true, blocked: true }), 'kendine');
  assert.equal(canMessage({ ...ok, exists: false }), 'bulunamadi');
  assert.equal(canMessage({ ...ok, blocked: true, recipientPrivate: true }), 'engel');
  assert.equal(canMessage({ ...ok, recipientPrivate: true }), 'gizli_hesap');
  assert.equal(canMessage({ ...ok, recipientPrivate: true, iFollow: true }), null, 'gizli hesabın takipçisi yazabilir');
  // SQL aynı sırayı taşıyor
  const fn = SQL.slice(SQL.indexOf('function public.dm_can_message'), SQL.indexOf('function public.dm_person_json'));
  const order = [
    "when p_sender = p_recipient then 'kendine'",
    "where pr.id = p_recipient) then 'bulunamadi'",
    "then 'engel'",
    "then 'gizli_hesap'",
  ].map((k) => fn.indexOf(k));
  assert.ok(order.every((x) => x > 0) && order.every((x, i) => i === 0 || x > order[i - 1]), 'dm_can_message sırası');
});

test('istek kuralı: karşılıklı takip yoksa alıcı "request"', () => {
  assert.equal(recipientState({ iFollow: true, followsMe: true }), 'active');
  assert.equal(recipientState({ iFollow: true, followsMe: false }), 'request');
  assert.equal(recipientState({ iFollow: false, followsMe: true }), 'request');
  assert.equal(recipientState({ iFollow: false, followsMe: false }), 'request');
  assert.match(SQL, /case when public\.dm_mutual\(v_uid, p_user\) then 'active' else 'request' end/);
});

test('hız sınırı: dakikada 20 mesaj, günde 30 yeni istek (istemci = sunucu sabitleri)', () => {
  assert.deepEqual(RATE, { perMinute: 20, requestsPerDay: 30 });
  assert.equal(rateLimitScope({ sentLastMinute: 19, requestsToday: 0, isNewRequest: false }), null);
  assert.equal(rateLimitScope({ sentLastMinute: 20, requestsToday: 0, isNewRequest: false }), 'minute');
  assert.equal(rateLimitScope({ sentLastMinute: 0, requestsToday: 30, isNewRequest: false }), null, 'istek değilse sınır yok');
  assert.equal(rateLimitScope({ sentLastMinute: 0, requestsToday: 30, isNewRequest: true }), 'requests');
  assert.match(SQL, /interval '1 minute'[\s\S]{0,40}\n\s*if v_cnt >= 20 then/);
  assert.match(SQL, /if v_cnt >= 30 then\s*\n\s*return jsonb_build_object\('error', 'rate_limited', 'scope', 'requests'\)/);
  assert.match(SQL, /'Europe\/Istanbul'/);
  // istemci hatası: kapsam → doğru metin
  assert.equal(errorKey('rate_limited', 'minute'), 'dm.err.rate_minute');
  assert.equal(errorKey('rate_limited', 'requests'), 'dm.err.rate_requests');
});

test('okundu: yalnız receipts (iki taraf aktif) açıkken ve son mesaj benimse', () => {
  const list = [msg({ id: 'a', at: NOW - 5 * MIN }), msg({ id: 'b', at: NOW - 2 * MIN, mine: true })];
  assert.equal(seenMessageId({ receipts: false, other_last_read_at: iso(NOW) }, list), null, 'istekte okundu yok');
  assert.equal(seenMessageId({ receipts: true, other_last_read_at: null }, list), null);
  assert.equal(seenMessageId({ receipts: true, other_last_read_at: iso(NOW - 3 * MIN) }, list), null, 'okunmadan önce');
  assert.equal(seenMessageId({ receipts: true, other_last_read_at: iso(NOW - MIN) }, list), 'b');
  assert.equal(seenMessageId({ receipts: true, other_last_read_at: iso(NOW) }, [...list, msg({ id: 'c', at: NOW - 30_000 })]), null, 'karşı taraf sonra yazdı');
  assert.equal(typingAllowed({ receipts: false }), false);
  assert.equal(typingAllowed({ receipts: true }), true);
  assert.match(SQL, /'other_last_read_at', case when v_me\.state = 'active' and v_om\.state = 'active' then v_om\.last_read_at end/);
  assert.match(SQL, /'receipts',\s+v_other is not null and v_me\.state = 'active' and v_om\.state = 'active'/);
});

test('silme: yalnız kendi mesajın, 15 dk içinde', () => {
  assert.equal(DELETE_WINDOW_MS, 15 * MIN);
  const mine = { mine: true, created_at: iso(NOW - 14 * MIN) };
  assert.equal(canDeleteMessage(mine, NOW), true);
  assert.equal(canDeleteMessage({ ...mine, created_at: iso(NOW - 15 * MIN) }, NOW), false);
  assert.equal(canDeleteMessage({ ...mine, mine: false }, NOW), false);
  assert.equal(canDeleteMessage({ ...mine, local: 'sending' }, NOW), false);
  assert.match(SQL, /if v_msg\.created_at < now\(\) - interval '15 minutes' then raise exception 'sure_doldu'/);
  assert.match(SQL, /v_msg\.sender_id is distinct from v_uid/);
  assert.equal(errorKey('sure_doldu'), 'dm.err.delete_window');
});

test('istek güvenliği: bağlantı / telefon algılama', () => {
  for (const s of ['https://x.co/a', 'www.ornek.com', 'bak: ornek.com/kampanya', 'ara 0532 123 45 67', '+90 (532) 123-4567']) assert.equal(hasLinkOrPhone(s), true, s);
  for (const s of ['Merhaba, meal prep kutularını nereden alıyorsun?', '520 kcal, 2 porsiyon', 'Saat 12.30 gibi', '', null]) assert.equal(hasLinkOrPhone(s), false, String(s));
});

test('hata kodları nötr metne düşer; rpcCode ayıklar', () => {
  assert.equal(rpcCode(new Error('dm_send: engel')), 'engel');
  assert.equal(rpcCode(new Error('dm_open: gizli_hesap')), 'gizli_hesap');
  assert.equal(errorKey('engel'), 'dm.err.blocked');
  assert.equal(errorKey('bulunamadi'), 'dm.err.blocked', 'engel bilgisi sızmaz');
  assert.equal(errorKey('gizli_hesap'), 'dm.err.private');
  assert.equal(errorKey('blocked'), 'dm.err.not_sent', 'denetimde engellenen → nötr');
  assert.equal(errorKey('kapali'), 'dm.err.closed');
  assert.equal(errorKey('baska'), 'dm.err.generic');
  assert.equal(cleanBody('  a  '), 'a');
  assert.equal(cleanBody('x'.repeat(1200)).length, BODY_MAX);
  assert.equal(badgeText(3), '3');
  assert.equal(badgeText(12), '9+');
});

test('önizleme + göreli zaman (FinInbox biçimi)', () => {
  const last = (p: Partial<DmMessage>) => ({ last: { ...msg({ id: 'm', at: NOW }), ...p } });
  assert.equal(previewText(last({ body: 'Selam' }), fakeTr), 'Selam');
  assert.equal(previewText(last({ body: 'Selam', mine: true }), fakeTr), 'dm.preview.you|text=Selam');
  assert.equal(previewText(last({ body: null, kind: 'post' }), fakeTr), 'dm.preview.post');
  assert.equal(previewText(last({ body: 'Süper', kind: 'story_reply' }), fakeTr), 'dm.preview.story_reply|text=Süper');
  assert.equal(previewText({ last: null }, fakeTr), '');
  assert.equal(relTime(iso(NOW - 5 * MIN), NOW, fakeTr), 'dm.time.min|n=5');
  assert.equal(relTime(iso(NOW - 30_000), NOW, fakeTr), 'dm.time.now');
});

test('zaman çizelgesi: gün çipi + gruplama', () => {
  const rows = timeline([
    msg({ id: '1', at: NOW - 10 * MIN }),
    msg({ id: '2', at: NOW - 9 * MIN }),
    msg({ id: '3', at: NOW - 8 * MIN, mine: true }),
    msg({ id: '4', at: NOW + 2 * 60 * MIN, mine: true }),
  ]);
  assert.deepEqual(rows.map((r) => (r.type === 'chip' ? 'chip' : `${r.msg.id}${r.first ? 'F' : ''}${r.last ? 'L' : ''}`)), ['chip', '1F', '2L', '3FL', 'chip', '4FL']);
});

test('Realtime: karşı tarafın pending/blocked mesajı görünmez, silinen düşer, sent eklenir', () => {
  const base = [msg({ id: 'a', at: NOW - MIN })];
  const row = (p: object) => ({ id: 'n', conversation_id: 'c1', sender_id: 'u2', body: 'hi', kind: 'text' as const, ref: null, status: 'sent' as const, created_at: iso(NOW), deleted_at: null, ...p });
  assert.equal(applyRealtime(base, { type: 'insert', row: row({ status: 'pending' }) }, 'me').length, 1);
  assert.equal(applyRealtime(base, { type: 'update', row: row({ status: 'blocked' }) }, 'me').length, 1);
  const added = applyRealtime(base, { type: 'update', row: row({}) }, 'me');
  assert.equal(added.length, 2);
  assert.equal(added[1].mine, false);
  assert.equal(applyRealtime(added, { type: 'update', row: row({ deleted_at: iso(NOW) }) }, 'me').length, 1);
  const mine = applyRealtime(base, { type: 'insert', row: row({ sender_id: 'me', status: 'pending' }) }, 'me');
  assert.equal(mine[1].mine, true, 'kendi pending mesajım kalır');
});

test('PublicProfile "Mesaj": gizli hesapta yalnız takipçi', () => {
  assert.equal(canMessageProfile({ is_private: false, me_following: 'none' }), true);
  assert.equal(canMessageProfile({ is_private: true, me_following: 'requested' }), false);
  assert.equal(canMessageProfile({ is_private: true, me_following: 'following' }), true);
});

test('push derin bağlantısı kcal://dm/<uuid>', () => {
  assert.deepEqual(dmLinkTarget('kcal://dm/0B5C2E1A-1111-4222-8333-444455556666'), { conversationId: '0b5c2e1a-1111-4222-8333-444455556666' });
  assert.equal(dmLinkTarget('kcal://dm/abc'), null);
  assert.equal(dmLinkTarget('kcal://p/0b5c2e1a-1111-4222-8333-444455556666'), null);
  assert.ok(read('src/lib/navigation.ts').includes('dmLinkTarget(target)'));
  assert.ok(read('src/navigation/linking.ts').includes("DmChat: 'dm/:conversationId'"));
});

// ─── Push metni: kod sabiti = sunucu ──────────────────────────────────────────
test('push metni: "%{ad}: %{ilk 60}" ve "%{ad} sana mesaj göndermek istiyor" — SQL ile birebir', () => {
  assert.equal(PUSH_SNIPPET, 60);
  assert.equal(dmPushBody({ name: 'Ayşe', body: 'Merhaba', kind: 'text', request: false }), 'Ayşe: Merhaba');
  assert.equal(dmPushBody({ name: 'Ayşe', body: 'x'.repeat(80), kind: 'text', request: false }), `Ayşe: ${'x'.repeat(60)}`);
  assert.equal(dmPushBody({ name: 'Ayşe', body: 'Merhaba', kind: 'text', request: true }), 'Ayşe sana mesaj göndermek istiyor');
  assert.equal(dmPushBody({ name: 'Ayşe', body: null, kind: 'post', request: false }), 'Ayşe: Bir gönderi paylaştı');
  assert.ok(SQL.includes(`v_body := v_name || ' sana mesaj göndermek istiyor';`));
  assert.ok(SQL.includes(`v_body := v_name || ': ' || v_snip;`));
  assert.ok(SQL.includes('v_snip := left(v_snip, 60);'));
  for (const [k, v] of Object.entries(DM_PUSH_TEXT.fallback)) {
    if (k === 'text') assert.ok(SQL.includes(`else '${v}'`));
    else assert.ok(SQL.includes(`when '${k}' then '${v}'`), k);
  }
  assert.ok(SQL.includes(`'deep_link', '${DM_PUSH_TEXT.deepLinkPrefix}' || NEW.conversation_id::text`));
  assert.ok(SQL.includes(`'title', '${DM_PUSH_TEXT.title}'`));
});

// ─── Bayrak kapalı ─────────────────────────────────────────────────────────────
test('bayrak: yerelde false, migration KAPALI ekler; her RPC ve push bayrağı denetler', () => {
  assert.equal(FLAG_DEFAULTS.mesajlar, false);
  assert.match(SQL, /'mesajlar', false, 0, '1\.1\.0'/);
  assert.match(SQL, /on conflict \(key\) do nothing/);
  const rpcs = ['dm_open', 'dm_send', 'dm_inbox', 'dm_thread', 'dm_mark_read', 'dm_accept_request', 'dm_decline_request', 'dm_leave', 'dm_mute', 'dm_delete_message', 'dm_search_people'];
  for (const r of rpcs) {
    const start = SQL.indexOf(`function public.${r}(`);
    assert.ok(start > 0, r);
    const body = SQL.slice(start, SQL.indexOf('$$;', start));
    assert.ok(body.includes("feed_flag_enabled('mesajlar')"), `${r} bayrak denetimi`);
  }
  const push = SQL.slice(SQL.indexOf('function public.fn_push_dm_message'), SQL.indexOf('trg_push_dm_message'));
  assert.ok(push.includes("if not public.feed_flag_enabled('mesajlar') then\n    return NEW;"), 'bayrak kapalıyken push yok');
  assert.ok(push.includes('and not m.muted'), 'sessize alınana push yok');
  assert.ok(push.includes('not public.feed_is_blocked(m.user_id, NEW.sender_id)'), 'engelliye push yok');
  // İstemci: kapalıyken rotalar kayıtlı değil
  const nav = read('src/navigation/AppNavigator.tsx');
  for (const r of ['DmInbox', 'DmChat', 'DmNew']) assert.ok(nav.includes(`{(mesajlarEnabled || __DEV__) && <Stack.Screen name="${r}"`), r);
});

// ─── Migration sözleşmesi ──────────────────────────────────────────────────────
test('migration: tablolar, RLS (yalnız üyeler okur, yazma politikası yok), Realtime, engel iki yön, gizli hesap', () => {
  for (const t of ['conversations', 'conversation_members', 'messages']) {
    assert.match(SQL, new RegExp(`create table if not exists public\\.${t} \\(`));
    assert.match(SQL, new RegExp(`alter table public\\.${t}\\s+enable row level security`));
  }
  assert.match(SQL, /kind\s+text\s+not null check \(kind in \('1to1', 'group'\)\)/);
  assert.match(SQL, /state\s+text\s+not null default 'active' check \(state in \('active', 'request', 'declined', 'left'\)\)/);
  assert.match(SQL, /body\s+text\s+check \(body is null or char_length\(body\) <= 1000\)/);
  assert.match(SQL, /kind\s+text\s+not null default 'text' check \(kind in \('text', 'post', 'story_reply', 'meal'\)\)/);
  assert.equal(/create policy [a-z_]+ on public\.(messages|conversations|conversation_members)\s+for (insert|update|delete|all)/.test(SQL), false, 'doğrudan yazma politikası yok');
  assert.match(SQL, /create policy messages_select on public\.messages[\s\S]*?public\.dm_can_read\(auth\.uid\(\), conversation_id\)[\s\S]*?not public\.feed_is_blocked\(auth\.uid\(\), sender_id\)/);
  assert.match(SQL, /create policy conversation_members_select[\s\S]*?using \(user_id = auth\.uid\(\)\)/);
  assert.match(SQL, /alter publication supabase_realtime add table public\.messages/);
  // engel: hem gönderim (dm_can_message) hem gelen kutusu/okuma
  assert.match(SQL, /when public\.feed_is_blocked\(p_sender, p_recipient\) then 'engel'/);
  assert.match(SQL, /r\.other_id is null or not public\.feed_is_blocked\(v_uid, r\.other_id\)/);
  assert.match(SQL, /if v_other is not null and public\.feed_is_blocked\(v_uid, v_other\) then raise exception 'engel'/);
  // feed_is_blocked çift yönlü (G6 tanımı)
  const fib = read('supabase/migrations/20261104000200_feed_tables.sql');
  const body = fib.slice(fib.indexOf('function public.feed_is_blocked'), fib.indexOf('function public.feed_is_moderator'));
  assert.ok(/blocker_id = a and blocked_id = b/.test(body) && /blocker_id = b and blocked_id = a/.test(body), 'feed_is_blocked iki yön');
  // moderasyon: metinli mesaj pending + kuyruk; denetimsiz paylaşım doğrudan sent
  assert.match(SQL, /v_status := case when v_body is not null then 'pending' else 'sent' end;/);
  assert.match(SQL, /insert into public\.moderation_queue \(target_type, target_id\)\s*\n\s*values \('message', v_msg\.id\)/);
  // report_content / mod_resolve_report hedefleri
  assert.match(SQL, /p_target_type not in \('post', 'user', 'day_card', 'comment', 'story', 'message', 'conversation'\)/);
  assert.match(SQL, /moderation_queue_target_type_check\s*\n\s*check \(target_type in \('post', 'comment', 'story', 'review', 'message'\)\)/);
  assert.match(SQL, /elsif r\.target_type = 'message' then\s*\n\s*update public\.messages set deleted_at/);
  // yetkiler
  assert.match(SQL, /grant execute on function public\.dm_send\(uuid, text, text, jsonb, text\) to authenticated;/);
  assert.match(SQL, /revoke all on function public\.fn_push_dm_message\(\)\s+from public, anon, authenticated;/);
  assert.ok(SQL.trim().startsWith('-- G63-S1') && SQL.includes('\nbegin;\n') && SQL.trim().endsWith('commit;'));
});

test('rollback: bayrak kapanır, RPC/tetik/yayın kalkar, veri silinmez, G59 gövdeleri geri gelir', () => {
  assert.match(RB, /update public\.feature_flags set enabled = false, rollout_percent = 0 where key = 'mesajlar'/);
  assert.match(RB, /alter publication supabase_realtime drop table public\.messages/);
  for (const f of ['dm_open(uuid)', 'dm_send(uuid, text, text, jsonb, text)', 'fn_push_dm_message()', 'dm_search_people(text)']) assert.ok(RB.includes(`drop function if exists public.${f}`), f);
  const live = RB.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.equal(/^\s*drop table/im.test(live), false, 'tablo silme yalnız yorum bloğunda');
  assert.match(live, /p_target_type not in \('post', 'user', 'day_card', 'comment', 'story'\)/);
  assert.match(live, /check \(target_type in \('post', 'comment', 'story', 'review'\)\)/);
});

test('moderate-content: message hedefi (izin → sent, ret → blocked, metin yoksa atla)', () => {
  assert.equal(messageModerationText({ sender_id: 'u', status: 'pending', body: '  hey  ', kind: 'text' }), 'hey');
  assert.equal(messageNeedsModeration({ sender_id: 'u', status: 'pending', body: '', kind: 'post' }), false);
  assert.equal(messageNeedsModeration({ sender_id: 'u', status: 'pending', body: 'a', kind: 'text', deleted_at: iso(NOW) }), false);
  assert.equal(messageDecisionStatus(true), 'sent');
  assert.equal(messageDecisionStatus(false), 'blocked');
  assert.ok(MESSAGE_PROMPT_NOTE.includes('PRIVATE DIRECT MESSAGE'));
  const idx = read('supabase/functions/moderate-content/index.ts');
  assert.ok(idx.includes("targetType !== 'message'"));
  assert.ok(idx.includes(".from('messages')"));
  assert.ok(idx.includes('messageDecisionStatus(false)'), 'engellenen mesaj gönderilmez');
});

// ─── Mock istemci = sunucu kuralları (uçtan uca) ───────────────────────────────
const people = [
  { id: 'me', name: 'Ben', handle: 'ben' },
  { id: 'mutual', name: 'Karşılıklı', handle: 'karsilikli' },
  { id: 'stranger', name: 'Yabancı', handle: 'yabanci' },
  { id: 'private', name: 'Gizli', handle: 'gizli', isPrivate: true },
  { id: 'blocker', name: 'Engelleyen', handle: 'engelleyen' },
  { id: 'blocked', name: 'Engellenen', handle: 'engellenen' },
];
function mk(extra: Partial<Parameters<typeof createMockDm>[0]> = {}) {
  let t = NOW;
  const dm = createMockDm({
    me: 'me',
    people,
    follows: [['me', 'mutual'], ['mutual', 'me'], ['me', 'stranger']],
    blocks: [['blocker', 'me'], ['me', 'blocked']],
    now: () => t,
    blockedWords: ['yasakli'],
    ...extra,
  });
  return { dm, tick: (ms: number) => (t += ms) };
}

test('uçtan uca: karşılıklı → aktif; değilse istek (alıcıda okundu yok)', async () => {
  const { dm } = mk();
  const a = await dm.open({ user: 'mutual' });
  const b = await dm.open({ user: 'stranger' });
  assert.equal(dm.state.convs.get(a.conversation_id)!.members.mutual.state, 'active');
  assert.equal(dm.state.convs.get(b.conversation_id)!.members.stranger.state, 'request');
  const th = await dm.thread({ conversation: b.conversation_id });
  assert.equal(th.conversation.receipts, false);
  dm.setOtherRead(b.conversation_id, NOW + 1000);
  assert.equal((await dm.thread({ conversation: b.conversation_id })).conversation.other_last_read_at, null, 'istekte okundu gizli');
  dm.setOtherRead(a.conversation_id, NOW + 1000);
  assert.ok((await dm.thread({ conversation: a.conversation_id })).conversation.other_last_read_at);
});

test('uçtan uca: gizli hesaba takipçi değilsen mesaj yok; engel iki yönde', async () => {
  const { dm } = mk();
  await assert.rejects(dm.open({ user: 'private' }), /gizli_hesap/);
  await assert.rejects(dm.open({ user: 'blocker' }), /engel/);
  await assert.rejects(dm.open({ user: 'blocked' }), /engel/);
  const s = await dm.searchPeople({ q: '' });
  assert.ok(!s.items.some((p) => ['private', 'blocker', 'blocked'].includes(p.id)), 'öneride yazılamayan kişi yok');
});

test('uçtan uca: dakikada 20 mesaj → rate_limited (minute); bir dakika sonra yeniden', async () => {
  const { dm, tick } = mk();
  const { conversation_id } = await dm.open({ user: 'mutual' });
  for (let i = 0; i < 20; i += 1) {
    const r = await dm.send({ conversation: conversation_id, body: `m${i}`, kind: 'text', idem: `k${i}` });
    assert.equal(r.ok, true);
  }
  const over = await dm.send({ conversation: conversation_id, body: 'fazla', kind: 'text', idem: 'k20' });
  assert.deepEqual(over, { ok: false, error: 'rate_limited', scope: 'minute' });
  tick(61_000);
  assert.equal((await dm.send({ conversation: conversation_id, body: 'tekrar', kind: 'text', idem: 'k21' })).ok, true);
  // aynı anahtar → aynı mesaj (çift yok)
  const dup = await dm.send({ conversation: conversation_id, body: 'tekrar', kind: 'text', idem: 'k21' });
  assert.equal(dup.ok, true);
  assert.equal(dm.state.msgs.filter((m) => m.idem === 'k21').length, 1);
});

test('uçtan uca: günde 30 yeni istek', async () => {
  const many = Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, handle: `s${i}` }));
  let t = NOW;
  const dm = createMockDm({ me: 'me', people: [{ id: 'me', name: 'Ben', handle: 'ben' }, ...many], now: () => (t += 4000) });
  for (let i = 0; i < 30; i += 1) {
    const { conversation_id } = await dm.open({ user: `s${i}` });
    assert.equal((await dm.send({ conversation: conversation_id, body: 'selam', kind: 'text', idem: `r${i}` })).ok, true, `istek ${i}`);
  }
  const { conversation_id } = await dm.open({ user: 's30' });
  assert.deepEqual(await dm.send({ conversation: conversation_id, body: 'selam', kind: 'text', idem: 'r30' }), { ok: false, error: 'rate_limited', scope: 'requests' });
});

test('uçtan uca: denetimde engellenen mesaj alıcıya hiç düşmez', async () => {
  const { dm } = mk();
  const { conversation_id } = await dm.open({ user: 'mutual' });
  const seen: string[] = [];
  const off = dm.subscribe({ conversation: conversation_id, onEvent: (e) => seen.push(`${e.type}:${e.row.status}`) });
  const r = await dm.send({ conversation: conversation_id, body: 'yasakli içerik', kind: 'text', idem: 'b1' });
  assert.equal(r.ok && r.needs_moderation, true);
  assert.equal(await dm.moderate({ message: (r as { id: string }).id }), 'blocked');
  off();
  const m = dm.state.msgs.find((x) => x.idem === 'b1')!;
  assert.equal(m.status, 'blocked');
  assert.equal(dm.state.convs.get(conversation_id)!.lastAt, null, 'sohbet sırası ilerlemez (alıcı kutusunda görünmez)');
});

test('uçtan uca: silme 15 dk; istek kabul / reddet', async () => {
  const { dm, tick } = mk();
  const { conversation_id } = await dm.open({ user: 'mutual' });
  const r1 = (await dm.send({ conversation: conversation_id, body: 'sil beni', kind: 'text', idem: 'd1' })) as { id: string };
  tick(10 * MIN);
  await dm.deleteMessage({ message: r1.id });
  const r2 = (await dm.send({ conversation: conversation_id, body: 'geç', kind: 'text', idem: 'd2' })) as { id: string };
  tick(16 * MIN);
  await assert.rejects(dm.deleteMessage({ message: r2.id }), /sure_doldu/);
  // gelen istek
  dm.seed({ id: 'req1', with: 'stranger', myState: 'request', messages: [{ from: 'them', body: 'Merhaba', at: NOW }] });
  assert.equal((await dm.inbox({ tab: 'requests' })).items.length, 1);
  assert.equal((await dm.inbox({ tab: 'all' })).items.some((i) => i.conversation_id === 'req1'), false);
  await dm.accept({ conversation: 'req1' });
  assert.equal((await dm.inbox({ tab: 'all' })).items.some((i) => i.conversation_id === 'req1'), true);
  dm.seed({ id: 'req2', with: 'stranger', myState: 'request', messages: [{ from: 'them', body: 'Hey', at: NOW }] });
  await dm.decline({ conversation: 'req2' });
  assert.equal((await dm.inbox({ tab: 'requests' })).items.some((i) => i.conversation_id === 'req2'), false);
});

// ─── TR / EN ──────────────────────────────────────────────────────────────────
function keys(o: unknown, p = ''): string[] {
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
}
function get(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o);
}

test('TR-EN: anahtarlar eşit, boş yok, tasarım metinleri birebir', () => {
  assert.deepEqual(keys(g63Tr).sort(), keys(g63En).sort());
  for (const k of keys(g63Tr)) {
    assert.ok(String(get(g63Tr, k)).trim(), `tr ${k}`);
    assert.ok(String(get(g63En, k)).trim(), `en ${k}`);
  }
  const pairs: Array<[string, string, string]> = [
    ['dm.title', 'Mesajlar', 'Messages'],
    ['dm.tab_requests', 'İstekler (%{n})', 'Requests (%{n})'],
    ['dm.req_note', 'Takip etmediğin kişilerden gelen mesajlar. Kabul edene kadar mesajı okuduğunu görmezler.', 'Messages from people you don’t follow. They won’t see that you’ve read them until you accept.'],
    ['dm.empty_title', 'Henüz mesajın yok', 'No messages yet'],
    ['dm.req_empty_title', 'Mesaj isteğin yok', 'No message requests'],
    ['dm.chat.req_title', '%{name} sana mesaj göndermek istiyor', '%{name} wants to send you a message'],
    ['dm.chat.block_body', 'Sana mesaj gönderemez, profilini ve gönderilerini göremez. Engellediğini kendisine bildirmeyiz.', 'They won’t be able to message you or see your profile and posts. We won’t tell them you blocked them.'],
    ['dm.chat.placeholder', 'Mesaj yaz…', 'Message…'],
    ['dm.chat.seen', 'Görüldü', 'Seen'],
    ['dm.new.to', 'Kime:', 'To:'],
    ['dm.new.invite', 'Davet bağlantısı paylaş', 'Share invite link'],
    ['dm.story.reply_ph', 'Yanıt gönder…', 'Send a reply…'],
  ];
  for (const [k, trv, env] of pairs) {
    assert.equal(get(g63Tr, k), trv, k);
    assert.equal(get(g63En, k), env, k);
  }
  const dict = read('src/core/i18n/dictionaries.ts');
  assert.ok(dict.includes('...g63Tr,') && dict.includes('...g63En,'));
});

test('lime jetonu: mesajlar arayüzünde tasarımın eski lime değeri yok', () => {
  for (const f of ['InboxScreen', 'ChatScreen', 'NewMessageScreen', 'bubbles', 'ChatOverlays', 'parts']) {
    const src = read(`src/modules/mesajlar/ui/${f}.tsx`);
    assert.equal(new RegExp(['#C6', 'F04F'].join(''), 'i').test(src), false, f);
  }
  assert.ok(read('src/modules/mesajlar/ui/parts.tsx').includes("export const LIME = '#B9EF14'"));
});
