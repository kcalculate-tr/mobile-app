// G9-S1 istemci düzeltme testleri (tsx --test). Saf mantık; native import yok.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { POST_MEDIA_BUCKET, buildPostMediaPath } from '../mediaPath';
import { MET_TABLE } from '../activity';
import { buildCreateInput, type ComposerDraft } from '../composer';

// ── 3a — Gönderi medyası herkese açık post-media kovasında posts/{uid}/... ────
test('3a: post medyası post-media kovası + posts/{uid}/... yolu', () => {
  assert.equal(POST_MEDIA_BUCKET, 'post-media');
  // post-media yazma politikası: foldername[1]='posts', foldername[2]=uid.
  const path = buildPostMediaPath('user-123', 0, 1080, 1350, 'jpg');
  assert.equal(path, 'posts/user-123/0-1080x1350.jpg');
  const parts = path.split('/');
  assert.equal(parts[0], 'posts');
  assert.equal(parts[1], 'user-123');
  // ESKİ (hatalı) davranış: user-media + {uid}/posts/... — artık DEĞİL.
  assert.notEqual(parts[0], 'user-123');
});

// ── 3i — İstemci MET tablosu = sunucu activity_kcal (sunucu kaynak) ───────────
test('3i: MET tablosu sunucu activity_kcal ile birebir', () => {
  // supabase/migrations/20261104002000_g8_social.sql activity_kcal CASE değerleri.
  const SERVER_MET: Record<string, number> = {
    kosu: 9.8,
    yuruyus: 3.5,
    bisiklet: 7.5,
    yuzme: 7.0,
    fitness: 6.0,
    yoga: 2.5,
    pilates: 3.0,
    futbol: 7.0,
    basketbol: 6.5,
    tenis: 7.0,
    dans: 5.0,
    diger: 4.0,
  };
  for (const [type, met] of Object.entries(SERVER_MET)) {
    assert.equal(MET_TABLE[type as keyof typeof MET_TABLE], met, `MET[${type}] sunucuyla eşleşmeli`);
  }
  // Önceki uyuşmazlık: fitness istemcide 5.0 idi; sunucu 6.0.
  assert.equal(MET_TABLE.fitness, 6.0);
});

// ── 3e — Öğün kartı karbonhidrat anahtarı tek ad: carbs_g ─────────────────────
test('3e: öğün kartı carbs_g (carb_g değil)', () => {
  const draft: ComposerDraft = {
    type: 'ogun',
    body: '',
    photoCount: 0,
    meal: { name: 'Mercimek', kcal: '300', protein_g: '18', carbs_g: '40', fat_g: '6', portionLabel: '1 kase', productId: null },
    activity: null,
  };
  const input = buildCreateInput(draft, [], 'tr', 'idem-1');
  assert.ok(input.mealCard, 'mealCard dolu olmalı');
  assert.equal(input.mealCard!.carbs_g, 40);
  assert.ok(!('carb_g' in (input.mealCard as object)), 'carb_g anahtarı OLMAMALI');
});
