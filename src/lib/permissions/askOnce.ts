// G26-S1 (İlter 11 Kas) — sistem izni "yalnız kullanıldığı anda, bir kez".
//
// Saf karar (RN yok → tsx --test): kullanıcı bir kez reddettiyse uygulama o izni
// BİR DAHA sistem penceresiyle istemez (Android ikinci kez sorabilse de); ekran
// elle seçime / "Ayarlar'ı aç"a düşer. İzin sonradan Ayarlar'dan verilirse
// okuma `granted` döner ve bayrak yok sayılır.

export type PermStatus = 'granted' | 'denied' | 'undetermined';

export interface AskOnceDeps {
  /** Sormadan mevcut durum. */
  read: () => Promise<{ status: PermStatus; canAskAgain: boolean }>;
  /** Sistem penceresi. */
  request: () => Promise<PermStatus>;
  /** Daha önce reddedildi mi (cihazda kalıcı)? */
  wasDenied: () => Promise<boolean>;
  markDenied: () => Promise<void>;
}

export async function askOnce(d: AskOnceDeps): Promise<boolean> {
  const cur = await d.read().catch(() => ({ status: 'undetermined' as PermStatus, canAskAgain: true }));
  if (cur.status === 'granted') return true;
  if (cur.status === 'denied' && !cur.canAskAgain) {
    await d.markDenied().catch(() => {});
    return false;
  }
  if (await d.wasDenied().catch(() => false)) return false;
  const res = await d.request().catch(() => 'denied' as PermStatus);
  if (res === 'granted') return true;
  await d.markDenied().catch(() => {});
  return false;
}

/** G26-S1: cihazda kalıcı "bir kez reddedildi" anahtarları (izin türü başına). */
export const DENIED_KEYS = {
  camera: '@kcal_camera_denied',
} as const;
