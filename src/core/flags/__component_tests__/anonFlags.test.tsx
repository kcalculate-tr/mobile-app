// G20-S3 md.3 — girişten ÖNCE bayrak okuması: oturum yokken get_anon_features
// (cihaz kovası) çağrılır; hata / süre aşımı → önbellek / varsayılan (asla kilitlenmez).
import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockAuth: { user: null | { id: string } } = { user: null };
jest.mock('../../AuthContext', () => ({ useAuth: () => mockAuth }));

type RpcRes = { data: unknown; error: unknown };
const mockRpc = jest.fn<Promise<RpcRes>, [string, Record<string, unknown>]>();
jest.mock('../../supabase', () => {
  const client = { rpc: (fn: string, args: Record<string, unknown>) => mockRpc(fn, args) };
  return { supabase: client, getSupabaseClient: () => client };
});

import { ANON_TIMEOUT_MS, FlagsProvider, useFeature, useFlagsContext } from '../FlagsProvider';
import { isFlagsDeviceId, makeFlagsDeviceId } from '../storage';

function Probe() {
  const on = useFeature('yeni_onboarding');
  const ready = useFlagsContext()?.ready;
  return <Text testID="probe">{`${ready ? 'ready' : 'wait'}:${on ? 'on' : 'off'}`}</Text>;
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await act(async () => {});
};

beforeEach(async () => {
  mockRpc.mockReset();
  mockAuth.user = null;
  await AsyncStorage.clear();
});

test('oturum yok → get_anon_features (cihaz kimliği ile); yeni_onboarding açık gelir', async () => {
  mockRpc.mockResolvedValue({ data: { yeni_onboarding: true }, error: null });
  const ui = render(
    <FlagsProvider>
      <Probe />
    </FlagsProvider>,
  );
  expect(ui.getByTestId('probe').props.children).toBe('wait:off'); // çözülene dek bekle (splash)
  await flush();
  expect(ui.getByTestId('probe').props.children).toBe('ready:on');
  expect(mockRpc).toHaveBeenCalledTimes(1);
  const [fn, args] = mockRpc.mock.calls[0];
  expect(fn).toBe('get_anon_features');
  expect(isFlagsDeviceId(args.p_device_id)).toBe(true);
  expect(args).toHaveProperty('p_platform');
  // aynı cihaz kimliği kalıcı (kova sabit)
  const first = args.p_device_id;
  ui.unmount();
  render(
    <FlagsProvider>
      <Probe />
    </FlagsProvider>,
  );
  await flush();
  expect(mockRpc.mock.calls[1][1].p_device_id).toBe(first);
});

test('fonksiyon yok (canlıya uygulanmadı) → varsayılan (kapalı), ready', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'function get_anon_features does not exist' } });
  const ui = render(
    <FlagsProvider>
      <Probe />
    </FlagsProvider>,
  );
  await flush();
  expect(ui.getByTestId('probe').props.children).toBe('ready:off');
});

test('ağ yanıt vermiyor → en çok ANON_TIMEOUT_MS sonra ready (kilitlenmez)', async () => {
  mockRpc.mockReturnValue(new Promise(() => {}));
  const ui = render(
    <FlagsProvider>
      <Probe />
    </FlagsProvider>,
  );
  await flush();
  expect(ui.getByTestId('probe').props.children).toBe('wait:off');
  await act(async () => {
    jest.advanceTimersByTime(ANON_TIMEOUT_MS + 10);
  });
  await flush();
  expect(ui.getByTestId('probe').props.children).toBe('ready:off');
});

test('önceki anonim sonuç önbellekte → ağ yokken de kullanılır', async () => {
  mockRpc.mockResolvedValueOnce({ data: { yeni_onboarding: true }, error: null });
  const a = render(
    <FlagsProvider>
      <Probe />
    </FlagsProvider>,
  );
  await flush();
  a.unmount();
  mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
  const b = render(
    <FlagsProvider>
      <Probe />
    </FlagsProvider>,
  );
  await flush();
  expect(b.getByTestId('probe').props.children).toBe('ready:on');
});

test('oturum var → get_my_features (anonim çağrı yok)', async () => {
  mockAuth.user = { id: 'u1' };
  mockRpc.mockResolvedValue({ data: { yeni_onboarding: false }, error: null });
  render(
    <FlagsProvider>
      <Probe />
    </FlagsProvider>,
  );
  await flush();
  expect(mockRpc.mock.calls.map((c) => c[0])).toEqual(['get_my_features']);
});

test('cihaz kimliği biçimi (sunucu deseniyle aynı: ^[A-Za-z0-9_-]{8,64}$)', () => {
  const id = makeFlagsDeviceId();
  expect(id).toHaveLength(24);
  expect(isFlagsDeviceId(id)).toBe(true);
  expect(isFlagsDeviceId('kısa')).toBe(false);
  expect(isFlagsDeviceId("x'; drop table")).toBe(false);
  expect(isFlagsDeviceId(null)).toBe(false);
});
