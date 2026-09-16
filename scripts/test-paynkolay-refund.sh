#!/usr/bin/env bash
# ============================================================================
# ADIM 8b — paynkolay-refund TEST  ⚠️ GERÇEK PARA İADESİ ⚠️
#
# Order 136 (bugünkü test ödemesi) için TAM iade. trxDate=2026.06.24==bugün
# olduğundan fonksiyon type=cancel (aynı gün iptal) seçer.
#
# Token SOHBETE GİRMEZ: ADMIN_TOKEN env'den (8a'daki token hâlâ geçerliyse aynısı).
#
# KULLANIM:
#   export ADMIN_TOKEN='<jwt>'                       # 8a'dakiyle aynı, expire olduysa yenile
#   ./scripts/test-paynkolay-refund.sh               # order 136, tam iade
#   ./scripts/test-paynkolay-refund.sh <orderId>     # başka order
#
# ⚠️ TEK SEFER çalıştır. Başarılı olursa order 'refunded' olur, çift iade
#    guard'ı (409) ikinci denemeyi engeller. Başarısızsa order'a dokunulmaz
#    (tekrar denenebilir — örn. content-type düzeltmesi sonrası).
# ============================================================================
set -euo pipefail

SUPABASE_URL="https://xtjakvinklthlvsfcncu.supabase.co"
ANON="sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29"

if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "HATA: ADMIN_TOKEN env tanımlı değil. (8a ile aynı token; expire olduysa yenile.)"
  echo "  export ADMIN_TOKEN='...'  &&  ./scripts/test-paynkolay-refund.sh"
  exit 1
fi

AUTH=(-H "apikey: $ANON" -H "Authorization: Bearer $ADMIN_TOKEN")
ORDER_ID="${1:-136}"

echo "=================================================================="
echo " paynkolay-refund  ->  orderId=$ORDER_ID  (TAM iade, amount yok)"
echo " ⚠️  GERÇEK PARA İADESİ — tek sefer çalıştır"
echo "=================================================================="
echo ""

# -w ile HTTP kodu da yakala (başarı 200 / Paynkolay reddi 502 / config 500 ...)
RESP=$(curl -s -w $'\nHTTP_STATUS:%{http_code}' -X POST "$SUPABASE_URL/functions/v1/paynkolay-refund" \
  "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"orderId\": $ORDER_ID, \"reason\": \"ADIM 8b uçtan uca iade testi\"}")

BODY=$(printf '%s' "$RESP" | sed '$d')
CODE=$(printf '%s' "$RESP" | tail -1 | cut -d: -f2)

echo "== HTTP STATUS: $CODE =="
echo "== FONKSIYON YANITI =="
printf '%s\n' "$BODY" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$BODY"
echo ""

echo "== Order $ORDER_ID güncel durum (refunded? refund_amount?) =="
curl -s "$SUPABASE_URL/rest/v1/orders?select=id,status,payment_status,refund_amount,refunded_at,paynkolay_reference_code,paynkolay_trx_date&id=eq.$ORDER_ID" \
  "${AUTH[@]}" | python3 -m json.tool 2>/dev/null || echo "(order durumu çekilemedi)"
echo ""

echo "------------------------------------------------------------------"
echo "BAŞARI  : HTTP 200 + success:true + type:cancel + order status=refunded + GERÇEK PARA geri"
echo "RED     : HTTP 502 + success:false + responseCode (2 değil) -> content-type/amount/hash kontrol"
echo "          (responseCode BOŞ ise multipart yerine x-www-form-urlencoded gerekebilir)"
echo "DETAY   : Paynkolay ham yanıtı refunds.provider_response'ta + Edge Function loglarında"
echo "------------------------------------------------------------------"
