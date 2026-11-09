// G19-S2 md.2 — Çevrimdışı kayıt kuyruğunun RN bağı: AsyncStorage kalıcılığı,
// Supabase yürütücüsü, ağ dönünce / ön plana gelince boşaltma. Yalnız yeni
// kabukta (TrackerScreen `yeniKabuk`) kullanılır; bayrak kapalıyken hiç
// çağrılmaz (1.0.7 yolu doğrudan yazmaya devam eder).
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';

import { getSupabaseClient } from '../../../core/supabase';
import {
  applyPending,
  backoffMs,
  classifyError,
  enqueue,
  flush,
  MAX_OPS,
  uuidFromBytes,
  type ExecResult,
  type QueueOp,
} from './logQueue';

const KEY = (uid: string) => `@kcal_log_queue:${uid}`;
const SELECT = 'id,source,source_ref,name,meal_type,calories,protein,carbs,fat,note,consumed_at';

type Listener = (q: readonly QueueOp[]) => void;
type DropListener = (ops: readonly QueueOp[]) => void;

let uid: string | null = null;
let queue: QueueOp[] = [];
let loaded: Promise<void> | null = null;
let flushing = false;
const deferred: QueueOp[] = [];
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();
const dropListeners = new Set<DropListener>();
const doneListeners = new Set<() => void>();

export function newRowId(): string {
  try {
    return uuidFromBytes(Crypto.getRandomBytes(16));
  } catch {
    const b = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
    return uuidFromBytes(b);
  }
}

async function persist(): Promise<void> {
  if (!uid) return;
  try {
    await AsyncStorage.setItem(KEY(uid), JSON.stringify([...queue, ...deferred]));
  } catch {
    /* depolama yoksa bellek içi kuyruk yine çalışır */
  }
}

function emit(): void {
  for (const l of listeners) l(queue);
}

/** Kullanıcı kuyruğunu yükler (oturum değişince yeniden). */
export function bindLogQueue(userId: string | null): Promise<void> {
  if (userId === uid && loaded) return loaded;
  uid = userId;
  queue = [];
  attempt = 0;
  if (!userId) {
    loaded = Promise.resolve();
    emit();
    return loaded;
  }
  loaded = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY(userId));
      const parsed = raw ? JSON.parse(raw) : [];
      if (uid === userId && Array.isArray(parsed)) queue = parsed as QueueOp[];
    } catch {
      /* bozuk kayıt → boş kuyruk */
    }
    emit();
    void flushLogQueue();
  })();
  return loaded;
}

export function pendingOps(): readonly QueueOp[] {
  return queue;
}

export function onLogQueue(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Kalıcı hata ile düşen işlemler (ekran satırı geri almalı). */
export function onLogQueueDrop(l: DropListener): () => void {
  dropListeners.add(l);
  return () => dropListeners.delete(l);
}

/** Kuyruktan en az bir işlem sunucuya gitti (ekran yeniden okuyabilir). */
export function onLogQueueSynced(l: () => void): () => void {
  doneListeners.add(l);
  return () => doneListeners.delete(l);
}

export { applyPending };

async function exec(op: QueueOp): Promise<ExecResult> {
  const sb = getSupabaseClient();
  if (!uid) return 'retry';
  if (op.kind === 'insert') {
    const { error } = await sb.from('meal_consumptions').insert({ ...op.row, user_id: uid }).select(SELECT).maybeSingle();
    return classifyError('insert', error as never);
  }
  if (op.kind === 'update') {
    const { error } = await sb.from('meal_consumptions').update(op.patch).eq('user_id', uid).eq('id', op.id);
    return classifyError('update', error as never);
  }
  const { error } = await sb.from('meal_consumptions').delete().eq('user_id', uid).eq('id', op.id);
  return classifyError('delete', error as never);
}

/** İşlemi kuyruğa alır ve hemen göndermeyi dener. false → kuyruk dolu. */
export async function submitLogOp(op: QueueOp): Promise<boolean> {
  await loaded;
  // Gönderim sürerken gelen işlem, uçuştaki işlemlerle sıkıştırılmasın diye
  // bekletilir; gönderim bitince kalan kuyruğa sırayla eklenir.
  if (flushing) {
    if (queue.length + deferred.length >= MAX_OPS) return false;
    deferred.push(op);
    await persist();
    return true;
  }
  const next = enqueue(queue, op);
  if (!next) return false;
  queue = next;
  emit();
  await persist();
  void flushLogQueue();
  return true;
}

export async function flushLogQueue(): Promise<void> {
  if (flushing || !uid || queue.length === 0) return;
  flushing = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const forUser = uid;
  try {
    const out = await flush(queue, exec);
    if (forUser !== uid) {
      deferred.length = 0;
      return;
    }
    // Yürütme sırasında eklenen işlemler kuyruğun sonunda kalır.
    queue = out.queue;
    for (const d of deferred.splice(0)) queue = enqueue(queue, d) ?? queue;
    await persist();
    emit();
    if (out.dropped.length) for (const l of dropListeners) l(out.dropped);
    if (out.done.length) for (const l of doneListeners) l();
    if (out.stopped) {
      attempt += 1;
      timer = setTimeout(() => void flushLogQueue(), backoffMs(attempt));
    } else {
      attempt = 0;
      if (queue.length) void Promise.resolve().then(flushLogQueue);
    }
  } finally {
    flushing = false;
  }
}

let wired = false;
/** Ağ geri gelince ve uygulama ön plana dönünce boşalt (bir kez kurulur). */
export function wireLogQueueTriggers(): void {
  if (wired) return;
  wired = true;
  try {
    NetInfo.addEventListener((s) => {
      if (s?.isConnected && s.isInternetReachable !== false) {
        attempt = 0;
        void flushLogQueue();
      }
    });
  } catch {
    /* testte NetInfo yok */
  }
  AppState.addEventListener('change', (st) => {
    if (st === 'active') void flushLogQueue();
  });
}

/** Çevrimdışı mı (bilinmiyorsa false). Toast "çevrimdışı kaydedildi" için. */
export async function isOffline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return s?.isConnected === false || s?.isInternetReachable === false;
  } catch {
    return false;
  }
}
