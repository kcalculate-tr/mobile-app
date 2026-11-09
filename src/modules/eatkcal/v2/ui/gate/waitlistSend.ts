// eatkcal v2 (G18-S3 md.1) — "Çok yakında" form gönderimi (cihaz tarafı).
// Önce kuyruğa yazılır, sonra kuyruk boşaltılmaya çalışılır. Tablo henüz canlıda
// yoksa / oturum yoksa / ağ yoksa satır kuyrukta kalır; kullanıcıya hata GÖSTERİLMEZ.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../../../../core/supabase';
import {
  classifyInsertError,
  enqueue,
  flushQueue,
  makeQueued,
  type QueuedWaitlist,
  type SendResult,
  type WaitlistDraft,
} from '../../model/waitlist';

const KEY = 'eatkcal.v2.waitlist.queue';

async function readQueue(): Promise<QueuedWaitlist[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as QueuedWaitlist[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: QueuedWaitlist[]): Promise<void> {
  try {
    if (q.length === 0) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    /* sessiz */
  }
}

async function sendRow(row: Record<string, string | null>): Promise<SendResult> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getSession();
  if (!data?.session) return 'failed'; // oturum yok → kuyrukta kalır
  const { error } = await client.from('eatkcal_waitlist_requests').insert(row);
  return classifyInsertError(error);
}

let flushing: Promise<void> | null = null;

/** Kuyruktaki bekleyenleri göndermeyi dener (aynı anda tek çalışma). */
export function flushWaitlistQueue(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const q = await readQueue();
    if (q.length === 0) return;
    const left = await flushQueue(q, sendRow);
    // Gönderim sırasında yeni satır eklendiyse onları koru.
    const now = await readQueue();
    const sentRefs = new Set(q.filter((x) => !left.some((l) => l.client_ref === x.client_ref)).map((x) => x.client_ref));
    await writeQueue(now.filter((x) => !sentRefs.has(x.client_ref)));
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Formu gönder: kuyruğa al + boşaltmayı dene. Her durumda başarıyla döner. */
export async function submitWaitlist(d: WaitlistDraft): Promise<void> {
  const item = makeQueued(d, new Date());
  await writeQueue(enqueue(await readQueue(), item));
  try {
    await flushWaitlistQueue();
  } catch {
    /* kuyrukta kalır */
  }
}
