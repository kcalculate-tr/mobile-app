// G32-S1 md.4 — Gel-Al şube kartı yardımcıları.
import test from 'node:test';
import assert from 'node:assert/strict';
import { branchKm, branchSemt, needsBranchPick } from '../model/branchCard';

test('semt: mahalle + ilçe (canlı şube adresleri)', () => {
  assert.equal(branchSemt('Mansuroğlu Mah. 271. Sk. No:6A Bayraklı İzmir'), 'Mansuroğlu, Bayraklı');
  assert.equal(branchSemt('Basın Sitesi Mah. 177/3. Sk. No:3A Karabağlar İzmir'), 'Basın Sitesi, Karabağlar');
  assert.equal(branchSemt('Alsancak Mahallesi 1453 Sk. Konak/İzmir'), 'Alsancak, Konak');
  assert.equal(branchSemt(''), null);
  assert.equal(branchSemt(null), null);
});

test('uzaklık biçimi TR virgül / EN nokta; konum yoksa null', () => {
  assert.equal(branchKm(2.44, 'tr'), '2,4 km');
  assert.equal(branchKm(2.44, 'en'), '2.4 km');
  assert.equal(branchKm(12.6, 'tr'), '13 km');
  assert.equal(branchKm(null, 'tr'), null);
});

test('Gel-Al + şube yok → Öde pasif; eve teslim / taslak → değil', () => {
  assert.equal(needsBranchPick({ deliveryMethod: 'pickup', selectedBranchId: null, hasDraft: false }), true);
  assert.equal(needsBranchPick({ deliveryMethod: 'pickup', selectedBranchId: 'b1', hasDraft: false }), false);
  assert.equal(needsBranchPick({ deliveryMethod: 'home_delivery', selectedBranchId: null, hasDraft: false }), false);
  assert.equal(needsBranchPick({ deliveryMethod: 'pickup', selectedBranchId: null, hasDraft: true }), false);
});
