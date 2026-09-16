#!/usr/bin/env bash
# ============================================================================
# ADIM 8a — paynkolay-query ÖN-TEST (PARA HAREKETİ YOK, sadece okuma/sorgu)
#
# Token SOHBETE GİRMEZ: ADMIN_TOKEN env'den okunur.
#
# KULLANIM:
#   1) Boss panele (boss.eatkcal.com) login ol.
#   2) DevTools > Console:
#        JSON.parse(localStorage.getItem(
#          Object.keys(localStorage).find(k => k.includes('auth-token'))
#        )).access_token
#      (çıktı uzun bir JWT — bunu KOPYALA)
#   3) Kendi terminalinde:
#        export ADMIN_TOKEN='<kopyaladığın_jwt>'
#        ./scripts/test-paynkolay-query.sh            # son 5 paynkolay order'ı listeler
#        ./scripts/test-paynkolay-query.sh <orderId>  # o order'ı sorgular
#
# NOT: Token ~1 saatte expire olur; 401 alırsan yeniden kopyala.
# ============================================================================
set -euo pipefail

SUPABASE_URL="https://xtjakvinklthlvsfcncu.supabase.co"
ANON="sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29"

if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "HATA: ADMIN_TOKEN env tanımlı değil."
  echo "Boss panele login -> DevTools Console:"
  echo "  JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('auth-token')))).access_token"
  echo "Sonra: export ADMIN_TOKEN='...'  &&  ./scripts/test-paynkolay-query.sh [orderId]"
  exit 1
fi

AUTH=(-H "apikey: $ANON" -H "Authorization: Bearer $ADMIN_TOKEN")
ORDER_ID="${1:-}"

if [ -z "$ORDER_ID" ]; then
  echo "== Son 5 Paynkolay order (admin token ile, read-only) =="
  curl -s "$SUPABASE_URL/rest/v1/orders?select=id,merchant_oid,status,payment_provider,total_price,payment_total_amount,paynkolay_reference_code,paynkolay_trx_date,created_at&payment_provider=eq.paynkolay&order=created_at.desc&limit=5" \
    "${AUTH[@]}" | python3 -m json.tool
  echo ""
  echo "Bir orderId seç ve tekrar çalıştır:  ./scripts/test-paynkolay-query.sh <orderId>"
  exit 0
fi

echo "== paynkolay-query çağrısı (orderId=$ORDER_ID) — PARA YOK =="
curl -s -X POST "$SUPABASE_URL/functions/v1/paynkolay-query" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"orderId\": $ORDER_ID}" | python3 -m json.tool
echo ""
echo "BEKLENEN: found=true, status=SUCCESS, referenceCode=IKSIRPF..., trxDate dolu."
echo "found=false ya da 401/403/500 -> DUR, refund'a geçme (sebebi çöz)."
