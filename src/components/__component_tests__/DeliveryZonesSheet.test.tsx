/**
 * DeliveryZonesSheet — ilçe özetleme mantığı.
 *
 * Asıl korunan regresyon: is_active=false satırlar listeye SIZMAMALI.
 * Eski sürüm yalnız allow_immediate/allow_scheduled'a bakıyordu; Çeşme'nin
 * 25 pasif mahallesi allow_scheduled=true olduğu için müşteriye "Çeşme'ye
 * teslimat var" deniyordu.
 */
import { ilceleriOzetle } from '../DeliveryZonesSheet';

const z = (
  district: string,
  opts: Partial<{
    is_active: boolean; allow_immediate: boolean; allow_scheduled: boolean;
    min_order_immediate: number; min_order_scheduled: number; min_order: number;
  }> = {},
) => ({
  district,
  is_active: opts.is_active ?? true,
  allow_immediate: opts.allow_immediate ?? false,
  allow_scheduled: opts.allow_scheduled ?? false,
  min_order: opts.min_order ?? 0,
  min_order_immediate: opts.min_order_immediate ?? null,
  min_order_scheduled: opts.min_order_scheduled ?? null,
  delivery_days: null,
  delivery_days_immediate: null,
  delivery_days_scheduled: null,
}) as any;

describe('ilceleriOzetle', () => {
  it('pasif ilçe listeye girmez (Çeşme regresyonu)', () => {
    const out = ilceleriOzetle(
      [
        z('Çeşme', { is_active: false, allow_scheduled: true, min_order_scheduled: 2500 }),
        z('Konak', { allow_immediate: true, allow_scheduled: true, min_order_immediate: 350 }),
      ],
      null,
    );
    expect(out.map((i) => i.district)).toEqual(['Konak']);
  });

  it('aktif ama iki teslimat tipi de kapalı ilçe girmez (Aliağa regresyonu)', () => {
    const out = ilceleriOzetle([z('Aliağa')], null);
    expect(out).toHaveLength(0);
  });

  it('hızlı ve planlı ilçeleri doğru işaretler', () => {
    const out = ilceleriOzetle(
      [
        z('Konak', { allow_immediate: true, allow_scheduled: true }),
        z('Bornova', { allow_scheduled: true }),
      ],
      null,
    );
    const konak = out.find((i) => i.district === 'Konak')!;
    const bornova = out.find((i) => i.district === 'Bornova')!;
    expect(konak.hizli).toBe(true);
    expect(bornova.hizli).toBe(false);
  });

  it('aynı ilçenin mahalleleri birleşir, en düşük tutar alınır', () => {
    const out = ilceleriOzetle(
      [
        z('Konak', { allow_immediate: true, min_order_immediate: 500 }),
        z('Konak', { allow_immediate: true, min_order_immediate: 350 }),
      ],
      null,
    );
    expect(out).toHaveLength(1);
    expect(out[0].minHizli).toBe(350);
  });

  it('ilçede bir mahalle hızlıysa ilçe hızlı sayılır', () => {
    const out = ilceleriOzetle(
      [
        z('Konak', { allow_scheduled: true }),
        z('Konak', { allow_immediate: true }),
      ],
      null,
    );
    expect(out[0].hizli).toBe(true);
  });

  it('türkçe alfabetik sıralanır', () => {
    const out = ilceleriOzetle(
      [z('Çiğli', { allow_scheduled: true }), z('Buca', { allow_scheduled: true }),
       z('Bornova', { allow_scheduled: true })],
      null,
    );
    expect(out.map((i) => i.district)).toEqual(['Bornova', 'Buca', 'Çiğli']);
  });
});
