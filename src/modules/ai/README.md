# modules/ai — Kcalculate AI (iskelet)

Bu klasör **Kcalculate AI** servisinin (kalori takibi, Keşfet, "ne yemeli")
ileride taşınacağı modül sınırıdır. Şu an **boş iskelet**: davranış değişikliği
yapılmadan yalnızca sınır oluşturuldu.

Hedef (gelecek faz): kalori/beslenme takibi ve AI öneri akışına ait ekran, hook
ve lib'ler buraya taşınacak. Mevcut `src/screens/tracker/*`, `src/screens/MacroScreen.tsx`
ve ilgili `src/lib/macros*`, `src/lib/nutrition*` dosyaları aday.

Ortak altyapı (`src/core/`: auth, push, ui, supabase istemcisi) her iki serviste
paylaşılmaya devam eder; modüller yalnızca kendi domain kodunu barındırır.
