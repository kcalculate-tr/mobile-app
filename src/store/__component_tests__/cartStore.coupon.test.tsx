/**
 * Sepet boşalınca kupon da düşmeli.
 *
 * Gerçek hata (24.09.2026, İlter): kupon uygulanıyor, sonra kalemler TEK TEK
 * siliniyor, sepet boşalıyor — ama kupon kartı ekranda kalıyordu ve yeni
 * eklenen bambaşka ürünlere bayat discountAmount ile uygulanıyordu.
 * clearCart zaten kuponu düşürüyordu; removeItem düşürmüyordu.
 */
import { useCartStore } from '../cartStore';
import type { Product } from '../../types';

const urun = (id: number, price: number): Product =>
  ({ id, name: `Ürün ${id}`, price, brand: 'kcal', category: 'test' }) as unknown as Product;

const kupon = {
  code: 'TEST10',
  campaignId: '1',
  discountType: 'fixed' as const,
  discountValue: 10,
  discountAmount: 10,
  title: 'Test kuponu',
};

beforeEach(() => {
  useCartStore.setState({ items: [], appliedCoupon: null });
});

describe('cartStore — kupon sıfırlama', () => {
  it('son kalem silinince kupon düşer', () => {
    const s = useCartStore.getState();
    s.addItem(urun(1, 100), {}, 1);
    useCartStore.getState().setCoupon(kupon);
    expect(useCartStore.getState().appliedCoupon).not.toBeNull();

    const lineKey = useCartStore.getState().items[0].lineKey;
    useCartStore.getState().removeItem(lineKey);

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().appliedCoupon).toBeNull();
  });

  it('sepette kalem varken kupon korunur', () => {
    const s = useCartStore.getState();
    s.addItem(urun(1, 100), {}, 1);
    s.addItem(urun(2, 50), {}, 1);
    useCartStore.getState().setCoupon(kupon);

    const lineKey = useCartStore.getState().items[0].lineKey;
    useCartStore.getState().removeItem(lineKey);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().appliedCoupon).not.toBeNull();
  });

  it('adet 0a düşürülünce (updateQuantity) da kupon düşer', () => {
    const s = useCartStore.getState();
    s.addItem(urun(1, 100), {}, 2);
    useCartStore.getState().setCoupon(kupon);

    const lineKey = useCartStore.getState().items[0].lineKey;
    useCartStore.getState().updateQuantity(lineKey, 0);

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().appliedCoupon).toBeNull();
  });
});
