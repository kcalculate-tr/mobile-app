// supabase/functions/adisyo-sync-products/index.ts
//
// Adisyo'daki ürünleri çekip KCAL DB'sindeki eşlemeyi günceller.
// Eşleşme anahtarı: products.adisyo_product_code (örn "KCAL-9") <-> Adisyo productCode
//
// İKİ KİP (14.10.2026):
//   · body boş / branch_id yok  → MERKEZ kipi (eski davranış birebir):
//     products.adisyo_product_unit_id güncellenir.
//   · body { branch_id }        → ŞUBE kipi: o şubenin KENDİ Adisyo hesabından
//     çekilir ve branch_product_adisyo tablosuna yazılır. products tablosuna
//     DOKUNULMAZ — merkezin eşlemesi bozulmaz.
//
// Şube kipi VARSAYILAN OLARAK DRY-RUN'dır: ne eşleştiğini gösterir, yazmaz.
// Yazmak için { branch_id, dry_run: false }. Sebep: yeni Adisyo hesaplarında
// ürün kodları çoğu zaman boş oluyor ve isimle eşleşmeye düşüyoruz; isim
// eşleşmesi körlemesine yazılırsa mutfağa YANLIŞ ÜRÜN iner.
//
// Tetikleme:
//   curl -X POST "https://xtjakvinklthlvsfcncu.supabase.co/functions/v1/adisyo-sync-products" \
//     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
//
// Çağrılma sıklığı: ürün eklediğin/değiştirdiğin her sefer manuel.
// Adisyo /Products endpoint'i 3 dakikada 1 kez çağrılabiliyor (rate limit).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ADISYO_API_KEY      = Deno.env.get("ADISYO_API_KEY")!;
const ADISYO_API_SECRET   = Deno.env.get("ADISYO_API_SECRET")!;
const ADISYO_API_CONSUMER = Deno.env.get("ADISYO_API_CONSUMER")!;
const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AdisyoProductUnit {
  unitName: string;
  productUnitId: number;
  isDefault: boolean;
}

interface AdisyoProduct {
  productName: string;
  productCode: string | null;
  productId: number;
  productUnits: AdisyoProductUnit[];
}

interface AdisyoCategory {
  categoryName: string;
  categoryId: number;
  products: AdisyoProduct[];
}

interface AdisyoProductsResponse {
  data: AdisyoCategory[];
  status: number;
  message: string;
}

interface AdisyoCreds {
  apiKey: string;
  apiSecret: string;
  apiConsumer: string;
}

const GLOBAL_CREDS: AdisyoCreds = {
  apiKey: ADISYO_API_KEY,
  apiSecret: ADISYO_API_SECRET,
  apiConsumer: ADISYO_API_CONSUMER,
};

function credsFromConfig(cfg: unknown): AdisyoCreds | null {
  if (cfg && typeof cfg === "object") {
    const c = cfg as Partial<AdisyoCreds>;
    if (c.apiKey && c.apiSecret && c.apiConsumer) {
      return { apiKey: c.apiKey, apiSecret: c.apiSecret, apiConsumer: c.apiConsumer };
    }
  }
  return null;
}

// İsim eşleşmesi için normalleştirme: büyük/küçük, noktalama, fazla boşluk ve
// parantez içi (ör. "(750kcal)") farkları eşleşmeyi engellemesin.
function adNormalize(raw: string): string {
  return String(raw ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9çğıöşü]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function adisyoUrunleriniCek(creds: AdisyoCreds) {
  const res = await fetch("https://ext.adisyo.com/api/External/v2/Products", {
    headers: {
      "x-api-key": creds.apiKey,
      "x-api-secret": creds.apiSecret,
      "x-api-consumer": creds.apiConsumer,
    },
  });
  if (!res.ok) return { hata: `adisyo_http_${res.status}`, veri: null as AdisyoProductsResponse | null };
  const veri: AdisyoProductsResponse = await res.json();
  if (veri.status !== 100) {
    return { hata: `adisyo_status_${veri.status}: ${veri.message}`, veri: null };
  }
  return { hata: null as string | null, veri };
}

function varsayilanUnit(p: AdisyoProduct): number | null {
  const u = p.productUnits?.find((x) => x.isDefault) ?? p.productUnits?.[0];
  return u?.productUnitId ?? null;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let govde: { branch_id?: string; dry_run?: boolean } = {};
  try {
    govde = await req.json();
  } catch {
    govde = {};
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ─────────────────────────────────────────────────────────────────────────
  // ŞUBE KİPİ
  // ─────────────────────────────────────────────────────────────────────────
  if (govde.branch_id) {
    const yaz = govde.dry_run === false; // varsayılan: dry-run
    const { data: sube } = await supabase
      .from("branches")
      .select("id, name, is_default, adisyo_config")
      .eq("id", govde.branch_id)
      .maybeSingle();

    if (!sube) return json({ error: "branch_not_found", branch_id: govde.branch_id }, 404);

    const creds = credsFromConfig(sube.adisyo_config);
    if (!creds) {
      return json({
        error: "branch_adisyo_config_missing",
        branch: sube.name,
        hint: "branches.adisyo_config içine { apiKey, apiSecret, apiConsumer } yazılmalı",
      }, 400);
    }

    const { hata, veri } = await adisyoUrunleriniCek(creds);
    if (hata || !veri) return json({ error: "adisyo_fetch_failed", detail: hata }, 502);

    // Adisyo tarafı: kod ve isim haritaları
    const kodHaritasi = new Map<string, { unitId: number; ad: string }>();
    const adHaritasi = new Map<string, { unitId: number; ad: string; kod: string | null }>();
    const cakisanAdlar = new Set<string>();
    let adisyoToplam = 0;

    for (const cat of veri.data) {
      for (const p of cat.products) {
        adisyoToplam++;
        const unitId = varsayilanUnit(p);
        if (!unitId) continue;
        if (p.productCode) kodHaritasi.set(p.productCode, { unitId, ad: p.productName });
        const anahtar = adNormalize(p.productName);
        if (!anahtar) continue;
        if (adHaritasi.has(anahtar)) cakisanAdlar.add(anahtar);
        adHaritasi.set(anahtar, { unitId, ad: p.productName, kod: p.productCode ?? null });
      }
    }

    const { data: urunler } = await supabase
      .from("products")
      .select("id, name, adisyo_product_code")
      .order("id");

    const eslesen: Array<Record<string, unknown>> = [];
    const eslesmeyen: Array<Record<string, unknown>> = [];
    const belirsiz: Array<Record<string, unknown>> = [];

    for (const u of urunler ?? []) {
      const kod = (u.adisyo_product_code ?? "") as string;
      const kodla = kod ? kodHaritasi.get(kod) : undefined;
      if (kodla) {
        eslesen.push({
          product_id: u.id, name: u.name, adisyo_name: kodla.ad,
          adisyo_product_unit_id: kodla.unitId, match_source: "code", adisyo_product_code: kod,
        });
        continue;
      }

      const anahtar = adNormalize(u.name as string);
      const adla = anahtar ? adHaritasi.get(anahtar) : undefined;
      if (adla && cakisanAdlar.has(anahtar)) {
        // Adisyo'da aynı isimden birden fazla var — hangisi olduğu belirsiz,
        // tahmin etmek yerine insana sor.
        belirsiz.push({ product_id: u.id, name: u.name, reason: "adisyoda_ayni_isimden_birden_fazla" });
        continue;
      }
      if (adla) {
        eslesen.push({
          product_id: u.id, name: u.name, adisyo_name: adla.ad,
          adisyo_product_unit_id: adla.unitId, match_source: "name",
          adisyo_product_code: adla.kod,
        });
        continue;
      }

      eslesmeyen.push({ product_id: u.id, name: u.name, adisyo_product_code: kod || null });
    }

    let yazilan = 0;
    const yazmaHatalari: Array<Record<string, unknown>> = [];
    if (yaz && eslesen.length > 0) {
      const satirlar = eslesen.map((e) => ({
        branch_id: sube.id,
        product_id: e.product_id,
        adisyo_product_unit_id: e.adisyo_product_unit_id,
        adisyo_product_code: e.adisyo_product_code ?? null,
        match_source: e.match_source,
        matched_name: e.adisyo_name,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("branch_product_adisyo")
        .upsert(satirlar, { onConflict: "branch_id,product_id" });
      if (error) yazmaHatalari.push({ error: error.message });
      else yazilan = satirlar.length;
    }

    return json({
      ok: true,
      kip: "sube",
      branch: sube.name,
      dry_run: !yaz,
      adisyo_toplam_urun: adisyoToplam,
      kcal_urun: (urunler ?? []).length,
      eslesen_sayisi: eslesen.length,
      kodla_eslesen: eslesen.filter((e) => e.match_source === "code").length,
      isimle_eslesen: eslesen.filter((e) => e.match_source === "name").length,
      belirsiz_sayisi: belirsiz.length,
      eslesmeyen_sayisi: eslesmeyen.length,
      yazilan,
      yazma_hatalari: yazmaHatalari,
      eslesen,
      belirsiz,
      eslesmeyen,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MERKEZ KİPİ — eski davranış birebir
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const { hata, veri } = await adisyoUrunleriniCek(GLOBAL_CREDS);
    if (hata || !veri) return json({ error: "adisyo_fetch_failed", detail: hata }, 502);

    const codeToUnitId = new Map<string, number>();
    let totalProducts = 0;
    let kcalProducts = 0;

    for (const cat of veri.data) {
      for (const p of cat.products) {
        totalProducts++;
        if (!p.productCode) continue;
        if (!p.productCode.startsWith("KCAL-")) continue;
        kcalProducts++;
        const unitId = varsayilanUnit(p);
        if (unitId) codeToUnitId.set(p.productCode, unitId);
      }
    }

    const updates: Array<{ code: string; unit_id: number }> = [];
    const updateErrors: Array<{ code: string; error: string }> = [];

    for (const [code, unitId] of codeToUnitId.entries()) {
      const { error } = await supabase
        .from("products")
        .update({ adisyo_product_unit_id: unitId })
        .eq("adisyo_product_code", code);

      if (error) updateErrors.push({ code, error: error.message });
      else updates.push({ code, unit_id: unitId });
    }

    const { data: unmapped } = await supabase
      .from("products")
      .select("id, name, adisyo_product_code")
      .is("adisyo_product_unit_id", null)
      .not("adisyo_product_code", "is", null);

    return json({
      ok: true,
      kip: "merkez",
      adisyo_total_products: totalProducts,
      adisyo_kcal_products: kcalProducts,
      updated: updates.length,
      update_errors: updateErrors,
      unmapped_in_kcal: unmapped ?? [],
      sample_updates: updates.slice(0, 5),
    });
  } catch (err) {
    return json({ error: "internal", message: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
