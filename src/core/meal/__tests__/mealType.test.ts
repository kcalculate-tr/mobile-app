import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toServerMealType,
  toClientMealType,
  type ClientMealType,
  type ServerMealType,
} from '../mealType';

test('toServerMealType: istemci kodu → sunucu kodu', () => {
  assert.equal(toServerMealType('breakfast'), 'kahvalti');
  assert.equal(toServerMealType('lunch'), 'ogle');
  assert.equal(toServerMealType('dinner'), 'aksam');
  assert.equal(toServerMealType('snack'), 'atistirma');
});

test('toServerMealType: zaten sunucu kodu ise olduğu gibi döner', () => {
  assert.equal(toServerMealType('kahvalti'), 'kahvalti');
  assert.equal(toServerMealType('ogle'), 'ogle');
  assert.equal(toServerMealType('aksam'), 'aksam');
  assert.equal(toServerMealType('atistirma'), 'atistirma');
});

test('toServerMealType: tanınmayan değer güvenli varsayılan', () => {
  assert.equal(toServerMealType('xyz'), 'atistirma');
  assert.equal(toServerMealType(''), 'atistirma');
});

test('toClientMealType: sunucu kodu → istemci kodu', () => {
  assert.equal(toClientMealType('kahvalti'), 'breakfast');
  assert.equal(toClientMealType('ogle'), 'lunch');
  assert.equal(toClientMealType('aksam'), 'dinner');
  assert.equal(toClientMealType('atistirma'), 'snack');
});

test('toClientMealType: zaten istemci kodu ise olduğu gibi döner', () => {
  assert.equal(toClientMealType('breakfast'), 'breakfast');
  assert.equal(toClientMealType('snack'), 'snack');
});

test('toClientMealType: tanınmayan değer güvenli varsayılan', () => {
  assert.equal(toClientMealType('xyz'), 'snack');
});

test('gidiş-dönüş: istemci → sunucu → istemci aynı kalır', () => {
  const all: ClientMealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  for (const m of all) {
    assert.equal(toClientMealType(toServerMealType(m)), m);
  }
});

test('gidiş-dönüş: sunucu → istemci → sunucu aynı kalır', () => {
  const all: ServerMealType[] = ['kahvalti', 'ogle', 'aksam', 'atistirma'];
  for (const m of all) {
    assert.equal(toServerMealType(toClientMealType(m)), m);
  }
});
