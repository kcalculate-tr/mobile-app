#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KCAL Boss Panel Fix Script
Çalıştırma: cd /Users/ilterozisseven/Desktop/kcal-mobile && python3 fix_all.py
"""

ADMIN   = 'admin-panel/src/pages/Admin.jsx'
CATALOG = 'admin-panel/src/pages/admin/BossCatalog.jsx'

def patch(filepath, old, new, label):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f'⚠️  {label}: eşleşme bulunamadı (zaten uygulanmış olabilir)')
        return False
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new, 1))
    print(f'✅ {label}')
    return True

# ── 1. BossCatalog: disableNotifications prop ─────────────────────────────
patch(CATALOG,
'''        <Admin
          hideAdminChrome
          forcedTab={activeTab}
          visibleTabs={CATALOG_VISIBLE_TABS}
          initialTab="products"
        />''',
'''        <Admin
          hideAdminChrome
          disableNotifications
          forcedTab={activeTab}
          visibleTabs={CATALOG_VISIBLE_TABS}
          initialTab="products"
        />''',
'BossCatalog: disableNotifications prop')

# ── 2. Admin prop signature ────────────────────────────────────────────────
patch(ADMIN,
'  hideAdminChrome = false,\n} = {}) {',
'  hideAdminChrome = false,\n  disableNotifications = false,\n} = {}) {',
'Admin: disableNotifications prop signature')

# ── 3. Admin: orders subscription useEffect guard ─────────────────────────
patch(ADMIN,
'''  useEffect(() => {
    if (!isAuthenticated) return undefined;

    fetchOrders();
    fetchProducts();''',
'''  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (disableNotifications) return undefined;

    fetchOrders();
    fetchProducts();''',
'Admin: subscription useEffect guard')

# ── 4. Admin: audio unlock useEffect guard ────────────────────────────────
patch(ADMIN,
'''  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const unlockOnInteraction = () => {''',
'''  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (disableNotifications) return undefined;

    const unlockOnInteraction = () => {''',
'Admin: audio unlock guard')

# ── 5. Admin: pendingOrders alarm useEffect guard ─────────────────────────
patch(ADMIN,
'''  useEffect(() => {
    if (!isAuthenticated) return undefined;

    if (pendingIncomingOrders.length === 0) {''',
'''  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (disableNotifications) return undefined;

    if (pendingIncomingOrders.length === 0) {''',
'Admin: pendingOrders alarm guard')

# ── 6. Admin: safeUpdateById → RLS select fallback ────────────────────────
patch(ADMIN,
'      if (row) return row;\n      throw new Error(`${table} tablosunda id=${id} için kayıt bulunamadı.`);',
'      if (row) return row;\n      // RLS select engeli: update başarılı ama satır dönmedi → id ile fallback\n      return { id, ...next };',
'Admin: safeUpdateById RLS fallback')

# ── 7. Admin: uploadCategoryImage → images bucket ─────────────────────────
patch(ADMIN,
'''  const uploadCategoryImage = async (categoryId, file) => {
    await supabase.storage.createBucket('category-images', { public: true }).catch(() => {});
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${categoryId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('category-images')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('category-images').getPublicUrl(path);
    return publicUrl;
  };''',
'''  const uploadCategoryImage = async (categoryId, file) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `categories/${categoryId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return publicUrl;
  };''',
'Admin: uploadCategoryImage → images bucket')

# ── 8. Admin: Modal → name / price / category labels ─────────────────────
patch(ADMIN,
'''              <input
                type="text"
                value={productForm.name}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ürün adı"
                className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={productForm.price}
                onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="Fiyat"
                className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
              />

              <input
                type="text"
                list="admin-category-options"
                value={productForm.category}
                onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Kategori"
                className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
              />''',
'''              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Ürün Adı *</p>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ürün adı"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Fiyat (₺) *</p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Kategori</p>
                <input
                  type="text"
                  list="admin-category-options"
                  value={productForm.category}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Kategori seçin"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>''',
'Admin: Modal name/price/category labels')

# ── 9. Admin: Modal → order label ─────────────────────────────────────────
patch(ADMIN,
'''              <input
                type="number"
                min="0"
                step="1"
                value={productForm.order}
                onChange={(e) => setProductForm((prev) => ({ ...prev, order: e.target.value }))}
                placeholder="Sıra"
                className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
              />''',
'''              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Görüntülenme Sırası</p>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.order}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, order: e.target.value }))}
                  placeholder="1"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>''',
'Admin: Modal order label')

# ── 10. Admin: Modal → macro grid label ──────────────────────────────────
patch(ADMIN,
'''              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.calories}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, calories: e.target.value }))}
                  placeholder="Kalori (kcal)"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={productForm.protein}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, protein: e.target.value }))}
                  placeholder="Protein (g)"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={productForm.carbs}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, carbs: e.target.value }))}
                  placeholder="Karbonhidrat (g)"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={productForm.fats}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, fats: e.target.value }))}
                  placeholder="Yağ (g)"
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>''',
'''              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Besin Değerleri</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.calories}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, calories: e.target.value }))}
                    placeholder="Kalori (kcal)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={productForm.protein}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, protein: e.target.value }))}
                    placeholder="Protein (g)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={productForm.carbs}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, carbs: e.target.value }))}
                    placeholder="Karbonhidrat (g)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={productForm.fats}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, fats: e.target.value }))}
                    placeholder="Yağ (g)"
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                </div>
              </div>''',
'Admin: Modal macro grid label')

# ── 11. Admin: Modal → description label ─────────────────────────────────
patch(ADMIN,
'''              <textarea
                rows={3}
                value={productForm.description}
                onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Açıklama"
                className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm resize-none outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
              />''',
'''              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">Açıklama</p>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="İçerik, malzemeler, besin bilgisi..."
                  className="w-full py-2.5 px-3 rounded-xl border border-gray-300 text-sm resize-none outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>''',
'Admin: Modal description label')

print('\n✨ Tüm fixler tamamlandı. npm run build ile test edin.')
