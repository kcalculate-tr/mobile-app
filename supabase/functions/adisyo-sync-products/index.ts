// supabase/functions/adisyo-sync-products/index.ts
//
// Adisyo'daki ürünleri çekip KCAL DB'sindeki adisyo_product_unit_id alanını günceller.
// Eşleşme anahtarı: products.adisyo_product_code (örn "KCAL-9") <-> Adisyo productCode
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

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. Adisyo'dan ürünleri çek
    const adisyoRes = await fetch(
      "https://ext.adisyo.com/api/External/v2/Products",
      {
        headers: {
          "x-api-key": ADISYO_API_KEY,
          "x-api-secret": ADISYO_API_SECRET,
          "x-api-consumer": ADISYO_API_CONSUMER,
        },
      },
    );

    if (!adisyoRes.ok) {
      return json({ error: "adisyo_http_error", status: adisyoRes.status }, 502);
    }

    const adisyoData: AdisyoProductsResponse = await adisyoRes.json();

    if (adisyoData.status !== 100) {
      return json({
        error: "adisyo_api_error",
        adisyo_status: adisyoData.status,
        adisyo_message: adisyoData.message,
      }, 502);
    }

    // 2. Düz bir productCode -> productUnitId map'i oluştur
    // Birden fazla unit varsa "isDefault=true" olanı, yoksa ilkini al.
    const codeToUnitId = new Map<string, number>();
    let totalProducts = 0;
    let kcalProducts = 0;

    for (const cat of adisyoData.data) {
      for (const p of cat.products) {
        totalProducts++;
        if (!p.productCode) continue;
        if (!p.productCode.startsWith("KCAL-")) continue;
        kcalProducts++;

        const defaultUnit = p.productUnits.find((u) => u.isDefault) ?? p.productUnits[0];
        if (defaultUnit) {
          codeToUnitId.set(p.productCode, defaultUnit.productUnitId);
        }
      }
    }

    // 3. Supabase'e bağlan, mapping'leri güncelle
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const updates: Array<{ code: string; unit_id: number }> = [];
    const updateErrors: Array<{ code: string; error: string }> = [];

    for (const [code, unitId] of codeToUnitId.entries()) {
      const { error } = await supabase
        .from("products")
        .update({ adisyo_product_unit_id: unitId })
        .eq("adisyo_product_code", code);

      if (error) {
        updateErrors.push({ code, error: error.message });
      } else {
        updates.push({ code, unit_id: unitId });
      }
    }

    // 4. Eşleşmeyenleri tespit et (KCAL DB'de var ama Adisyo'da yok)
    const { data: unmapped } = await supabase
      .from("products")
      .select("id, name, adisyo_product_code")
      .is("adisyo_product_unit_id", null)
      .not("adisyo_product_code", "is", null);

    return json({
      ok: true,
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
