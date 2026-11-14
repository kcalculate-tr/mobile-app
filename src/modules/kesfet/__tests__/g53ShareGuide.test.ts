// G53-S1 md.3 — Paylaşım görsel kılavuzu: değerler koddaki gerçek sınırlardan; öneri oranları akış çerçevesiyle
// çelişmiyor; metinlerde sabit sayı yok (hepsi parametre); TR + EN.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_PHOTOS } from '../composer';
import { FEED_SINGLE_MAX_H, FEED_SINGLE_MIN_H, PHOTO_QUALITY, POST_MEDIA_MAX_BYTES, feedSingleFrameHeight } from '../mediaPath';
import { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_S } from '../../media/video/types';
import { SHARE_GUIDE_RATIOS, pctLabel, shareGuideValues, shouldAutoShowGuide } from '../shareGuide';
import { translate } from '../../../core/i18n/core';
import { tr as g53tr, en as g53en } from '../../../core/i18n/g53';

const root = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('kılavuz değerleri = koddaki sınırlar', () => {
  const v = shareGuideValues();
  assert.equal(v.maxPhotos, MAX_PHOTOS);
  assert.equal(v.maxPhotos, 4);
  assert.equal(v.photoQualityPct, Math.round(PHOTO_QUALITY * 100));
  assert.equal(v.photoQualityPct, 60);
  assert.equal(v.photoMaxMb, POST_MEDIA_MAX_BYTES / (1024 * 1024));
  assert.equal(v.photoMaxMb, 50);
  assert.equal(v.videoMaxSeconds, MAX_VIDEO_DURATION_S);
  assert.equal(v.videoMaxSeconds, 60);
  assert.equal(v.videoMaxMb, MAX_VIDEO_BYTES / (1024 * 1024));
  assert.equal(v.feedMinH, FEED_SINGLE_MIN_H);
  assert.equal(v.feedMaxH, FEED_SINGLE_MAX_H);
  assert.equal(v.cropsOnPick, false);
});

test('sabitler gerçekten kullanılıyor: seçici kalitesi, sayı sınırı, akış çerçevesi, kova sınırı (migration)', () => {
  const media = read('src/modules/kesfet/media.ts');
  assert.match(media, /quality: PHOTO_QUALITY/);
  assert.match(media, /export \{ MAX_PHOTOS \} from '\.\/composer'/);
  // Keşfet fotoğraf seçicisinde kırpma yok → kodda zorunlu oran yok (kılavuz "kırpılmadan yüklenir" der).
  assert.doesNotMatch(media, /allowsEditing/);
  const grid = read('src/modules/kesfet/ui/MediaGrid.tsx');
  assert.match(grid, /feedSingleFrameHeight\(w, one\.width, one\.height\)/);
  const mig = read('supabase/migrations/20261104002000_g8_social.sql');
  assert.match(mig, /'post-media', 'post-media', true, 52428800/);
  assert.equal(POST_MEDIA_MAX_BYTES, 52428800);
  const pick = read('src/modules/media/video/pickVideo.ts');
  assert.match(pick, /assertVideoDuration\(durationMs\);\s*\n\s*assertVideoSize\(fileSizeBytes\)/);
});

test('öneri oranları (kodda net oran yok): 1080×1350 (4:5) ve 1080×1080 (1:1) — akış çerçevesiyle çelişmez', () => {
  assert.deepEqual(SHARE_GUIDE_RATIOS.map((r) => [r.w, r.h]), [[1080, 1350], [1080, 1080]]);
  // Akış kartı görsel genişliği = ekran − 84 (MediaGrid). 320–430 pt ekranlar.
  for (const screen of [320, 375, 393, 402, 430]) {
    const w = screen - 84;
    for (const r of SHARE_GUIDE_RATIOS) {
      const h = feedSingleFrameHeight(w, r.w, r.h);
      assert.ok(h >= FEED_SINGLE_MIN_H && h <= FEED_SINGLE_MAX_H, `${screen} ${r.key}`);
      // Kare: çerçeve görseli tam gösterir ya da yalnız tavan aşımında kırpar; 4:5 dikey tavana takılır →
      // "çerçeveye sığmayan kısım ortadan kırpılır" notu doğru.
      if (r.key === 'square') assert.equal(h, Math.min(FEED_SINGLE_MAX_H, Math.round(w)));
      if (r.key === 'portrait') assert.equal(h, Math.min(FEED_SINGLE_MAX_H, Math.round((w * 1350) / 1080)));
    }
  }
});

test('ekranda yazılan metin değerleri gösteriyor (TR + EN)', () => {
  const v = shareGuideValues();
  assert.equal(translate('tr', 'share_guide.count', { n: v.maxPhotos }), 'En fazla 4 fotoğraf');
  assert.equal(translate('en', 'share_guide.count_video', { n: v.maxPhotos }), 'Up to 4 photos and 1 video');
  assert.equal(translate('tr', 'share_guide.photo_size', { mb: v.photoMaxMb, q: pctLabel(v.photoQualityPct, 'tr') }), 'Fotoğraf en fazla 50 MB. Yüklemeden önce %60 kalitede sıkıştırılır.');
  assert.equal(translate('en', 'share_guide.photo_size', { mb: v.photoMaxMb, q: pctLabel(v.photoQualityPct, 'en') }), 'Photos up to 50 MB. They’re compressed to 60% quality before upload.');
  assert.equal(translate('tr', 'share_guide.video_limit', { s: v.videoMaxSeconds, mb: v.videoMaxMb }), 'En fazla 60 sn ve 50 MB, orta kalitede yüklenir.');
  assert.match(translate('tr', 'share_guide.crop_note', { min: v.feedMinH, max: v.feedMaxH }), /180–320 pt/);
  assert.equal(translate('tr', 'share_guide.ratio_portrait', { w: 1080, h: 1350 }), '4:5 dikey (1080 × 1350)');
  assert.equal(translate('en', 'share_guide.ratio_square', { w: 1080, h: 1080 }), '1:1 square (1080 × 1080)');
});

test('metin şablonlarında sınır sayısı gömülü değil (oran adları ve tek video — Composer tek `video` durumu — dışında)', () => {
  const c = read('src/modules/kesfet/ui/ComposerScreen.tsx');
  assert.match(c, /useState<PickedVideoLite \| null>\(null\)/);
  for (const dict of [g53tr.share_guide, g53en.share_guide]) {
    for (const [k, s] of Object.entries(dict)) {
      const stripped = String(s).replace(/4:5|1:1|1 video/g, '');
      assert.doesNotMatch(stripped, /\d/, k);
    }
  }
});

test('ilk açılışta bir kez kendiliğinden', () => {
  assert.equal(shouldAutoShowGuide(null), true);
  assert.equal(shouldAutoShowGuide('1'), false);
  const c = read('src/modules/kesfet/ui/ComposerScreen.tsx');
  assert.match(c, /AsyncStorage\.getItem\(SHARE_GUIDE_SEEN_KEY\)/);
  assert.match(c, /AsyncStorage\.setItem\(SHARE_GUIDE_SEEN_KEY, '1'\)/);
  assert.match(c, /testID="composer-guide-info"/);
});
