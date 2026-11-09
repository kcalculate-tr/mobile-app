// G20-S3 md.4 (B-08) — Destek: talep gönderiminde URL YOK (yalnız yol, attachments),
// geçmişte "Ek N" → kısa ömürlü imzalı URL (createSignedUrl) ile açılır; eski
// talepteki public URL bölümü metinden atılır ve yola çevrilir.
import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: any) => children };
});
const UID = '3f2a9c1e-1111-4222-8333-444455556666';
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: '3f2a9c1e-1111-4222-8333-444455556666', email: 'a@b.co' } }) }));

const mockInserts: any[] = [];
const mockSigned: [string, number][] = [];
let mockTickets: any[] = [];
jest.mock('../../../core/supabase', () => {
  const client = {
    from: () => {
      const q: any = {};
      for (const m of ['select', 'eq']) q[m] = () => q;
      q.order = () => Promise.resolve({ data: mockTickets, error: null });
      q.insert = (rows: any[]) => {
        mockInserts.push(...rows);
        return Promise.resolve({ error: null });
      };
      return q;
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        createSignedUrl: (path: string, ttl: number) => {
          mockSigned.push([path, ttl]);
          return Promise.resolve({ data: { signedUrl: `https://signed.example/${path}?token=t` }, error: null });
        },
        getPublicUrl: () => {
          throw new Error('getPublicUrl çağrılmamalı');
        },
      }),
    },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

import SettingsSupportScreen from '../ui/screens/SettingsSupportScreen';

const flush = async () => {
  for (let i = 0; i < 10; i++) await act(async () => {});
};

beforeEach(() => {
  mockInserts.length = 0;
  mockSigned.length = 0;
  mockTickets = [];
});

test('talep gönderimi: mesajda URL yok, attachments null (ek yokken)', async () => {
  const ui = render(<SettingsSupportScreen onBack={() => {}} />);
  fireEvent.changeText(ui.getByPlaceholderText('Ne oldu? Kısaca anlat.'), 'Siparişim gelmedi');
  await act(async () => fireEvent.press(ui.getByText('Gönder')));
  await flush();
  expect(mockInserts).toHaveLength(1);
  expect(mockInserts[0].message).toBe('Siparişim gelmedi');
  expect(mockInserts[0].attachments).toBeNull();
});

test('geçmiş: yeni talep (yol) ve eski talep (public URL) → "Ek N"; dokununca imzalı URL açılır', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  mockTickets = [
    {
      id: 1,
      subject: 'Sipariş',
      message: 'Ürün ezik\n\n--- Ekli Görseller (1) ---',
      attachments: [`tickets/${UID}/1_a.jpg`],
      admin_reply: null,
      status: 'open',
      created_at: '2026-11-09',
    },
    {
      id: 2,
      subject: 'Eski',
      message: `Eski talep\n\n--- Ekli Görseller ---\nhttps://x.supabase.co/storage/v1/object/public/support-attachments/tickets/${UID}/9_b.jpg`,
      admin_reply: null,
      status: 'closed',
      created_at: '2026-10-01',
    },
  ];
  const ui = render(<SettingsSupportScreen onBack={() => {}} />);
  await act(async () => fireEvent.press(ui.getByText('Geçmiş')));
  await flush();
  expect(ui.getByText('Ürün ezik')).toBeTruthy();
  expect(ui.getByText('Eski talep')).toBeTruthy();
  expect(ui.queryByText(/https:\/\/x\.supabase\.co/)).toBeNull();
  expect(ui.getAllByText('Ek 1')).toHaveLength(2);
  await act(async () => fireEvent.press(ui.getAllByText('Ek 1')[1]));
  await flush();
  expect(mockSigned).toEqual([[`tickets/${UID}/9_b.jpg`, 300]]);
  expect(open).toHaveBeenCalledWith(`https://signed.example/tickets/${UID}/9_b.jpg?token=t`);
  open.mockRestore();
});
