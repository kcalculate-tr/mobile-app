// G26-S1 md.3 — konum (ve benzeri) izni: yalnız dokununca, reddedilirse bir daha sorulmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { askOnce, type PermStatus } from '../askOnce';

function deps(init: { status: PermStatus; canAskAgain?: boolean; denied?: boolean; answer?: PermStatus }) {
  const calls: string[] = [];
  let denied = init.denied ?? false;
  return {
    calls,
    get denied() {
      return denied;
    },
    d: {
      read: async () => ({ status: init.status, canAskAgain: init.canAskAgain ?? true }),
      request: async () => {
        calls.push('request');
        return init.answer ?? 'granted';
      },
      wasDenied: async () => denied,
      markDenied: async () => {
        denied = true;
      },
    },
  };
}

test('izin zaten var → sistem penceresi yok', async () => {
  const x = deps({ status: 'granted', denied: true });
  assert.equal(await askOnce(x.d), true);
  assert.deepEqual(x.calls, []);
});

test('ilk dokunuş: bir kez sorar; kabul → true', async () => {
  const x = deps({ status: 'undetermined', answer: 'granted' });
  assert.equal(await askOnce(x.d), true);
  assert.deepEqual(x.calls, ['request']);
});

test('reddedilirse işaretlenir; ikinci dokunuşta SORULMAZ', async () => {
  const x = deps({ status: 'undetermined', answer: 'denied' });
  assert.equal(await askOnce(x.d), false);
  assert.equal(x.denied, true);
  assert.equal(await askOnce(x.d), false);
  assert.deepEqual(x.calls, ['request']);
});

test('Android ilk ret sonrası (denied + canAskAgain) yine sorulmaz', async () => {
  const x = deps({ status: 'denied', canAskAgain: true, denied: true });
  assert.equal(await askOnce(x.d), false);
  assert.deepEqual(x.calls, []);
});

test('kalıcı ret (canAskAgain=false) → sormadan false, işaretlenir', async () => {
  const x = deps({ status: 'denied', canAskAgain: false });
  assert.equal(await askOnce(x.d), false);
  assert.equal(x.denied, true);
  assert.deepEqual(x.calls, []);
});
