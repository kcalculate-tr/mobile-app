// G28-S1 md.1 — Tara sonucu, Keşfet, tarif (gönderi detayı) ve Koç kartı "Günüme ekle" ORTAK
// logTrace ile; kabuk uçuşu/toast'ı kökte (LogTraceHost), TabBarR3 yalnız rozet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

test('dört kaynak logTrace çağırır (emitLogFlight doğrudan değil)', () => {
  const scan = read('modules/ai/scan/screens/ScanScreen.tsx');
  // G29-S1: çıkartma varsa uçuş çıkartmadan, yoksa tabaktan (plateRef) başlar.
  assert.match(scan, /await logTrace\(\{\s*from: liftedSticker && stickerRef\.current \? stickerRef\.current : plateRef\.current/);
  assert.match(scan, /closeAfterLog\(\);/);
  const kesfet = read('modules/kesfet/ui/KesfetScreen.tsx');
  assert.match(kesfet, /void logTrace\(\{/);
  assert.ok(!/emitLogFlight\(/.test(kesfet));
  assert.match(read('modules/kesfet/ui/PostDetailScreen.tsx'), /void logTrace\(\{\s*from,/);
  assert.match(read('modules/coach/screens/CoachChatScreen.tsx'), /void logTrace\(\{\s*from,/);
});

test('uçuş + toast kökte; TabBarR3 uçuş/toast çizmez, rozeti 9+ ile sınırlar', () => {
  const bar = read('modules/shell/TabBarR3.tsx');
  assert.ok(!/function LogFlight/.test(bar));
  assert.ok(!/<Toast/.test(bar));
  assert.match(bar, /badgeText\(badge\)/);
  assert.match(bar, /setHomeTabTarget\(/);
  const app = readFileSync(join(SRC, '..', 'App.tsx'), 'utf8');
  assert.match(app, /<LogTraceGate \/>/);
  const host = read('modules/shell/LogTraceHost.tsx');
  assert.match(host, /TIMING\.logTrail/);
  assert.match(host, /SPRING\.ai/);
  assert.match(host, /haptic\('success'\)/);
  assert.match(host, /DURATION\.fast, easing: CURVE\.standard/);
});
