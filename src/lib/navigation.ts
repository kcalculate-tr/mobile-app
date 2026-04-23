export function resolveNavigation(
  navigation: any,
  dest: string | null | undefined,
  fallback: string = 'Home',
): void {
  const target = (dest ?? fallback).toString().trim();
  if (!target) return;

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

  try {
    navigation.navigate(target as any);
  } catch {
    navigation.navigate(fallback as any);
  }
}
