// G30-S1 md.3 — bayrak yenilemesi kabuk ağacını YENİDEN KURMAZ (remount yok).
// AppNavigator'daki gibi: splash `shouldWaitFlags` iken null, kabuk `useColdStartFeature`
// ile bir kez seçilir. Kabuğun mount sayısı ölçülür.
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockAuth: { user: null | { id: string; email?: string } } = { user: null };
jest.mock('../../AuthContext', () => ({ useAuth: () => mockAuth }));

type RpcRes = { data: unknown; error: unknown };
const mockRpc = jest.fn<Promise<RpcRes>, [string, Record<string, unknown>]>();
jest.mock('../../supabase', () => {
  const client = { rpc: (fn: string, args: Record<string, unknown>) => mockRpc(fn, args) };
  return { supabase: client, getSupabaseClient: () => client };
});

import { FlagsProvider, sameFlags, useFlagsContext } from '../FlagsProvider';
import { writeCachedFlags } from '../storage';
import { SESSION_FLAGS_WAIT_MS, shouldWaitFlags, useColdStartFeature } from '../../../navigation/coldStartFeature';

const mounts = { yeni: 0, eski: 0 };
function Shell({ kind }: { kind: 'yeni' | 'eski' }) {
  useEffect(() => {
    mounts[kind] += 1;
  }, [kind]);
  return <Text testID="shell">{kind}</Text>;
}
function Root({ waitOver = false }: { waitOver?: boolean }) {
  const ctx = useFlagsContext();
  const yeni = useColdStartFeature('yeni_kabuk');
  const wait = shouldWaitFlags({
    hasSession: !!mockAuth.user,
    ready: ctx ? ctx.ready : true,
    settled: ctx ? (ctx.settled ?? ctx.ready) : true,
    sessionWaitOver: waitOver,
  });
  if (wait) return null; // splash
  return yeni ? <Shell kind="yeni" /> : <Shell kind="eski" />;
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await act(async () => {});
};

beforeEach(async () => {
  mockRpc.mockReset();
  mounts.yeni = 0;
  mounts.eski = 0;
  mockAuth.user = { id: 'u1' };
  await AsyncStorage.clear();
});

test('oturumlu açılış + önbellek: kabuk önbellekten bir kez seçilir; sunucu dönünce remount YOK', async () => {
  await writeCachedFlags({ yeni_kabuk: true } as never);
  let resolveRpc: (v: RpcRes) => void = () => {};
  mockRpc.mockImplementation(() => new Promise((r) => (resolveRpc = r)));
  const ui = render(
    <FlagsProvider>
      <Root />
    </FlagsProvider>,
  );
  expect(ui.queryByTestId('shell')).toBeNull(); // önbellek okunana kadar splash
  await flush();
  expect(ui.getByTestId('shell').props.children).toBe('yeni'); // eski kabuk HİÇ çizilmedi
  await act(async () => {
    resolveRpc({ data: { yeni_kabuk: true }, error: null });
  });
  await flush();
  expect(mounts).toEqual({ yeni: 1, eski: 0 });
});

test('token yenilemesi (aynı kimlik, yeni user nesnesi): bayrak yeniden çekilmez, kabuk remount olmaz', async () => {
  mockRpc.mockResolvedValue({ data: { yeni_kabuk: true }, error: null });
  const ui = render(
    <FlagsProvider>
      <Root />
    </FlagsProvider>,
  );
  await flush();
  expect(mockRpc).toHaveBeenCalledTimes(1);
  mockAuth.user = { ...mockAuth.user!, email: 'yeni-token' };
  ui.rerender(
    <FlagsProvider>
      <Root />
    </FlagsProvider>,
  );
  await flush();
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mounts).toEqual({ yeni: 1, eski: 0 });
});

test('canlı bayrak değeri değişse de (refresh) kabuk sabit — sonraki soğuk açılışta uygulanır', async () => {
  mockRpc.mockResolvedValueOnce({ data: { yeni_kabuk: true }, error: null });
  let ctxRef: ReturnType<typeof useFlagsContext>;
  function Grab() {
    ctxRef = useFlagsContext();
    return null;
  }
  render(
    <FlagsProvider>
      <Grab />
      <Root />
    </FlagsProvider>,
  );
  await flush();
  mockRpc.mockResolvedValueOnce({ data: { yeni_kabuk: false }, error: null });
  await act(async () => {
    await ctxRef!.refresh();
  });
  await flush();
  expect(mounts).toEqual({ yeni: 1, eski: 0 });
});

test('splash bekleme kuralı: oturumlu + önbelleksiz en çok SESSION_FLAGS_WAIT_MS; oturumsuz sunucuya kadar', () => {
  expect(SESSION_FLAGS_WAIT_MS).toBeLessThanOrEqual(2000);
  expect(shouldWaitFlags({ hasSession: true, ready: false, settled: false, sessionWaitOver: false })).toBe(true);
  expect(shouldWaitFlags({ hasSession: true, ready: false, settled: true, sessionWaitOver: false })).toBe(false);
  expect(shouldWaitFlags({ hasSession: true, ready: false, settled: false, sessionWaitOver: true })).toBe(false);
  expect(shouldWaitFlags({ hasSession: false, ready: false, settled: true, sessionWaitOver: true })).toBe(true);
  expect(shouldWaitFlags({ hasSession: false, ready: true, settled: true, sessionWaitOver: false })).toBe(false);
  expect(sameFlags({ a: true } as never, { a: true } as never)).toBe(true);
  expect(sameFlags({ a: true } as never, { a: false } as never)).toBe(false);
  expect(sameFlags(null, { a: true } as never)).toBe(false);
});
