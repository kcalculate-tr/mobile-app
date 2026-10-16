export function resolveNavigation(
  navigation: any,
  dest: string | null | undefined,
  fallback: string = 'Home',
): void {
  const target = (dest ?? fallback).toString().trim();
  if (!target) return;

  // Push bildirimlerinden gelen kcal:// derin baglantilari. Onceden ham sema
  // dogrudan navigate'e veriliyordu; ekran adi olmadigi icin fallback'e
  // dusuyor ve bildirim yanlis ekran aciyordu.
  if (target.startsWith('kcal://')) {
    const yol = target.substring('kcal://'.length).replace(/^\/+|\/+$/g, '');
    const HARITA: Record<string, string> = {
      'reviews': 'ProfileReviews',
      'degerlendirmelerim': 'ProfileReviews',
      'orders': 'ProfileOrders',
      'coupons': 'ProfileCoupons',
      'support': 'ProfileSupport',
    };
    const ekran = HARITA[yol.toLowerCase()];
    navigation.navigate((ekran ?? fallback) as any);
    return;
  }

  if (target.startsWith('ProductDetail:')) {
    const productId = target.substring('ProductDetail:'.length).trim();
    if (productId) {
      navigation.navigate('ProductDetail', { productId });
    }
    return;
  }

  if (target.startsWith('CategoryProducts:')) {
    const categoryName = target.substring('CategoryProducts:'.length).trim();
    if (categoryName) {
      navigation.navigate('CategoryProducts', { categoryName });
    }
    return;
  }

  if (target.startsWith('BrandLanding:')) {
    const brandKey = target.substring('BrandLanding:'.length).trim();
    if (brandKey) {
      navigation.navigate('BrandLanding', { brandKey });
    }
    return;
  }

  try {
    navigation.navigate(target as any);
  } catch {
    navigation.navigate(fallback as any);
  }
}
